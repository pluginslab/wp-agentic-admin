/**
 * ReAct Agent
 *
 * Implements the ReAct (Reasoning + Acting) pattern where the LLM:
 * 1. Reasons about what to do next
 * 2. Selects a tool via prompt-based JSON
 * 3. Observes the result
 * 4. Repeats until task is complete
 *
 * @since 0.1.0
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'ReactAgent' );

/**
 * ReAct Agent Configuration
 */
const REACT_CONFIG = {
	maxIterations: 10, // Safety limit to prevent infinite loops
	temperature: 0.3, // 7B models are more reliable, lower temp for consistency
	maxTokens: 1024, // 7B models produce richer reasoning
	confirmationTimeout: 30000, // 30s timeout for user confirmations
	maxToolResultLength: 2000, // 7B models handle more context
	disableThinking: false, // Disable Qwen 3 <think> blocks for faster inference
	disableThinkingAfterTool: true, // Skip thinking on iterations after tool results
};

/**
 * @typedef {Object} ReactResult
 * @property {boolean}  success      - Whether the task completed successfully
 * @property {string}   finalAnswer  - The final response to show the user
 * @property {number}   iterations   - Number of reasoning loops executed
 * @property {string[]} toolsUsed    - Array of tool IDs that were called
 * @property {Object[]} observations - Array of tool results
 * @property {string}   [error]      - Error message if failed
 */

/**
 * ReAct Agent
 *
 * Executes a reasoning loop where the LLM selects tools one at a time
 * based on observations from previous tool calls.
 */
class ReactAgent {
	/**
	 * Create a new ReAct agent
	 *
	 * @param {Object} modelLoader           - ModelLoader instance for LLM access
	 * @param {Object} toolRegistry          - ToolRegistry instance for available tools
	 * @param {Object} [options]             - Configuration options
	 * @param {Object} [instructionRegistry] - InstructionRegistry instance for progressive disclosure
	 */
	constructor(
		modelLoader,
		toolRegistry,
		options = {},
		instructionRegistry = null
	) {
		this.modelLoader = modelLoader;
		this.toolRegistry = toolRegistry;
		this.instructionRegistry = instructionRegistry;
		this.config = { ...REACT_CONFIG, ...options };

		/**
		 * Active instruction IDs. Persists across execute() calls within a session.
		 * Reset when resetSession() is called.
		 *
		 * @type {Set<string>}
		 */
		this.activeInstructions = new Set();

		// Callbacks for UI integration
		this.callbacks = {
			onToolStart: () => {},
			onToolEnd: () => {},
			onThinking: () => {},
			onThinkingStart: () => {},
			onThinkingChunk: () => {},
			onThinkingEnd: () => {},
			onConfirmationRequired: async () => true, // Default: auto-confirm
		};
	}

	/**
	 * Reset session state (active instructions).
	 * Called when a new chat session starts.
	 */
	resetSession() {
		this.activeInstructions.clear();
	}

