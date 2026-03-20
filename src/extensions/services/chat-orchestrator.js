/**
 * Chat Orchestrator
 *
 * Main coordinator that orchestrates the chat experience by combining:
 * - ReAct agent for intelligent tool selection via function calling
 * - Workflow orchestrator for multi-step actions
 * - Stream simulator for typewriter effects
 * - Chat session for message management
 *
 * @since 0.1.0 - Refactored to use ReAct loop instead of 4-tier routing
 */

import modelLoader from './model-loader';
import toolRegistry from './tool-registry';
import instructionRegistry from './instruction-registry';
import streamSimulator from './stream-simulator';
import { ChatSession } from './chat-session';
import workflowRegistry from './workflow-registry';
import workflowOrchestrator from './workflow-orchestrator';
import ReactAgent from './react-agent';
import messageRouter from './message-router';
import { createLogger } from '../utils/logger';

const log = createLogger( 'ChatOrchestrator' );

/**
 * Build system prompt for conversational queries
 *
 * Simple prompt used when the LLM is answering questions without tools.
 * Tools are handled by the ReAct agent with its own specialized prompt.
 *
 * @return {string} System prompt
 */
function buildSystemPrompt() {
	const tools = toolRegistry.getAll();

	if ( tools.length === 0 ) {
		return `You are a WordPress assistant. No tools are currently available. Let the user know they need to wait for abilities to load or check their configuration.`;
	}

	// Build a simple list of available abilities
	const toolsList = tools
		.map( ( tool ) => {
			const label =
				tool.label || tool.id.split( '/' ).pop().replace( /-/g, ' ' );
			const description = tool.description || '';
			return description
				? `- ${ label }: ${ description }`
				: `- ${ label }`;
		} )
		.join( '\n' );

	return `You are a WordPress assistant. You can help users with questions about WordPress and suggest available tools.

Available abilities:
${ toolsList }

When users ask questions:
- Answer helpfully and conversationally
- If they need data from their site, suggest which tool can help them
- Be specific about what each tool does
- Don't pretend to have data you don't have

Examples:
User: "What is a transient?"
You: "A transient is temporary cached data in WordPress that's stored in the database with an expiration time. Plugins use them to cache API responses and expensive queries. If you need to clear expired transients, I have a 'Clear Transients' tool."

User: "How do I check my site's health?"
You: "I have a 'Site Health' tool that can run comprehensive diagnostics on your WordPress site. It checks database health, file permissions, plugin compatibility, and more. Would you like me to run it? Just say 'check site health'."

Be helpful and conversational.`;
}

/**
 * ChatOrchestrator class
 * Coordinates all chat-related services
 */
class ChatOrchestrator {
	/**
	 * Create a new chat orchestrator
	 *
	 * @param {Object} options                 - Configuration options
	 * @param {string} [options.systemPrompt]  - Custom system prompt
	 * @param {Object} [options.llmOptions]    - LLM generation options
	 * @param {Object} [options.streamOptions] - Stream simulator options
	 */
	constructor( options = {} ) {
		this.customSystemPrompt = options.systemPrompt || null;
		this.llmOptions = {
			temperature: 0.2,
			maxTokens: 512,
			...options.llmOptions,
		};
		this.streamOptions = {
			charDelay: 15,
			...options.streamOptions,
		};

		// Services
		this.session = null;
		this.toolRegistry = toolRegistry;
		this.streamSimulator = streamSimulator;
		this.workflowRegistry = workflowRegistry;
		this.workflowOrchestrator = workflowOrchestrator;
		this.messageRouter = messageRouter;
		this.reactAgent = null; // Created on-demand

		// State
		this.modelLoader = modelLoader;
		this.isProcessing = false;
		this.currentAbortController = null;

		// Callbacks
		this.callbacks = {
			onStreamStart: () => {},
			onStreamChunk: () => {},
			onStreamEnd: () => {},
			onToolStart: () => {},
			onToolEnd: () => {},
			onMessageAdd: () => {},
			onError: () => {},
			onStateChange: () => {},
			// Workflow-specific callbacks
			onWorkflowStart: () => {},
			onWorkflowProgress: () => {},
			onWorkflowStepComplete: () => {},
			onWorkflowComplete: () => {},
			onWorkflowFailed: () => {},
		};
	}

