/**
 * ReAct Agent
 *
 * Implements the ReAct (Reasoning + Acting) pattern where the LLM:
 * 1. Reasons about what to do next
 * 2. Selects a tool (via function calling OR prompt-based JSON)
 * 3. Observes the result
 * 4. Repeats until task is complete
 *
 * Supports two modes:
 * - Function calling (for Hermes models)
 * - Prompt-based JSON (for Qwen, Flash, and other models)
 *
 * @since 0.1.0
 */

import { createLogger } from '../utils/logger';

const log = createLogger('ReactAgent');

/**
 * ReAct Agent Configuration
 */
const REACT_CONFIG = {
    maxIterations: 10,           // Safety limit to prevent infinite loops
    temperature: 0.4,            // Balanced: predictable tool selection + natural responses
    maxTokens: 512,              // Enough for reasoning + function call
    confirmationTimeout: 30000,  // 30s timeout for user confirmations
    maxToolResultLength: 1000,   // Max characters for tool results (prevent context overflow)
};

/**
 * @typedef {Object} ReactResult
 * @property {boolean} success - Whether the task completed successfully
 * @property {string} finalAnswer - The final response to show the user
 * @property {number} iterations - Number of reasoning loops executed
 * @property {string[]} toolsUsed - Array of tool IDs that were called
 * @property {Object[]} observations - Array of tool results
 * @property {string} [error] - Error message if failed
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
     * @param {Object} modelLoader - ModelLoader instance for LLM access
     * @param {Object} toolRegistry - ToolRegistry instance for available tools
     * @param {Object} options - Configuration options
     */
    constructor(modelLoader, toolRegistry, options = {}) {
        this.modelLoader = modelLoader;
        this.toolRegistry = toolRegistry;
        this.config = { ...REACT_CONFIG, ...options };
        this.useFunctionCalling = null; // Auto-detect on first run

        // Callbacks for UI integration
        this.callbacks = {
            onToolStart: () => { },
            onToolEnd: () => { },
            onConfirmationRequired: async () => true, // Default: auto-confirm
        };
    }

    /**
     * Set callbacks for UI integration
     *
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks) {
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
     * Automatically detects and uses function calling or prompt-based approach.
     *
     * @param {string} userMessage - The user's request
     * @param {Array} conversationHistory - Previous messages (for context)
     * @return {Promise<ReactResult>}
     */
    async execute(userMessage, conversationHistory = []) {
        log.info('Starting ReAct loop for:', userMessage);

        const engine = this.modelLoader.getEngine();
        if (!engine) {
            return {
                success: false,
                finalAnswer: 'The AI model is not loaded yet. Please load the model first.',
                iterations: 0,
                toolsUsed: [],
                observations: [],
                error: 'Model not loaded',
            };
        }

        // Try function calling first if not yet determined
        if (this.useFunctionCalling === null) {
            try {
                log.info('Testing function calling support...');
                const testResponse = await engine.chat.completions.create({
                    messages: [{ role: 'user', content: 'test' }],
                    tools: [{ type: 'function', function: { name: 'test', description: 'test' } }],
                    tool_choice: 'none',
                    max_tokens: 1,
                });
                this.useFunctionCalling = true;
                log.info('Function calling supported - using native function calling mode');
            } catch (error) {
                const errorMessage = error?.message || String(error);
                if (errorMessage.includes('not supported for ChatCompletionRequest.tools')) {
                    this.useFunctionCalling = false;
                    log.info('Function calling not supported - using prompt-based mode');
                } else {
                    log.error('Function calling test failed with unexpected error:', error);
                    throw error; // Re-throw unexpected errors
                }
            }
        }

        // Route to appropriate execution mode
        if (this.useFunctionCalling) {
            return await this.executeWithFunctionCalling(userMessage, conversationHistory);
        } else {
            return await this.executeWithPromptBased(userMessage, conversationHistory);
        }
    }

    /**
     * Execute ReAct loop using native function calling
     *
     * @param {string} userMessage - The user's request
     * @param {Array} conversationHistory - Previous messages
     * @return {Promise<ReactResult>}
     */
    async executeWithFunctionCalling(userMessage, conversationHistory) {
        const engine = this.modelLoader.getEngine();
        const systemPrompt = this.buildSystemPromptFunctionCalling();
        const toolDefinitions = this.buildToolDefinitions();

        const observations = [];
        const toolsUsed = [];
        let iteration = 0;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userMessage },
        ];

        while (iteration < this.config.maxIterations) {
            iteration++;
            log.debug(`ReAct iteration ${iteration}/${this.config.maxIterations} (function calling mode)`);

            try {
                const response = await engine.chat.completions.create({
                    messages,
                    tools: toolDefinitions,
                    tool_choice: 'auto',
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                });

                const choice = response.choices[0];
                const message = choice.message;

                // Case 1: LLM wants to call a tool
                if (message.tool_calls && message.tool_calls.length > 0) {
                    const toolCall = message.tool_calls[0];
                    const toolName = toolCall.function.name;
                    const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

                    log.info(`LLM called tool: ${toolName}`, toolArgs);

                    const toolResult = await this.executeTool(toolName, toolArgs, userMessage);

                    // TODO Hackathon: Smaller models (1.5B-3B) struggle with error recovery when tools fail.
                    // Example: "show errors and deactivate broken plugin" test revealed:
                    // 1. Model correctly identified "broken-plugin" from error logs
                    // 2. Tool returned {success: false, message: "Plugin not found"}
                    // 3. Model then hallucinated wrong tool name (wp-agentic_admin vs wp-agentic-admin)
                    // 4. Repeated call detection stopped loop, but final answer was generic fallback
                    // Future work should explore:
                    // - Explicit error handling instructions in system prompt
                    // - Teaching model to explain failures clearly to users
                    // - Early exit patterns when tools return {success: false}
                    // - Better "tool not found" vs "tool failed" distinction
                    // The model needs clearer guidance on: "If tool fails, explain why to user, don't retry"

                    toolsUsed.push(toolName);
                    observations.push({ tool: toolName, args: toolArgs, result: toolResult });

                    messages.push({
                        role: 'assistant',
                        content: null,
                        tool_calls: [toolCall],
                    });
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult),
                    });

                    continue;
                }

                // Case 2: LLM provided final answer
                if (message.content) {
                    log.info('LLM provided final answer');
                    return {
                        success: true,
                        finalAnswer: message.content,
                        iterations: iteration,
                        toolsUsed,
                        observations,
                    };
                }

                // Case 3: Unexpected response
                log.warn('Unexpected LLM response (no content or tool calls)');
                return {
                    success: false,
                    finalAnswer: 'I encountered an issue and cannot complete this task.',
                    iterations: iteration,
                    toolsUsed,
                    observations,
                    error: 'Empty LLM response',
                };

            } catch (error) {
                const errorMessage = error?.message || String(error);

                // Handle context window exceeded
                if (errorMessage.includes('ContextWindowSizeExceededError') ||
                    errorMessage.includes('context window size')) {
                    log.error('Context window exceeded. Providing summary of what we found so far.');

                    const summary = this.buildSummaryFromObservations(observations, userMessage);
                    return {
                        success: true,
                        finalAnswer: summary,
                        iterations: iteration,
                        toolsUsed,
                        observations,
                        error: 'Context window exceeded (handled gracefully)',
                    };
                }

                log.error('ReAct loop error:', error);
                return {
                    success: false,
                    finalAnswer: `I encountered an error: ${errorMessage}`,
                    iterations: iteration,
                    toolsUsed,
                    observations,
                    error: errorMessage,
                };
            }
        }

        // Max iterations reached
        log.warn('Max iterations reached');
        return {
            success: false,
            finalAnswer: 'I reached the maximum number of steps. Please try rephrasing your request or break it into smaller tasks.',
            iterations: iteration,
            toolsUsed,
            observations,
            error: 'Max iterations exceeded',
        };
    }

    /**
     * Execute ReAct loop using prompt-based JSON tool selection
     *
     * Works with any LLM that can output JSON (Qwen, Flash, etc.)
     *
     * @param {string} userMessage - The user's request
     * @param {Array} conversationHistory - Previous messages
     * @return {Promise<ReactResult>}
     */
    async executeWithPromptBased(userMessage, conversationHistory) {
        const engine = this.modelLoader.getEngine();
        const systemPrompt = this.buildSystemPromptPromptBased();

        const observations = [];
        const toolsUsed = [];
        let iteration = 0;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userMessage },
        ];

        while (iteration < this.config.maxIterations) {
            iteration++;
            log.debug(`ReAct iteration ${iteration}/${this.config.maxIterations} (prompt-based mode)`);

            try {
                const response = await engine.chat.completions.create({
                    messages,
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                });

                const content = response.choices[0]?.message?.content || '';
                log.debug('LLM response:', content);

                // Parse JSON response
                const action = this.parseActionFromResponse(content);

                if (!action) {
                    // Fallback: If LLM outputs plain text (no JSON), treat it as final answer
                    log.warn('LLM output plain text instead of JSON, treating as final answer');
                    log.debug('Plain text response:', content);

                    // If we've already used tools and LLM is responding naturally, accept it
                    if (toolsUsed.length > 0) {
                        return {
                            success: true,
                            finalAnswer: content,
                            iterations: iteration,
                            toolsUsed,
                            observations,
                        };
                    }

                    // If no tools used yet, this is an error
                    return {
                        success: false,
                        finalAnswer: 'I had trouble understanding how to help. Could you rephrase your request?',
                        iterations: iteration,
                        toolsUsed,
                        observations,
                        error: 'Failed to parse LLM response',
                    };
                }

                // Case 1: Tool call
                if (action.action === 'tool_call') {
                    const toolName = action.tool;
                    const toolArgs = action.args || {};

                    log.info(`LLM requested tool: ${toolName}`, toolArgs);

                    // Detect repeated tool calls (same tool twice in a row)
                    if (toolsUsed.length > 0 && toolsUsed[toolsUsed.length - 1] === toolName) {
                        log.warn(`Detected repeated tool call: ${toolName}. Stopping loop and summarizing results.`);

                        // Build a helpful summary from what we gathered
                        const summary = this.buildSummaryFromObservations(observations, userMessage);

                        return {
                            success: true, // We got data, so this is a success
                            finalAnswer: summary,
                            iterations: iteration,
                            toolsUsed,
                            observations,
                            error: 'Repeated tool call detected (handled gracefully)',
                        };
                    }

                    const toolResult = await this.executeTool(toolName, toolArgs, userMessage);

                    // TODO Hackathon: Same error recovery issue as function calling mode.
                    // See the TODO in executeWithFunctionCalling() for details on how smaller models
                    // struggle to handle tool failures gracefully and hallucinate invalid tool names.

                    toolsUsed.push(toolName);
                    observations.push({ tool: toolName, args: toolArgs, result: toolResult });

                    // Truncate result if too large (prevent context window overflow)
                    const resultStr = JSON.stringify(toolResult);
                    const truncatedResult = resultStr.length > this.config.maxToolResultLength
                        ? resultStr.substring(0, this.config.maxToolResultLength) + '...[truncated]'
                        : resultStr;

                    // Add observation to conversation with JSON format reminder
                    messages.push({
                        role: 'assistant',
                        content: content, // Keep the original JSON response
                    });
                    messages.push({
                        role: 'user',
                        content: `Tool result: ${truncatedResult}\n\nRemember: Respond with ONLY a JSON object. Either call another tool or provide final_answer.`,
                    });

                    continue;
                }

                // Case 2: Final answer
                if (action.action === 'final_answer') {
                    log.info('LLM provided final answer');
                    return {
                        success: true,
                        finalAnswer: action.content || action.answer || 'Task completed.',
                        iterations: iteration,
                        toolsUsed,
                        observations,
                    };
                }

                // Case 3: Unknown action
                log.warn('Unknown action type:', action.action);
                return {
                    success: false,
                    finalAnswer: 'I encountered an issue processing your request.',
                    iterations: iteration,
                    toolsUsed,
                    observations,
                    error: 'Unknown action type',
                };

            } catch (error) {
                const errorMessage = error?.message || String(error);

                // Handle context window exceeded
                if (errorMessage.includes('ContextWindowSizeExceededError') ||
                    errorMessage.includes('context window size')) {
                    log.error('Context window exceeded. Providing summary of what we found so far.');

                    // Build a summary from observations
                    const summary = this.buildSummaryFromObservations(observations, userMessage);
                    return {
                        success: true,
                        finalAnswer: summary,
                        iterations: iteration,
                        toolsUsed,
                        observations,
                        error: 'Context window exceeded (handled gracefully)',
                    };
                }

                log.error('ReAct loop error:', error);
                return {
                    success: false,
                    finalAnswer: `I encountered an error: ${errorMessage}`,
                    iterations: iteration,
                    toolsUsed,
                    observations,
                    error: errorMessage,
                };
            }
        }

        // Max iterations reached
        log.warn('Max iterations reached');
        return {
            success: false,
            finalAnswer: 'I reached the maximum number of steps. Please try rephrasing your request or break it into smaller tasks.',
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
     * @param {string} userMessage - Original user message
     * @return {string} Summary message
     */
    buildSummaryFromObservations(observations, userMessage) {
        if (observations.length === 0) {
            return 'I tried to help but encountered an issue before gathering any information.';
        }

        // Try to build a helpful summary from the last observation
        const lastObs = observations[observations.length - 1];
        const toolName = lastObs.tool.split('/').pop().replace(/-/g, ' ');

        // Extract data from the result
        if (lastObs.result?.success && lastObs.result?.data) {
            const data = lastObs.result.data;

            // Try to summarize based on the data structure
            if (data.entries && Array.isArray(data.entries)) {
                // Error log or similar list data
                // TODO Hackathon: Improve error log output to show the last 3 entries of type "error"
                // (or just the last 3 if no "error" type entries exist). This provides more
                // relevant recent errors instead of showing the first few which might be older.
                const count = data.entries.length;
                const sample = data.entries.slice(0, 3).join('\n');
                return `I found ${count} entries from the ${toolName}. Here are the first few:\n\n${sample}\n\n${count > 3 ? `...and ${count - 3} more entries.` : ''}`;
            } else if (data.plugins && Array.isArray(data.plugins)) {
                // Plugin list
                const count = data.plugins.length;
                const names = data.plugins.slice(0, 5).map(p => p.name || p).join(', ');
                return `Found ${count} plugins: ${names}${count > 5 ? ', and more...' : ''}`;
            } else if (typeof data === 'object') {
                // Generic object - show key summary
                const keys = Object.keys(data).slice(0, 5).join(', ');
                return `I gathered ${toolName} data with information about: ${keys}.`;
            }
        }

        // Fallback to generic message
        const toolNames = observations.map(obs => obs.tool.split('/').pop().replace(/-/g, ' ')).join(', ');
        return `I gathered information using: ${toolNames}. However, I encountered an issue summarizing the results. The data has been collected successfully.`;
    }

    /**
     * Parse action from LLM response
     *
     * Extracts the FIRST valid JSON object from response text.
     * Handles cases where LLM outputs multiple JSON objects or wraps in markdown.
     *
     * TODO Hackathon: Small models (1.5B-3B) struggle significantly with JSON output formatting.
     * Multiple issues encountered during testing:
     *
     * 1. **Unescaped control characters**: Models include raw \n, \t in JSON strings
     *    Example: {"args": {"reason": "Clean up\ndatabase"}}
     *    Fix: Sanitize control characters before parsing
     *
     * 2. **Missing quotes around property values**: "args:{} instead of "args": {}
     *    Example: {"action": "tool_call", "args:{}}
     *    Fix: Regex to add missing quotes and spaces
     *
     * 3. **Multiple JSON objects at once**: Model tries to output 2+ actions simultaneously
     *    Example: {"action": "tool_call", ...}{"action": "final_answer", ...}
     *    Fix: Brace-counting to extract only FIRST object
     *
     * 4. **Single quotes instead of double**: {'action': 'tool_call'}
     *    Fix: Replace all single quotes with double quotes
     *
     * 5. **Trailing commas**: {"action": "tool_call",}
     *    Fix: Remove commas before closing braces/brackets
     *
     * Test case "clean up database and check health after" revealed:
     * - Model successfully called db-optimize
     * - On second iteration, output raw JSON that wasn't parsed correctly
     * - Result: Raw JSON appeared in final answer instead of executing site-health
     *
     * Future work should explore:
     * - Stricter JSON schema enforcement in system prompt
     * - More explicit single-action-only instructions with repetition
     * - Few-shot examples showing exact JSON format for each iteration
     * - Post-processing to detect and re-parse failed JSON outputs
     * - Consider JSON repair libraries for extreme cases
     * - Alternative: Teach model to use simpler text-based action format instead of JSON
     *
     * The current sanitization catches most issues but small models fundamentally
     * struggle with structured output. Larger models (7B+) or fine-tuning may be needed
     * for reliable JSON generation.
     *
     * @param {string} content - LLM response content
     * @return {Object|null} Parsed action or null if invalid
     */
    parseActionFromResponse(content) {
        try {
            let text = content.trim();

            // Remove markdown code blocks if present
            if (text.startsWith('```json')) {
                text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            // Sanitize control characters that break JSON parsing
            // Small models (1.5B-3B) sometimes include unescaped newlines/tabs in JSON strings
            // Example: {"action": "tool_call", "args": {"reason": "Clean up\ndatabase"}}
            // This regex removes control characters (0x00-0x1F) except tab, newline, carriage return
            // which we'll handle by replacing with spaces
            text = text.replace(/[\x00-\x1F]/g, (match) => {
                // Replace newlines, tabs, carriage returns with space
                if (match === '\n' || match === '\r' || match === '\t') {
                    return ' ';
                }
                // Remove other control characters
                return '';
            });

            // Try to fix common JSON syntax issues from small models
            // 1. Single quotes to double quotes
            // 2. Remove trailing commas before } or ]
            // 3. Fix property names missing closing quotes (e.g., "args:{} → "args": {})
            let jsonText = text
                .replace(/'/g, '"')  // Single quotes to double quotes
                .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
                .replace(/"(\w+):([^"])/g, '"$1": $2');  // Fix missing quote+space: "args:{} → "args": {}

            // Try to parse the whole thing first (in case it's clean JSON)
            try {
                const action = JSON.parse(jsonText);
                if (action.action) {
                    return action;
                }
            } catch (e) {
                // Not clean JSON, continue with extraction
                log.debug('Initial JSON parse failed:', e.message);
            }

            // Extract first valid JSON object by counting braces
            const firstBrace = jsonText.indexOf('{');
            if (firstBrace === -1) {
                log.warn('No JSON object found in response');
                log.error('Full response after sanitization:', jsonText);
                return null;
            }

            // Count braces to find the matching closing brace
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;

            for (let i = firstBrace; i < jsonText.length; i++) {
                const char = jsonText[i];

                // Handle string boundaries (don't count braces inside strings)
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    escapeNext = false;
                    continue;
                }

                if (char === '\\' && inString) {
                    escapeNext = !escapeNext;
                    continue;
                }

                escapeNext = false;

                if (inString) {
                    continue; // Skip characters inside strings
                }

                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;

                    // Found matching closing brace
                    if (braceCount === 0) {
                        const jsonStr = jsonText.substring(firstBrace, i + 1);
                        try {
                            const action = JSON.parse(jsonStr);

                            // Validate action structure
                            if (!action.action) {
                                log.warn('Action missing "action" field');
                                return null;
                            }

                            return action;
                        } catch (parseError) {
                            log.error('Failed to parse extracted JSON:', parseError.message);
                            log.error('Extracted JSON string:', jsonStr);
                            return null;
                        }
                    }
                }
            }

            log.warn('Could not find complete JSON object');
            return null;

        } catch (error) {
            log.error('JSON parse error:', error);
            log.error('Original content:', content);
            log.error('After sanitization:', content.replace(/[\x00-\x1F]/g, (m) => m === '\n' || m === '\r' || m === '\t' ? ' ' : ''));
            return null;
        }
    }

    /**
     * Execute a single tool
     *
     * @param {string} toolId - Tool ID
     * @param {Object} args - Tool arguments
     * @param {string} userMessage - Original user message
     * @return {Promise<Object>} Tool result
     */
    async executeTool(toolId, args, userMessage) {
        const tool = this.toolRegistry.get(toolId);

        if (!tool) {
            log.error('Tool not found:', toolId);
            return {
                success: false,
                error: `Tool "${toolId}" not found`,
            };
        }

        // Check if confirmation is required
        if (tool.requiresConfirmation) {
            const confirmed = await this.requestConfirmation(tool, args);
            if (!confirmed) {
                log.info('User cancelled tool execution:', toolId);
                return {
                    success: false,
                    error: 'User cancelled action',
                    cancelled: true,
                };
            }
        }

        // Notify UI that tool is starting
        this.callbacks.onToolStart(toolId);

        try {
            // Execute the tool
            const result = await tool.execute({ userMessage, ...args });

            this.callbacks.onToolEnd(toolId, result, true);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            log.error('Tool execution error:', error);

            this.callbacks.onToolEnd(toolId, { error: error.message }, false);

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
    async requestConfirmation(tool, args) {
        log.info('Requesting confirmation for:', tool.id, args);

        try {
            const confirmed = await Promise.race([
                this.callbacks.onConfirmationRequired(tool, args),
                new Promise((resolve) =>
                    setTimeout(() => resolve(false), this.config.confirmationTimeout)
                ),
            ]);

            return !!confirmed;
        } catch (error) {
            log.error('Confirmation error:', error);
            return false;
        }
    }

    /**
     * Build system prompt for function calling mode
     *
     * TODO Hackathon: Smaller models (1.5B-3B) tend to be over-eager with tool calling,
     * often calling multiple tools when only one is needed (e.g., "flush cache" calls both
     * cache-flush AND transient-flush). Future work should explore simplistic verbal
     * techniques to help smaller models understand intent better:
     * - Language simplification and more explicit instructions
     * - Semantic restructuring with clearer action boundaries
     * - Synonym usage and repetition for key concepts
     * - More constrained examples showing single-tool patterns
     * - Explicit "stop after success" instructions
     * The goal is to find verbal/prompt engineering tricks that work better with limited
     * model capacity, rather than relying on larger models to "figure it out."
     *
     * @return {string} System prompt
     */
    buildSystemPromptFunctionCalling() {
        const tools = this.toolRegistry.getAll();

        return `You are a WordPress assistant that helps users by calling available tools one at a time.

AVAILABLE TOOLS: You have access to ${tools.length} tools via function calling.

HOW TO WORK:
1. Understand what the user wants
2. Call ONE tool at a time using function calling
3. See the result
4. Decide if you need another tool, or if you can answer
5. Provide a final answer when done

RULES:
- Call ONE tool per step
- Wait for results before deciding next step
- Use tools to get real data, never fake it
- Answer conversationally if no tools are needed

EXAMPLES:

User: "list my plugins"
→ Call plugin-list tool → Answer with the results

User: "my site is slow"
→ Call site-health → See database is large → Call db-optimize → Answer with summary

User: "what is a transient?"
→ Answer directly (no tools needed)`;
    }

    /**
     * Build system prompt for prompt-based mode
     *
     * TODO Hackathon: Same over-eager tool calling issue as function calling mode.
     * See buildSystemPromptFunctionCalling() TODO for details on exploring simplistic
     * verbal techniques for smaller models.
     *
     * @return {string} System prompt with JSON instructions
     */
    buildSystemPromptPromptBased() {
        const tools = this.toolRegistry.getAll();
        const toolsList = tools.map(t => `- ${t.id}: ${t.description || t.label || ''}`).join('\n');

        return `You are a WordPress assistant. You help users by selecting and calling tools.

AVAILABLE TOOLS:
${toolsList}

JSON FORMAT REQUIREMENT:
EVERY response must be EXACTLY ONE JSON object. No text before or after. No explanations.

To call a tool:
{"action": "tool_call", "tool": "tool-id", "args": {}}

To give final answer:
{"action": "final_answer", "content": "Your answer here"}

CRITICAL: ALWAYS output JSON, even after seeing tool results!

COMPLETE EXAMPLE:

User: "list plugins"
You: {"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}

Tool result: {"success": true, "data": {"plugins": [{"name": "Akismet", "active": true}, {"name": "Hello Dolly", "active": false}], "total": 2}}
You: {"action": "final_answer", "content": "You have 2 plugins installed:\\n1. Akismet (active)\\n2. Hello Dolly (inactive)"}

IMPORTANT: Summarize tool results in a human-friendly way. Do NOT just copy the JSON data!

User: "what is a transient?"
You: {"action": "final_answer", "content": "A transient is temporary cached data in WordPress..."}

WRONG EXAMPLES (Do NOT do this):

❌ You have 2 plugins installed...  ← Plain text, missing JSON!
❌ {"action": "tool_call", ...}{"action": "final_answer", ...}  ← Multiple objects!
❌ I'll check that for you. {"action": "tool_call", ...}  ← Text before JSON!
❌ {"action": "final_answer", "content": "{\\"success\\":true,\\"data\\":{...}}"}  ← Copying raw JSON data!

When giving final_answer, write a SUMMARY for humans, not raw data!

CORRECT:
✅ {"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}
✅ {"action": "final_answer", "content": "You have 2 plugins installed: Akismet and Hello Dolly."}

Remember: JSON ONLY. No exceptions. Every single response must be valid JSON.`;
    }

    /**
     * Build tool definitions for function calling
     *
     * @return {Array} Tool definitions in OpenAI format
     */
    buildToolDefinitions() {
        const tools = this.toolRegistry.getAll();

        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.id,
                description: tool.description || tool.label || tool.id,
                parameters: {
                    type: 'object',
                    properties: tool.parameters || {},
                    required: tool.requiredParameters || [],
                },
            },
        }));
    }
}

export { ReactAgent, REACT_CONFIG };
export default ReactAgent;