	/**
	 * Set callbacks for UI integration
	 *
	 * @param {Object} callbacks - Callback functions
	 */
	setCallbacks( callbacks ) {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	/**
	 * Execute the ReAct loop
	 *
	 * Main entry point. Runs reasoning loop until:
	 * - LLM provides final answer
	 * - Max iterations reached
	 * - Error occurs
	 *
	 *
	 * @param {string} userMessage         - The user's request
	 * @param {Array}  conversationHistory - Previous messages (for context)
	 * @return {Promise<ReactResult>} Result with success status, final answer, and execution details.
	 */
	async execute( userMessage, conversationHistory = [] ) {
		log.info( 'Starting ReAct loop for:', userMessage );

		const engine = this.modelLoader.getEngine();
		if ( ! engine ) {
			return {
				success: false,
				finalAnswer:
					'The AI model is not loaded yet. Please load the model first.',
				iterations: 0,
				toolsUsed: [],
				observations: [],
				error: 'Model not loaded',
			};
		}

		const result = await this.executeWithPromptBased(
			userMessage,
			conversationHistory
		);

		// Store last result for test observability
		this.lastResult = result;
		return result;
	}

	/**
	 * Execute ReAct loop using prompt-based JSON tool selection
	 *
	 * Works with any LLM that can output JSON (Qwen, Flash, etc.)
	 *
	 * @param {string} userMessage         - The user's request
	 * @param {Array}  conversationHistory - Previous messages
	 * @return {Promise<ReactResult>} Result with tools used, iterations, and final answer.
	 */
	async executeWithPromptBased( userMessage, conversationHistory ) {
		const engine = this.modelLoader.getEngine();

		const observations = [];
		const toolsUsed = [];
		let iteration = 0;

		// Build initial system prompt (rebuilt each iteration when instructions change)
		const messages = [
			{ role: 'system', content: this.buildSystemPromptPromptBased() },
			...conversationHistory,
			{ role: 'user', content: userMessage },
		];

		while ( iteration < this.config.maxIterations ) {
			// Rebuild system prompt each iteration so load/unload takes effect
			messages[ 0 ] = {
				role: 'system',
				content: this.buildSystemPromptPromptBased(),
			};
			iteration++;
			const hasToolResults = toolsUsed.length > 0;
			log.debug(
				`ReAct iteration ${ iteration }/${
					this.config.maxIterations
				} (prompt-based mode, thinking: ${
					hasToolResults && this.config.disableThinkingAfterTool
						? 'off (post-tool)'
						: 'on'
				})`
			);

			try {
				// Stream LLM response to show thinking tokens live
				const stream = await engine.chat.completions.create( {
					messages,
					temperature: this.config.temperature,
					max_tokens: this.config.maxTokens,
					stream: true,
					stream_options: { include_usage: true },
				} );

				let fullResponse = '';
				let inThinkBlock = false;

				for await ( const chunk of stream ) {
					const delta = chunk.choices[ 0 ]?.delta?.content || '';
					fullResponse += delta;

					// Stream thinking tokens live (skip when thinking
					// is disabled after tool results)
					const thinkingSuppressed =
						hasToolResults && this.config.disableThinkingAfterTool;

					if (
						! thinkingSuppressed &&
						fullResponse.includes( '<think>' ) &&
						! fullResponse.includes( '</think>' )
					) {
						if ( ! inThinkBlock ) {
							inThinkBlock = true;
							this.callbacks.onThinkingStart();
						}
						const thinkStart =
							fullResponse.indexOf( '<think>' ) + 7;
						const thinkContent = fullResponse
							.substring( thinkStart )
							.trim();
						this.callbacks.onThinkingChunk( delta, thinkContent );
					}

					// Thinking block completed
					if ( inThinkBlock && fullResponse.includes( '</think>' ) ) {
						inThinkBlock = false;
						const thinkMatch = fullResponse.match(
							/<think>([\s\S]*?)<\/think>/
						);
						const finalThinkContent = thinkMatch
							? thinkMatch[ 1 ].trim()
							: '';
						if ( finalThinkContent ) {
							this.callbacks.onThinkingEnd( finalThinkContent );
						} else {
							// Empty think block — cancel the thinking UI
							this.callbacks.onThinkingEnd( null );
						}
					}

					// Capture usage stats from the final chunk
					if ( chunk.usage ) {
						this.modelLoader.updateUsageStats( chunk.usage );
					}
				}

				let content = fullResponse;
				log.debug( 'LLM response:', content );

				// Strip <think> blocks from content for JSON parsing
				content = content
					.replace( /<think>[\s\S]*?<\/think>\s*/g, '' )
					.trim();
				// Handle incomplete think block (no closing tag — model ran out of tokens)
				if ( content.startsWith( '<think>' ) ) {
					if ( inThinkBlock ) {
						const thinkStart =
							fullResponse.indexOf( '<think>' ) + 7;
						this.callbacks.onThinkingEnd(
							fullResponse.substring( thinkStart ).trim()
						);
					}
					const jsonIdx = content.indexOf( '{' );
					content = jsonIdx > 0 ? content.substring( jsonIdx ) : '';
				}

				// Parse JSON response
				const action = this.parseActionFromResponse( content );

				if ( ! action ) {
					// Fallback: If LLM outputs plain text (no JSON), treat it as final answer
					log.warn(
						'LLM output plain text instead of JSON, treating as final answer'
					);
					log.debug( 'Plain text response:', content );

					// If we've already used tools and LLM is responding naturally, accept it
					if ( toolsUsed.length > 0 ) {
						// Try to extract clean content if it looks like a JSON envelope
						let answer = content;
						if ( content.trim().startsWith( '{' ) ) {
							try {
								const parsed = JSON.parse( content );
								if ( parsed.content ) {
									answer = parsed.content;
								}
							} catch ( e ) {
								// Not valid JSON, use raw content
							}
						}
						return {
							success: true,
							finalAnswer: answer,
							iterations: iteration,
							toolsUsed,
							observations,
						};
					}

					// If no tools used yet, this is an error
					return {
						success: false,
						finalAnswer:
							'I had trouble understanding how to help. Could you rephrase your request?',
						iterations: iteration,
						toolsUsed,
						observations,
						error: 'Failed to parse LLM response',
					};
				}

				// Case 1: Tool call
				if ( action.action === 'tool_call' ) {
					const toolName = action.tool;
					const toolArgs = action.args || {};

					log.info( `LLM requested tool: ${ toolName }`, toolArgs );

					// Handle load_instruction meta-tool
					if (
						toolName === 'load_instruction' &&
						this.instructionRegistry
					) {
						const instructionId = toolArgs.instruction;
						const instruction =
							this.instructionRegistry.get( instructionId );
						if ( ! instruction ) {
							const available = this.instructionRegistry
								.getAll()
								.map( ( inst ) => inst.id )
								.join( ', ' );
							messages.push( {
								role: 'assistant',
								content,
							} );
							messages.push( {
								role: 'user',
								content: `Error: Instruction "${ instructionId }" not found. Available instructions: ${ available }.\n\nRemember: Respond with ONLY a JSON object.`,
							} );
							continue;
						}
						this.activeInstructions.add( instructionId );
						messages.push( {
							role: 'assistant',
							content,
						} );
						messages.push( {
							role: 'user',
							content: `Instruction "${ instructionId }" loaded. Its tools are now available.\n\nRemember: Respond with ONLY a JSON object. Either call another tool or provide final_answer.`,
						} );
						continue;
					}

					// Handle unload_instruction meta-tool
					if (
						toolName === 'unload_instruction' &&
						this.instructionRegistry
					) {
						const instructionId = toolArgs.instruction;
						this.activeInstructions.delete( instructionId );
						messages.push( {
							role: 'assistant',
							content,
						} );
						messages.push( {
							role: 'user',
							content: `Instruction "${ instructionId }" unloaded.\n\nRemember: Respond with ONLY a JSON object. Either call another tool or provide final_answer.`,
						} );
						continue;
					}

					// Detect repeated tool calls (same tool twice in a row)
					if (
						toolsUsed.length > 0 &&
						toolsUsed[ toolsUsed.length - 1 ] === toolName
					) {
						log.warn(
							`Detected repeated tool call: ${ toolName }. Stopping loop and summarizing results.`
						);

						// Build a helpful summary from what we gathered
						const summary = this.buildSummaryFromObservations(
							observations,
							userMessage
						);

						return {
							success: true, // We got data, so this is a success
							finalAnswer: summary,
							iterations: iteration,
							toolsUsed,
							observations,
							error: 'Repeated tool call detected (handled gracefully)',
						};
					}

					const toolResult = await this.executeTool(
						toolName,
						toolArgs,
						userMessage
					);

					toolsUsed.push( toolName );
					observations.push( {
						tool: toolName,
						args: toolArgs,
						result: toolResult,
					} );

					// Truncate result if too large (prevent context window overflow)
					const resultStr = JSON.stringify( toolResult );
					const truncatedResult =
						resultStr.length > this.config.maxToolResultLength
							? resultStr.substring(
									0,
									this.config.maxToolResultLength
							  ) + '...[truncated]'
							: resultStr;

					// Add observation to conversation with JSON format reminder
					messages.push( {
						role: 'assistant',
						content, // Keep the original JSON response
					} );
					messages.push( {
						role: 'user',
						content: this.buildToolResultMessage(
							toolResult,
							truncatedResult
						),
					} );

					continue;
				}

				// Case 2: Final answer
				if ( action.action === 'final_answer' ) {
					log.info( 'LLM provided final answer' );
					let answer =
						action.content || action.answer || 'Task completed.';

					// Unwrap double-encoded JSON envelope if model wrapped the answer twice
					if (
						typeof answer === 'string' &&
						answer.trim().startsWith( '{' )
					) {
						try {
							const inner = JSON.parse( answer );
							if ( inner.content ) {
								answer = inner.content;
							}
						} catch ( e ) {
							// Not double-encoded, keep as-is
						}
					}

					return {
						success: true,
						finalAnswer: answer,
						iterations: iteration,
						toolsUsed,
						observations,
					};
				}

				// Case 3: Unknown action
				log.warn( 'Unknown action type:', action.action );
				return {
					success: false,
					finalAnswer:
						'I encountered an issue processing your request.',
					iterations: iteration,
					toolsUsed,
					observations,
					error: 'Unknown action type',
				};
			} catch ( error ) {
				const errorMessage = error?.message || String( error );

				// Handle context window exceeded
				if (
					errorMessage.includes( 'ContextWindowSizeExceededError' ) ||
					errorMessage.includes( 'context window size' )
				) {
					log.error(
						'Context window exceeded. Providing summary of what we found so far.'
					);

					// Build a summary from observations
					const summary = this.buildSummaryFromObservations(
						observations,
						userMessage
					);
					return {
						success: true,
						finalAnswer: summary,
						iterations: iteration,
						toolsUsed,
						observations,
						error: 'Context window exceeded (handled gracefully)',
					};
				}

				log.error( 'ReAct loop error:', error );
				return {
					success: false,
					finalAnswer: `I encountered an error: ${ errorMessage }`,
					iterations: iteration,
					toolsUsed,
					observations,
					error: errorMessage,
				};
			}
		}

		// Max iterations reached
		log.warn( 'Max iterations reached' );
		return {
			success: false,
			finalAnswer:
				'I reached the maximum number of steps. Please try rephrasing your request or break it into smaller tasks.',
			iterations: iteration,
			toolsUsed,
			observations,
			error: 'Max iterations exceeded',
		};
	}

	/**
	 * Build a summary from observations when we can't continue
	 *
	 * Tries to extract useful information from tool results instead of
	 * just listing tool names.
	 *
	 * @param {Array} observations - Tool observations
	 * @return {string} Summary message
	 */
	buildSummaryFromObservations( observations ) {
		if ( observations.length === 0 ) {
			return 'I tried to help but encountered an issue before gathering any information.';
		}

		// Try to build a helpful summary from the last observation
		const lastObs = observations[ observations.length - 1 ];
		const toolName = lastObs.tool.split( '/' ).pop().replace( /-/g, ' ' );

		// Extract data from the result
		if ( lastObs.result?.success && lastObs.result?.data ) {
			const data = lastObs.result.data;

			// Try to summarize based on the data structure
			if ( data.entries && Array.isArray( data.entries ) ) {
				// Error log or similar list data
				const count = data.entries.length;
				const sample = data.entries.slice( 0, 3 ).join( '\n' );
				return `I found ${ count } entries from the ${ toolName }. Here are the first few:\n\n${ sample }\n\n${
					count > 3 ? `...and ${ count - 3 } more entries.` : ''
				}`;
			} else if ( data.plugins && Array.isArray( data.plugins ) ) {
				// Plugin list
				const count = data.plugins.length;
				const names = data.plugins
					.slice( 0, 5 )
					.map( ( p ) => p.name || p )
					.join( ', ' );
				return `Found ${ count } plugins: ${ names }${
					count > 5 ? ', and more...' : ''
				}`;
			} else if ( typeof data === 'object' ) {
				// Generic object - show key summary
				const keys = Object.keys( data ).slice( 0, 5 ).join( ', ' );
				return `I gathered ${ toolName } data with information about: ${ keys }.`;
			}
		}

		// Fallback to generic message
		const toolNames = observations
			.map( ( obs ) => obs.tool.split( '/' ).pop().replace( /-/g, ' ' ) )
			.join( ', ' );
		return `I gathered information using: ${ toolNames }. However, I encountered an issue summarizing the results. The data has been collected successfully.`;
	}

	/**
	 * Parse action from LLM response
	 *
	 * Extracts the FIRST valid JSON object from response text.
	 * Handles cases where LLM outputs multiple JSON objects or wraps in markdown.
	 * Includes sanitization for edge cases (control characters, trailing commas).
	 *
	 * @param {string} content - LLM response content
	 * @return {Object|null} Parsed action or null if invalid
	 */
	parseActionFromResponse( content ) {
		try {
			let text = content.trim();

			// Strip <think>...</think> blocks from models with thinking mode (e.g. Qwen 3).
			// The model may output reasoning in <think> tags before the actual JSON response.
			// Handle both complete (<think>...</think>{json}) and incomplete (<think>... cutoff) cases.
			text = text.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();
			if ( text.startsWith( '<think>' ) ) {
				// Incomplete think block (no closing tag) — model used all tokens on thinking.
				// Try to find JSON after the thinking content.
				const jsonStart = text.indexOf( '{' );
				if ( jsonStart > 0 ) {
					text = text.substring( jsonStart );
				} else {
					log.warn( 'Response is only a <think> block with no JSON' );
					return null;
				}
			}

			// Remove markdown code blocks if present
			if ( text.startsWith( '```json' ) ) {
				text = text
					.replace( /^```json\s*/, '' )
					.replace( /\s*```$/, '' );
			} else if ( text.startsWith( '```' ) ) {
				text = text.replace( /^```\s*/, '' ).replace( /\s*```$/, '' );
			}

			// Sanitize control characters that break JSON parsing
			// Small models (1.5B-3B) sometimes include unescaped newlines/tabs in JSON strings
			// Example: {"action": "tool_call", "args": {"reason": "Clean up\ndatabase"}}
			// This regex removes control characters (0x00-0x1F) except tab, newline, carriage return
			// which we'll handle by replacing with spaces
			text = text.replace( /[\x00-\x1F]/g, ( match ) => {
				// Replace newlines, tabs, carriage returns with space
				if ( match === '\n' || match === '\r' || match === '\t' ) {
					return ' ';
				}
				// Remove other control characters
				return '';
			} );

			// Try to parse BEFORE any quote replacement (7B models output valid JSON)
			// Quote replacement corrupts apostrophes in content (e.g. "Here's" → "Here"s")
			try {
				const action = JSON.parse( text );
				if ( action.action ) {
					return action;
				}
			} catch ( e ) {
				// Not clean JSON, try with syntax fixes
				log.debug( 'Initial JSON parse failed:', e.message );
			}

			// Try to fix common JSON syntax issues from small models
			// 1. Single quotes to double quotes (for models that use single-quoted JSON keys)
			// 2. Remove trailing commas before } or ]
			// 3. Fix property names missing closing quotes (e.g., "args:{} → "args": {})
			const jsonText = text
				.replace( /'/g, '"' ) // Single quotes to double quotes
				.replace( /,(\s*[}\]])/g, '$1' ) // Remove trailing commas
				.replace( /"(\w+):([^"])/g, '"$1": $2' ); // Fix missing quote+space: "args:{} → "args": {}