	/**
	 * Initialize the orchestrator with a session
	 *
	 * @param {ChatSession} session - Chat session to use
	 */
	initialize( session ) {
		this.session = session;

		// Save the original onChange callback
		const originalOnChange = session.onChange;

		// Wire up session onChange to our callback, but preserve the original
		session.onChange = ( messages, newMessage ) => {
			// Call the original callback first (for persistence, etc.)
			if ( originalOnChange ) {
				originalOnChange( messages, newMessage );
			}
			// Then call our orchestrator callback
			this.callbacks.onMessageAdd( messages, newMessage );
		};

		log.info( 'Initialized with session:', session.id );
	}

	/**
	 * Build usage stats meta for attaching to assistant messages.
	 *
	 * @return {Object} Meta object with usage stats, or empty object.
	 */
	getUsageStatsMeta() {
		const stats = this.modelLoader.getLastUsageStats();
		if ( ! stats ) {
			return {};
		}
		const meta = {};
		if ( stats.extra?.prefill_tokens_per_s ) {
			meta.prefillTps = parseFloat(
				stats.extra.prefill_tokens_per_s.toFixed( 1 )
			);
		}
		if ( stats.extra?.decode_tokens_per_s ) {
			meta.decodeTps = parseFloat(
				stats.extra.decode_tokens_per_s.toFixed( 1 )
			);
		}
		return meta;
	}