			try {
				const action = JSON.parse( jsonText );
				if ( action.action ) {
					return action;
				}
			} catch ( e ) {
				log.debug( 'Fixed JSON parse also failed:', e.message );
			}

			// Extract first valid JSON object by counting braces
			const firstBrace = jsonText.indexOf( '{' );
			if ( firstBrace === -1 ) {
				log.warn( 'No JSON object found in response' );
				log.error( 'Full response after sanitization:', jsonText );
				return null;
			}

			// Count braces to find the matching closing brace
			let braceCount = 0;
			let inString = false;
			let escapeNext = false;

			for ( let i = firstBrace; i < jsonText.length; i++ ) {
				const char = jsonText[ i ];

				// Handle string boundaries (don't count braces inside strings)
				if ( char === '"' && ! escapeNext ) {
					inString = ! inString;
					escapeNext = false;
					continue;
				}

				if ( char === '\\' && inString ) {
					escapeNext = ! escapeNext;
					continue;
				}

				escapeNext = false;

				if ( inString ) {
					continue; // Skip characters inside strings
				}

				if ( char === '{' ) {
					braceCount++;
				} else if ( char === '}' ) {
					braceCount--;

					// Found matching closing brace
					if ( braceCount === 0 ) {
						const jsonStr = jsonText.substring( firstBrace, i + 1 );
						try {
							const action = JSON.parse( jsonStr );

							// Validate action structure
							if ( ! action.action ) {
								log.warn( 'Action missing "action" field' );
								return null;
							}

							return action;
						} catch ( parseError ) {
							log.error(
								'Failed to parse extracted JSON:',
								parseError.message
							);
							log.error( 'Extracted JSON string:', jsonStr );
							return null;
						}
					}
				}
			}

			log.warn( 'Could not find complete JSON object' );
			return null;
		} catch ( error ) {
			log.error( 'JSON parse error:', error );
			log.error( 'Original content:', content );
			log.error(
				'After sanitization:',
				content.replace( /[\x00-\x1F]/g, ( m ) =>
					m === '\n' || m === '\r' || m === '\t' ? ' ' : ''
				)
			);
			return null;
		}
	}

	/**
	 * Execute a single tool
	 *
	 * @param {string} toolId      - Tool ID
	 * @param {Object} args        - Tool arguments
	 * @param {string} userMessage - Original user message
	 * @return {Promise<Object>} Tool result
	 */
	async executeTool( toolId, args, userMessage ) {
		const tool = this.toolRegistry.get( toolId );

		if ( ! tool ) {
			log.error( 'Tool not found:', toolId );
			return {
				success: false,
				error: `Tool "${ toolId }" not found`,
			};
		}

		// Check if confirmation is required
		if ( tool.requiresConfirmation ) {
			const confirmed = await this.requestConfirmation( tool, args );
			if ( ! confirmed ) {
				log.info( 'User cancelled tool execution:', toolId );
				return {
					success: false,
					error: 'User cancelled action',
					cancelled: true,
				};
			}
		}

		// Notify UI that tool is starting
		this.callbacks.onToolStart( toolId );

		try {
			// Execute the tool
			const result = await tool.execute( { userMessage, ...args } );

			this.callbacks.onToolEnd( toolId, result, true );

			// Generate plain-English interpretation for the LLM.
			// This helps small models understand tool results correctly,
			// especially for empty/negative results they might misinterpret.
			let resultForLLM = null;
			if ( typeof tool.interpretResult === 'function' ) {
				resultForLLM = tool.interpretResult( result, userMessage );
			}

			return {
				success: true,
				data: result,
				...( resultForLLM ? { result_for_llm: resultForLLM } : {} ),
			};
		} catch ( error ) {
			log.error( 'Tool execution error:', error );

			this.callbacks.onToolEnd( toolId, { error: error.message }, false );

			return {
				success: false,
				error: error.message,
			};
		}
	}

	/**
	 * Request confirmation from user
	 *
	 * @param {Object} tool - Tool requiring confirmation
	 * @param {Object} args - Tool arguments
	 * @return {Promise<boolean>} True if confirmed
	 */
	async requestConfirmation( tool, args ) {
		log.info( 'Requesting confirmation for:', tool.id, args );

		try {
			const confirmed = await Promise.race( [
				this.callbacks.onConfirmationRequired( tool, args ),
				new Promise( ( resolve ) =>
					setTimeout(
						() => resolve( false ),
						this.config.confirmationTimeout
					)
				),
			] );

			return !! confirmed;
		} catch ( error ) {
			log.error( 'Confirmation error:', error );
			return false;
		}
	}

	/**
	 * Build tool result message for prompt-based mode
	 *
	 * If the tool provides a plain-English interpretation via interpretResult(),
	 * it is placed first so the LLM reads it before the raw JSON data.
	 * This helps small models correctly interpret empty or negative results.
	 *
	 * @param {Object} toolResult      - The tool execution result
	 * @param {string} truncatedResult - JSON-stringified (possibly truncated) result
	 * @return {string} Formatted message for the conversation
	 */
	buildToolResultMessage( toolResult, truncatedResult ) {
		let message;
		if ( toolResult.result_for_llm ) {
			message = `Tool interpretation: ${ toolResult.result_for_llm }\n\nRaw data: ${ truncatedResult }`;
		} else {
			message = `Tool result: ${ truncatedResult }`;
		}
		const suffix =
			'\n\nRemember: Respond with ONLY a JSON object. Either call another tool or provide final_answer.';
		const nothink = this.config.disableThinkingAfterTool
			? '\n\n/nothink'
			: '';
		return message + suffix + nothink;
	}

	/**
	 * Build system prompt for prompt-based mode.
	 *
	 * When an instructionRegistry is available, uses progressive disclosure:
	 * - Meta-tools (load_instruction, unload_instruction) always listed
	 * - Ungrouped tools always listed
	 * - Tools from active instructions listed
	 * - Available instruction index shown for discovery
	 *
	 * Without an instructionRegistry, falls back to listing all tools (legacy).
	 *
	 * @return {string} System prompt with JSON instructions
	 */
	buildSystemPromptPromptBased() {
		const toolsList = this.buildToolsList();

		let instructionSection = '';
		if (
			this.instructionRegistry &&
			this.instructionRegistry.getAll().length > 0
		) {
			instructionSection = this.buildInstructionSection();
		}

		return `You are a WordPress assistant. Respond with ONLY a JSON object, nothing else.

TOOLS:
${ toolsList }
${ instructionSection }
FORMAT — every response must be exactly one JSON object:

Call a tool: {"action": "tool_call", "tool": "tool-id", "args": {}}
Final answer: {"action": "final_answer", "content": "Your answer here"}

RULES:
- One JSON object per response. No text before or after.
- Summarize tool results for humans. Never copy raw JSON into final_answer.
- If a tool fails, explain the failure in a final_answer.
- Never retry a failed tool. Never invent tool names.
- If no tool is needed, answer directly via final_answer.

EXAMPLE:

User: "list plugins"
{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}

[Tool returns data]
{"action": "final_answer", "content": "You have 2 plugins: Akismet (active) and Hello Dolly (inactive)."}

User: "what is a transient?"
{"action": "final_answer", "content": "A transient is temporary cached data in WordPress..."}${
			this.config.disableThinking ? '\n\n/nothink' : ''
		}`;
	}

	/**
	 * Build the TOOLS section of the system prompt.
	 *
	 * @return {string} Formatted tools list
	 */
	buildToolsList() {
		if (
			! this.instructionRegistry ||
			this.instructionRegistry.getAll().length === 0
		) {
			// Legacy: list all tools
			return this.toolRegistry
				.getAll()
				.map(
					( t ) => `- ${ t.id }: ${ t.description || t.label || '' }`
				)
				.join( '\n' );
		}

		const lines = [];

		// Meta-tools for instruction management
		lines.push(
			'- load_instruction: Load an instruction set to access its tools. Args: {"instruction": "instruction-id"}'
		);
		lines.push(
			'- unload_instruction: Unload an instruction set you no longer need. Args: {"instruction": "instruction-id"}'
		);

		// Ungrouped tools (always visible)
		const ungrouped = this.toolRegistry.getUngrouped(
			this.instructionRegistry
		);
		for ( const t of ungrouped ) {
			lines.push( `- ${ t.id }: ${ t.description || t.label || '' }` );
		}

		// Tools from active instructions
		for ( const instructionId of this.activeInstructions ) {
			const instruction = this.instructionRegistry.get( instructionId );
			if ( ! instruction ) {
				continue;
			}
			const tools = this.toolRegistry.getByIds( instruction.abilityIds );
			for ( const t of tools ) {
				lines.push(
					`- ${ t.id }: ${ t.description || t.label || '' }`
				);
			}
		}

		return lines.join( '\n' );
	}

	/**
	 * Build the instruction index section of the system prompt.
	 *
	 * @return {string} Formatted instruction section
	 */
	buildInstructionSection() {
		const allInstructions = this.instructionRegistry.getAll();
		const inactiveInstructions = allInstructions.filter(
			( inst ) => ! this.activeInstructions.has( inst.id )
		);

		let section = '';

		if ( inactiveInstructions.length > 0 ) {
			const index = inactiveInstructions
				.map( ( inst ) => `- ${ inst.id }: ${ inst.description }` )
				.join( '\n' );
			section += `\nAVAILABLE INSTRUCTIONS (call load_instruction to use):\n${ index }\n`;
		}

		if ( this.activeInstructions.size > 0 ) {
			const activeList = Array.from( this.activeInstructions ).join(
				', '
			);
			section += `\nACTIVE INSTRUCTIONS: ${ activeList }\n(Call unload_instruction if you no longer need one of these)\n`;

			// Inject context guidance from active instructions
			for ( const instructionId of this.activeInstructions ) {
				const instruction =
					this.instructionRegistry.get( instructionId );
				if ( instruction?.context ) {
					section += `\n[${ instruction.label }] ${ instruction.context }\n`;
				}
			}
		}

		return section;
	}
}

export { ReactAgent, REACT_CONFIG };
export default ReactAgent;