	/**
	 * Get the current system prompt
	 * Uses custom prompt if provided, otherwise builds dynamically from registered tools
	 *
	 * @return {string} The system prompt for conversational mode.
	 */
	getSystemPrompt() {
		return this.customSystemPrompt || buildSystemPrompt();
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
	 * Check if LLM is ready
	 *
	 * @return {boolean} True if the model is loaded and ready.
	 */
	isLLMReady() {
		return modelLoader.isModelReady();
	}

	/**
	 * Process a user message
	 * This is the main entry point for handling user input
	 *
	 * Routing logic:
	 * 1. Check for workflow keyword match → workflow mode
	 * 2. Default to ReAct loop for everything else (actions AND questions)
	 *
	 * @param {string} userMessage - The user's message
	 * @return {Promise<Object>} Result with success status and any errors
	 */
	async processMessage( userMessage ) {
		if ( ! this.session ) {
			throw new Error(
				'ChatOrchestrator not initialized. Call initialize() first.'
			);
		}

		if ( this.isProcessing ) {
			return { success: false, error: 'Already processing a message' };
		}

		this.isProcessing = true;
		this.currentAbortController = new AbortController();
		this.callbacks.onStateChange( { isProcessing: true } );

		try {
			// Add user message to session
			this.session.addUserMessage( userMessage );

			// Route the message
			const route = this.messageRouter.route( userMessage );

			if ( route.type === 'workflow' ) {
				log.info( 'Routing to workflow:', route.workflow.id );
				return await this.processWithWorkflow(
					userMessage,
					route.workflow
				);
			}

			if ( route.type === 'conversational' ) {
				log.info( 'Routing to direct LLM (conversational)' );
				return await this.processWithLLM();
			}

			// Default: ReAct loop for actions
			log.info(
				`Routing to ReAct loop (thinking: ${
					route.disableThinking ? 'off' : 'on'
				})`
			);
			return await this.processWithReact(
				userMessage,
				route.disableThinking,
				route.preloadInstructions
			);
		} catch ( error ) {
			log.error( 'Error processing message:', error );
			this.session.addErrorMessage(
				'An error occurred while processing your message.'
			);
			this.callbacks.onError( error );
			return { success: false, error: error.message };
		} finally {
			this.isProcessing = false;
			this.currentAbortController = null;
			this.callbacks.onStateChange( { isProcessing: false } );
		}
	}

	/**
	 * Process message with ReAct loop
	 *
	 * Uses the ReAct agent to intelligently select and use tools.
	 *
	 * @param {string}   userMessage         - User's message
	 * @param {boolean}  disableThinking     - Whether to disable model thinking
	 * @param {string[]} preloadInstructions - Instruction IDs to preload
	 * @return {Promise<Object>} Result with success status and ReAct execution details.
	 */
	async processWithReact(
		userMessage,
		disableThinking = false,
		preloadInstructions = []
	) {
		if ( ! this.isLLMReady() ) {
			this.session.addAssistantMessage(
				'The AI model is not loaded yet. Please load the model first.'
			);
			return { success: false, error: 'Model not loaded' };
		}

		// Create ReAct agent if not exists
		if ( ! this.reactAgent ) {
			this.reactAgent = new ReactAgent(
				modelLoader,
				toolRegistry,
				{},
				instructionRegistry
			);

			// Wire up callbacks
			this.reactAgent.setCallbacks( {
				onToolStart: ( toolId ) => {
					this.callbacks.onToolStart( toolId );
				},
				onToolEnd: ( toolId, result, success ) => {
					this.callbacks.onToolEnd( toolId, result, success );
					// Add tool result to session
					this.session.addToolResult( toolId, result, success );
				},
				onThinkingStart: () => {
					this.callbacks.onThinkingStart?.();
				},
				onThinkingChunk: ( delta, fullThinkText ) => {
					this.callbacks.onThinkingChunk?.( delta, fullThinkText );
				},
				onThinkingEnd: ( thinkContent ) => {
					if ( thinkContent ) {
						this.session.addThinkingMessage( thinkContent );
					}
					this.callbacks.onThinkingEnd?.( thinkContent );
				},
				onConfirmationRequired: async ( tool ) => {
					return await this.requestConfirmation( tool );
				},
			} );
		}

		// Update thinking mode per-request based on router decision
		this.reactAgent.config.disableThinking = disableThinking;

		// Preload instructions detected by the router
		if ( preloadInstructions && preloadInstructions.length > 0 ) {
			for ( const id of preloadInstructions ) {
				this.reactAgent.activeInstructions.add( id );
			}
			log.info(
				`Preloaded instructions: ${ preloadInstructions.join( ', ' ) }`
			);
		}

		// Execute ReAct loop
		const result = await this.reactAgent.execute(
			userMessage,
			this.session.getConversationHistory()
		);

		// Stream the final answer
		this.callbacks.onStreamStart();
		await this.streamSimulator.stream( result.finalAnswer, {
			...this.streamOptions,
			onChunk: ( char, text ) =>
				this.callbacks.onStreamChunk( char, text ),
		} );
		this.session.addAssistantMessage(
			result.finalAnswer,
			this.getUsageStatsMeta()
		);
		this.callbacks.onStreamEnd( result.finalAnswer );

		log.info(
			`ReAct completed: ${ result.iterations } iterations, ${ result.toolsUsed.length } tools used`
		);

		return {
			success: result.success,
			result,
		};
	}

	/**
	 * Process message with a specific tool (legacy method, kept for workflow support)
	 *
	 * @param {string} userMessage - User's message
	 * @param {Object} tool        - Tool to execute
	 * @param {Object} [intent]    - Intent object (optional, for typo correction context)
	 * @return {Promise<Object>} Result with success status, tool ID, and execution result.
	 */
	async processWithTool( userMessage, tool, intent = null ) {
		// 1. Parse params first (needed to check if confirmation is required)
		const params = tool.parseIntent ? tool.parseIntent( userMessage ) : {};

		// 2. Check if tool requires confirmation
		// requiresConfirmation can be a boolean or a function that takes params
		let needsConfirmation = false;
		if ( typeof tool.requiresConfirmation === 'function' ) {
			needsConfirmation = tool.requiresConfirmation( params );
		} else {
			needsConfirmation = !! tool.requiresConfirmation;
		}

		if ( needsConfirmation ) {
			const confirmed = await this.requestConfirmation( tool );
			if ( ! confirmed ) {
				this.session.addAssistantMessage( 'Action cancelled.' );
				return { success: true, cancelled: true };
			}
		}

		// 2. Stream the initial message
		this.callbacks.onStreamStart();
		await this.streamSimulator.stream( tool.initialMessage, {
			...this.streamOptions,
			onChunk: ( char, text ) =>
				this.callbacks.onStreamChunk( char, text ),
		} );
		this.session.addAssistantMessage( tool.initialMessage );
		this.callbacks.onStreamEnd( tool.initialMessage );

		// 3. Execute the tool
		this.callbacks.onToolStart( tool.id );

		let result;
		let success = true;

		try {
			// Pass userMessage to execute so tools can extract parameters
			result = await tool.execute( { userMessage } );
			this.session.addToolResult( tool.id, result, true );
		} catch ( error ) {
			result = { error: error.message };
			success = false;
			this.session.addToolResult( tool.id, result, false );
		}

		this.callbacks.onToolEnd( tool.id, result, success );

		// 4. Generate summary
		// If LLM is available, use it for contextual responses
		// Otherwise, fall back to the ability's summarize function
		const engine = modelLoader.getEngine();

		if ( engine && success ) {
			// Use LLM to generate contextual summary (pass intent for typo context)
			await this.generateLLMSummary(
				userMessage,
				tool,
				result,
				success,
				intent
			);
		} else {
			// Fallback to canned summary (no LLM or tool failed)
			const summary = success
				? tool.summarize( result, userMessage )
				: `I encountered an error: ${
						result.error || 'Unknown error'
				  }`;

			// Add tool context prefix
			const toolName = this.getToolName( tool );
			const messageWithContext = `• ${ toolName }\n${ summary }`;

			this.callbacks.onStreamStart();
			await this.streamSimulator.stream( messageWithContext, {
				...this.streamOptions,
				charDelay: 10,
				onChunk: ( char, text ) =>
					this.callbacks.onStreamChunk( char, text ),
			} );
			this.session.addAssistantMessage( messageWithContext );
			this.callbacks.onStreamEnd( messageWithContext );
		}

		return { success, toolId: tool.id, result };
	}

	/**
	 * Get tool name for display (label or fallback to ID)
	 *
	 * @param {Object} tool - Tool object
	 * @return {string} Display name
	 */
	getToolName( tool ) {
		return tool.label || tool.id;
	}

	/**
	 * Generate a summary using the LLM
	 *
	 * @param {string}  userMessage - Original user message
	 * @param {Object}  tool        - Tool that was executed
	 * @param {Object}  result      - Tool execution result
	 * @param {boolean} success     - Whether tool succeeded
	 */
	async generateLLMSummary( userMessage, tool, result, success ) {
		const engine = modelLoader.getEngine();
		if ( ! engine ) {
			throw new Error( 'LLM engine not available' );
		}

		// Build a focused prompt for summarization
		let summaryPrompt;
		if ( success ) {
			// Truncate result if too large to fit in context
			const resultStr = JSON.stringify( result, null, 2 );
			const truncatedResult =
				resultStr.length > 1500
					? resultStr.substring( 0, 1500 ) + '...(truncated)'
					: resultStr;

			summaryPrompt = `The user asked: "${ userMessage }"

I ran the "${ tool.label }" tool and got this result:
${ truncatedResult }

Answer ONLY what the user asked. Be concise and specific. Do not include extra information they didn't ask for.`;
		} else {
			summaryPrompt = `The user asked: "${ userMessage }"

I tried to run the "${ tool.label }" tool but it failed with error: ${ result.error }

Explain what went wrong and suggest what the user might try next.`;
		}

		// Use a simple, focused system prompt for summarization
		const summarySystemPrompt =
			"You are a helpful WordPress assistant. Your job is to summarize tool results clearly and concisely. Answer the user's question based on the data provided.";

		const messages = [
			{ role: 'system', content: summarySystemPrompt },
			{ role: 'user', content: summaryPrompt },
		];

		// Stream from LLM
		this.callbacks.onStreamStart();
		let fullResponse = '';

		try {
			const stream = await engine.chat.completions.create( {
				messages,
				temperature: 0.3, // Lower temperature for more factual summaries
				max_tokens: this.llmOptions.maxTokens,
				stream: true,
				stream_options: { include_usage: true },
				stop: [ 'User:', 'USER:', '\n\nUser' ],
			} );

			for await ( const chunk of stream ) {
				if ( this.currentAbortController?.signal.aborted ) {
					break;
				}

				const delta = chunk.choices[ 0 ]?.delta?.content || '';
				fullResponse += delta;
				this.callbacks.onStreamChunk( delta, fullResponse );

				// Capture usage stats from the final chunk
				if ( chunk.usage ) {
					log.debug( 'Tool summary usage stats:', chunk.usage );
					modelLoader.updateUsageStats( chunk.usage );
				}
			}

			// Add tool context prefix to help LLM recognize completed actions
			const toolName = this.getToolName( tool );
			const messageWithContext = `• ${ toolName }\n${ fullResponse }`;
			this.session.addAssistantMessage(
				messageWithContext,
				this.getUsageStatsMeta()
			);
			this.callbacks.onStreamEnd( fullResponse );
		} catch ( error ) {
			log.error( 'LLM summary error:', error );
			// Fallback to canned summary on error
			const fallbackSummary = success
				? tool.summarize( result, userMessage )
				: 'I encountered an error while trying to help.';

			// Add tool context prefix
			const toolName = this.getToolName( tool );
			const messageWithContext = `• ${ toolName }\n${ fallbackSummary }`;
			this.session.addAssistantMessage( messageWithContext );
			this.callbacks.onStreamEnd( fallbackSummary );
		}
	}

	/**
	 * Detect if LLM output contains hallucinated tool results
	 *
	 * @param {string} response - LLM response text
	 * @return {boolean} True if hallucination detected
	 */
	detectHallucinatedToolResult( response ) {
		// Check for common hallucination patterns
		const hallucinationPatterns = [
			/\[Tool Result from [^\]]+\]/i, // [Tool Result from ...]
			/\{[\s\n]*"(success|data|result)"/i, // JSON objects at start
			/Analyzing|Checking|Processing\.\.\./i, // Tool-like initial messages
		];

		return hallucinationPatterns.some( ( pattern ) =>
			pattern.test( response )
		);
	}

	/**
	 * Process message with pure LLM (no tool)
	 *
	 * @return {Promise<Object>} Result with success status and LLM response text.
	 */
	async processWithLLM() {
		if ( ! this.isLLMReady() ) {
			this.session.addAssistantMessage(
				'The AI model is not loaded yet. Please load the model first.'
			);
			return { success: false, error: 'Model not loaded' };
		}

		const engine = modelLoader.getEngine();
		if ( ! engine ) {
			throw new Error( 'LLM engine not available' );
		}

		// Build messages for LLM
		const messages = [
			{ role: 'system', content: this.getSystemPrompt() },
			...this.session.getConversationHistory(),
		];

		// Stream from LLM
		this.callbacks.onStreamStart();
		let fullResponse = '';
		let inThinkBlock = false; // Track <think> blocks
		let thinkContent = ''; // Accumulated thinking content

		try {
			const stream = await engine.chat.completions.create( {
				messages,
				temperature: this.llmOptions.temperature,
				max_tokens: this.llmOptions.maxTokens,
				stream: true,
				stream_options: { include_usage: true },
				stop: [ 'User:', 'USER:', '\n\nUser' ],
			} );

			for await ( const chunk of stream ) {
				if ( this.currentAbortController?.signal.aborted ) {
					break;
				}

				const delta = chunk.choices[ 0 ]?.delta?.content || '';
				fullResponse += delta;

				// Stream <think> blocks to the UI as thinking indicators.
				// Qwen 3 outputs <think>...</think> before the actual response.
				if (
					fullResponse.includes( '<think>' ) &&
					! fullResponse.includes( '</think>' )
				) {
					if ( ! inThinkBlock ) {
						inThinkBlock = true;
						this.callbacks.onThinkingStart?.();
					}
					// Extract thinking content so far (after <think> tag)
					const thinkStart = fullResponse.indexOf( '<think>' ) + 7;
					thinkContent = fullResponse.substring( thinkStart ).trim();
					this.callbacks.onThinkingChunk?.( delta, thinkContent );
					// Capture usage stats from the final chunk
					if ( chunk.usage ) {
						log.debug( 'Usage stats:', chunk.usage );
						modelLoader.updateUsageStats( chunk.usage );
					}
					continue;
				}
				if ( inThinkBlock && fullResponse.includes( '</think>' ) ) {
					inThinkBlock = false;
					// Extract final thinking content
					const thinkMatch = fullResponse.match(
						/<think>([\s\S]*?)<\/think>/
					);
					thinkContent = thinkMatch
						? thinkMatch[ 1 ].trim()
						: thinkContent;
					// Persist thinking to session and notify UI
					this.session.addThinkingMessage( thinkContent );
					this.callbacks.onThinkingEnd?.( thinkContent );
					// Strip think block and stream the clean content so far
					const cleanResponse = fullResponse
						.replace( /<think>[\s\S]*?<\/think>\s*/g, '' )
						.trim();
					this.callbacks.onStreamChunk( '', cleanResponse );
					// Capture usage stats from the final chunk
					if ( chunk.usage ) {
						log.debug( 'Usage stats:', chunk.usage );
						modelLoader.updateUsageStats( chunk.usage );
					}
					continue;
				}

				if ( ! inThinkBlock ) {
					this.callbacks.onStreamChunk( delta, fullResponse );
				}

				// Capture usage stats from the final chunk
				if ( chunk.usage ) {
					log.debug( 'Usage stats:', chunk.usage );
					modelLoader.updateUsageStats( chunk.usage );
				}
			}

			// Strip any remaining think blocks from the final response
			fullResponse = fullResponse
				.replace( /<think>[\s\S]*?<\/think>\s*/g, '' )
				.trim();
			// Handle incomplete think block (model ran out of tokens)
			if ( fullResponse.startsWith( '<think>' ) ) {
				// Persist and end thinking even if incomplete
				if ( inThinkBlock && thinkContent ) {
					this.session.addThinkingMessage( thinkContent );
					this.callbacks.onThinkingEnd?.( thinkContent );
				}
				fullResponse = '';
			}

			// Detect and filter hallucinated tool results
			const hallucinationDetected =
				this.detectHallucinatedToolResult( fullResponse );
			if ( hallucinationDetected ) {
				log.warn(
					'Detected hallucinated tool result, replacing with helpful message'
				);
				fullResponse =
					"I don't have an ability to do that. I can help you with:\n\n" +
					toolRegistry
						.getAll()
						.map( ( t ) => `- ${ t.label || t.id }` )
						.join( '\n' );
			}

			this.session.addAssistantMessage(
				fullResponse,
				this.getUsageStatsMeta()
			);
			this.callbacks.onStreamEnd( fullResponse );

			return { success: true, response: fullResponse };
		} catch ( error ) {
			log.error( 'LLM error:', error );
			throw error;
		}
	}

	/**
	 * Process message with a registered workflow
	 *
	 * @param {string} userMessage - User's message
	 * @param {Object} workflow    - Workflow definition from registry
	 * @return {Promise<Object>} Result with success status, workflow ID, and execution details.
	 */
	async processWithWorkflow( userMessage, workflow ) {
		log.info( `Executing workflow: ${ workflow.id }` );

		// Set up workflow callbacks
		this.workflowOrchestrator.setCallbacks( {
			onWorkflowStart: ( wf, state ) => {
				this.callbacks.onWorkflowStart( wf, state );
			},
			onStepStart: () => {
				// Don't trigger single-tool UI during workflows - we have workflow progress UI instead
			},
			onStepComplete: ( stepResult ) => {
				this.callbacks.onWorkflowStepComplete( stepResult );
				this.session.addToolResult(
					stepResult.abilityId,
					stepResult.result,
					stepResult.success
				);
			},
			onStepFailed: () => {
				// No need to call onToolEnd - workflow UI handles this
			},
			onRollbackStart: () => {
				log.info( 'Rollback started' );
			},
			onRollbackComplete: ( results ) => {
				log.info( 'Rollback completed:', results );
			},
			onWorkflowComplete: ( result ) => {
				this.callbacks.onWorkflowComplete( result );
			},
			onWorkflowFailed: ( result ) => {
				this.callbacks.onWorkflowFailed( result );
			},
			onProgress: ( progress ) => {
				this.callbacks.onWorkflowProgress( progress );
			},
			onConfirmationRequired: async ( item, details ) => {
				return this.requestWorkflowConfirmation( item, details );
			},
		} );

		// Add initial message (no fake typing - just show it)
		const initialMessage = `I'll help you with "${ workflow.label }". This involves ${ workflow.steps.length } steps.`;
		this.session.addAssistantMessage( initialMessage );

		// Execute the workflow
		const result = await this.workflowOrchestrator.execute( workflow, {
			userMessage,
		} );

		// Generate summary
		await this.generateWorkflowSummary( userMessage, workflow, result );

		return {
			success: result.success,
			workflowId: workflow.id,
			result,
		};
	}

	/**
	 * Generate a summary for workflow results
	 *
	 * Uses the workflow's custom summarize function which extracts
	 * specific data from results. Falls back to default summary.
	 *
	 * @param {string} userMessage - Original user message
	 * @param {Object} workflow    - Workflow that was executed
	 * @param {Object} result      - Workflow result
	 */
	async generateWorkflowSummary( userMessage, workflow, result ) {
		// Use the pre-computed summary from the workflow's summarize function
		// This contains the specific, data-driven summary we want to show
		const summary = result.success
			? result.summary
			: `Workflow failed: ${ result.error?.message || 'Unknown error' }${
					result.rolledBack ? ' (changes rolled back)' : ''
			  }`;

		// Stream the summary with typewriter effect
		this.callbacks.onStreamStart();
		await this.streamSimulator.stream( summary, {
			...this.streamOptions,
			charDelay: 8, // Slightly faster for summaries
			onChunk: ( char, text ) =>
				this.callbacks.onStreamChunk( char, text ),
		} );
		this.session.addAssistantMessage( summary );
		this.callbacks.onStreamEnd( summary );
	}

	/**
	 * Request confirmation for workflow execution
	 *
	 * @param {Object} item    - Workflow or step requiring confirmation
	 * @param {Object} details - Confirmation details
	 * @return {Promise<boolean>} True if user confirmed, false if cancelled.
	 */
	async requestWorkflowConfirmation( item, details ) {
		// Use the same confirmation handler as single tools
		// but with enhanced details for workflows
		log.info( 'Workflow confirmation requested:', details );
		return this.requestConfirmation( {
			...item,
			confirmationMessage:
				details.message ||
				`Proceed with ${ details.totalSteps || 1 } operations?`,
			isWorkflow: true,
			workflowDetails: details,
		} );
	}

	/**
	 * Request confirmation for destructive actions
	 *
	 * @return {Promise<boolean>} True if confirmed, false if rejected.
	 */
	async requestConfirmation() {
		// This should be implemented by the UI layer
		// Default implementation returns true (auto-confirm)
		log.warn( 'No confirmation handler set, auto-confirming' );
		return true;
	}

	/**
	 * Set custom confirmation handler
	 *
	 * @param {Function} handler - Async function that returns boolean
	 */
	setConfirmationHandler( handler ) {
		this.requestConfirmation = handler;
	}

	/**
	 * Abort current processing
	 */
	abort() {
		if ( this.currentAbortController ) {
			this.currentAbortController.abort();
		}
		// Also abort any running workflow
		if ( this.workflowOrchestrator.isRunning() ) {
			this.workflowOrchestrator.abort();
		}
		this.streamSimulator.abort();
		this.isProcessing = false;
		this.callbacks.onStateChange( { isProcessing: false } );
	}

	/**
	 * Clear the chat session
	 */
	clearSession() {
		if ( this.session ) {
			this.session.clear();
		}
	}

	/**
	 * Save the current session
	 *
	 * @return {boolean} True if session was saved successfully.
	 */
	saveSession() {
		return this.session?.save() || false;
	}

	/**
	 * Load a saved session
	 *
	 * @return {boolean} True if session was loaded successfully.
	 */
	loadSession() {
		return this.session?.load() || false;
	}

	/**
	 * Get current processing state
	 *
	 * @return {boolean} True if currently processing a message.
	 */
	getIsProcessing() {
		return this.isProcessing;
	}

	/**
	 * Get the current session
	 *
	 * @return {ChatSession|null} The current chat session or null if not initialized.
	 */
	getSession() {
		return this.session;
	}
}

// Create singleton instance
const chatOrchestrator = new ChatOrchestrator();

export { ChatOrchestrator, chatOrchestrator, buildSystemPrompt };
export default chatOrchestrator;
