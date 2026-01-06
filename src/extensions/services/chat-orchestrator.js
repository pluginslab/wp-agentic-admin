/**
 * Chat Orchestrator
 * 
 * Main coordinator that orchestrates the chat experience by combining:
 * - LLM service for AI responses
 * - Tool registry and router for tool detection/execution
 * - Stream simulator for typewriter effects
 * - Chat session for message management
 * 
 * @package WPNeuralAdmin
 */

import modelLoader from './model-loader';
import toolRegistry from './tool-registry';
import toolRouter from './tool-router';
import streamSimulator from './stream-simulator';
import { ChatSession, MessageType } from './chat-session';

/**
 * Build system prompt dynamically based on registered abilities
 * 
 * @return {string} System prompt with current abilities listed
 */
function buildSystemPrompt() {
    const tools = toolRegistry.getAll();
    
    if (tools.length === 0) {
        return `You are a WordPress assistant. No tools are currently available. Let the user know they need to wait for abilities to load or check their configuration.`;
    }

    // Build list of capabilities from registered tools
    const capabilities = tools.map(tool => {
        // Use tool label if available, otherwise derive from id
        const label = tool.label || tool.id.split('/').pop().replace(/-/g, ' ');
        return `- ${label}`;
    }).join('\n');

    return `You are a WordPress assistant that can ONLY help with these specific tasks:
${capabilities}

If the user asks about something else not listed above, politely explain that you can only help with the tasks listed above.

Be brief and friendly. When given data, answer only what was asked. Do not make up information.`;
}

/**
 * ChatOrchestrator class
 * Coordinates all chat-related services
 */
class ChatOrchestrator {
    /**
     * Create a new chat orchestrator
     * 
     * @param {Object} options - Configuration options
     * @param {string} [options.systemPrompt] - Custom system prompt
     * @param {Object} [options.llmOptions] - LLM generation options
     * @param {Object} [options.streamOptions] - Stream simulator options
     */
    constructor(options = {}) {
        this.customSystemPrompt = options.systemPrompt || null;
        this.llmOptions = {
            temperature: 0.2,
            maxTokens: 256,
            ...options.llmOptions,
        };
        this.streamOptions = {
            charDelay: 15,
            ...options.streamOptions,
        };

        // Services
        this.session = null;
        this.toolRegistry = toolRegistry;
        this.toolRouter = toolRouter;
        this.streamSimulator = streamSimulator;

        // State
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
        };
    }

    /**
     * Initialize the orchestrator with a session
     * 
     * @param {ChatSession} session - Chat session to use
     */
    initialize(session) {
        this.session = session;
        
        // Wire up session onChange to our callback
        session.onChange = (messages, newMessage) => {
            this.callbacks.onMessageAdd(messages, newMessage);
        };

        console.log('[ChatOrchestrator] Initialized with session:', session.id);
    }

    /**
     * Get the current system prompt
     * Uses custom prompt if provided, otherwise builds dynamically from registered tools
     * 
     * @return {string}
     */
    getSystemPrompt() {
        return this.customSystemPrompt || buildSystemPrompt();
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
     * Check if LLM is ready
     * 
     * @return {boolean}
     */
    isLLMReady() {
        return modelLoader.isModelReady();
    }

    /**
     * Process a user message
     * This is the main entry point for handling user input
     * 
     * @param {string} userMessage - The user's message
     * @return {Promise<Object>} Result with success status and any errors
     */
    async processMessage(userMessage) {
        if (!this.session) {
            throw new Error('ChatOrchestrator not initialized. Call initialize() first.');
        }

        if (this.isProcessing) {
            return { success: false, error: 'Already processing a message' };
        }

        this.isProcessing = true;
        this.currentAbortController = new AbortController();
        this.callbacks.onStateChange({ isProcessing: true });

        try {
            // Add user message to session
            this.session.addUserMessage(userMessage);

            // Detect if a tool should be used
            const tool = this.toolRouter.detectTool(userMessage);

            if (tool) {
                // Tool-based flow
                return await this.processWithTool(userMessage, tool);
            } else {
                // Pure LLM flow
                return await this.processWithLLM(userMessage);
            }
        } catch (error) {
            console.error('[ChatOrchestrator] Error processing message:', error);
            this.session.addErrorMessage('An error occurred while processing your message.');
            this.callbacks.onError(error);
            return { success: false, error: error.message };
        } finally {
            this.isProcessing = false;
            this.currentAbortController = null;
            this.callbacks.onStateChange({ isProcessing: false });
        }
    }

    /**
     * Process message with tool execution
     * 
     * @param {string} userMessage - User's message
     * @param {Object} tool - Tool to execute
     * @return {Promise<Object>}
     */
    async processWithTool(userMessage, tool) {
        // 1. Check if tool requires confirmation
        if (tool.requiresConfirmation) {
            const confirmed = await this.requestConfirmation(tool);
            if (!confirmed) {
                this.session.addAssistantMessage('Action cancelled.');
                return { success: true, cancelled: true };
            }
        }

        // 2. Stream the initial message
        this.callbacks.onStreamStart();
        await this.streamSimulator.stream(tool.initialMessage, {
            ...this.streamOptions,
            onChunk: (char, text) => this.callbacks.onStreamChunk(char, text),
        });
        this.session.addAssistantMessage(tool.initialMessage);
        this.callbacks.onStreamEnd(tool.initialMessage);

        // 3. Execute the tool
        this.callbacks.onToolStart(tool.id);
        
        let result;
        let success = true;

        try {
            // Pass userMessage to execute so tools can extract parameters
            result = await tool.execute({ userMessage });
            this.session.addToolResult(tool.id, result, true);
        } catch (error) {
            result = { error: error.message };
            success = false;
            this.session.addToolResult(tool.id, result, false);
        }

        this.callbacks.onToolEnd(tool.id, result, success);

        // 4. Generate summary using LLM if available, otherwise use canned text
        if (this.isLLMReady()) {
            await this.generateLLMSummary(userMessage, tool, result, success);
        } else {
            // Fallback to canned summary if LLM not loaded
            const summary = success 
                ? tool.summarize(result, userMessage)
                : 'I encountered an error while trying to help.';

            this.callbacks.onStreamStart();
            await this.streamSimulator.stream(summary, {
                ...this.streamOptions,
                charDelay: 10,
                onChunk: (char, text) => this.callbacks.onStreamChunk(char, text),
            });
            this.session.addAssistantMessage(summary);
            this.callbacks.onStreamEnd(summary);
        }

        return { success, toolId: tool.id, result };
    }

    /**
     * Generate a summary using the LLM
     * 
     * @param {string} userMessage - Original user message
     * @param {Object} tool - Tool that was executed
     * @param {Object} result - Tool execution result
     * @param {boolean} success - Whether tool succeeded
     */
    async generateLLMSummary(userMessage, tool, result, success) {
        const engine = modelLoader.getEngine();
        if (!engine) {
            throw new Error('LLM engine not available');
        }

        // Build a focused prompt for summarization
        let summaryPrompt;
        if (success) {
            // Truncate result if too large to fit in context
            const resultStr = JSON.stringify(result, null, 2);
            const truncatedResult = resultStr.length > 1500 
                ? resultStr.substring(0, 1500) + '...(truncated)'
                : resultStr;

            summaryPrompt = `The user asked: "${userMessage}"

I ran the "${tool.label}" tool and got this result:
${truncatedResult}

Answer ONLY what the user asked. Be concise and specific. Do not include extra information they didn't ask for.`;
        } else {
            summaryPrompt = `The user asked: "${userMessage}"

I tried to run the "${tool.label}" tool but it failed with error: ${result.error}

Explain what went wrong and suggest what the user might try next.`;
        }

        // Use a simple, focused system prompt for summarization
        // Don't use the main system prompt which might confuse the LLM
        const summarySystemPrompt = 'You are a helpful WordPress assistant. Your job is to summarize tool results clearly and concisely. Answer the user\'s question based on the data provided.';

        const messages = [
            { role: 'system', content: summarySystemPrompt },
            { role: 'user', content: summaryPrompt },
        ];

        // Stream from LLM
        this.callbacks.onStreamStart();
        let fullResponse = '';

        try {
            const stream = await engine.chat.completions.create({
                messages,
                temperature: 0.3, // Lower temperature for more factual summaries
                max_tokens: this.llmOptions.maxTokens,
                stream: true,
                stream_options: { include_usage: true },
                stop: ['User:', 'USER:', '\n\nUser'],
            });

            for await (const chunk of stream) {
                if (this.currentAbortController?.signal.aborted) {
                    break;
                }

                const delta = chunk.choices[0]?.delta?.content || '';
                fullResponse += delta;
                this.callbacks.onStreamChunk(delta, fullResponse);

                // Capture usage stats from the final chunk
                if (chunk.usage) {
                    console.log('[ChatOrchestrator] Tool summary usage stats:', chunk.usage);
                    modelLoader.updateUsageStats(chunk.usage);
                }
            }

            this.session.addAssistantMessage(fullResponse);
            this.callbacks.onStreamEnd(fullResponse);
        } catch (error) {
            console.error('[ChatOrchestrator] LLM summary error:', error);
            // Fallback to canned summary on error
            const fallbackSummary = success 
                ? tool.summarize(result, userMessage)
                : 'I encountered an error while trying to help.';
            
            this.session.addAssistantMessage(fallbackSummary);
            this.callbacks.onStreamEnd(fallbackSummary);
        }
    }

    /**
     * Process message with pure LLM (no tool)
     * 
     * @param {string} userMessage - User's message
     * @return {Promise<Object>}
     */
    async processWithLLM(userMessage) {
        if (!this.isLLMReady()) {
            this.session.addAssistantMessage(
                'The AI model is not loaded yet. Please load the model first.'
            );
            return { success: false, error: 'Model not loaded' };
        }

        const engine = modelLoader.getEngine();
        if (!engine) {
            throw new Error('LLM engine not available');
        }

        // Build messages for LLM
        const messages = [
            { role: 'system', content: this.getSystemPrompt() },
            ...this.session.getConversationHistory(),
        ];

        // Stream from LLM
        this.callbacks.onStreamStart();
        let fullResponse = '';

        try {
            const stream = await engine.chat.completions.create({
                messages,
                temperature: this.llmOptions.temperature,
                max_tokens: this.llmOptions.maxTokens,
                stream: true,
                stream_options: { include_usage: true },
                stop: ['User:', 'USER:', '\n\nUser'],
            });

            for await (const chunk of stream) {
                if (this.currentAbortController?.signal.aborted) {
                    break;
                }

                const delta = chunk.choices[0]?.delta?.content || '';
                fullResponse += delta;
                this.callbacks.onStreamChunk(delta, fullResponse);

                // Capture usage stats from the final chunk
                if (chunk.usage) {
                    console.log('[ChatOrchestrator] Got usage stats:', chunk.usage);
                    modelLoader.updateUsageStats(chunk.usage);
                }
            }

            this.session.addAssistantMessage(fullResponse);
            this.callbacks.onStreamEnd(fullResponse);

            return { success: true, response: fullResponse };
        } catch (error) {
            console.error('[ChatOrchestrator] LLM error:', error);
            throw error;
        }
    }

    /**
     * Request confirmation for destructive actions
     * 
     * @param {Object} tool - Tool requiring confirmation
     * @return {Promise<boolean>}
     */
    async requestConfirmation(tool) {
        // This should be implemented by the UI layer
        // Default implementation returns true (auto-confirm)
        console.warn('[ChatOrchestrator] No confirmation handler set, auto-confirming');
        return true;
    }

    /**
     * Set custom confirmation handler
     * 
     * @param {Function} handler - Async function that returns boolean
     */
    setConfirmationHandler(handler) {
        this.requestConfirmation = handler;
    }

    /**
     * Abort current processing
     */
    abort() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
        this.streamSimulator.abort();
        this.isProcessing = false;
        this.callbacks.onStateChange({ isProcessing: false });
    }

    /**
     * Clear the chat session
     */
    clearSession() {
        if (this.session) {
            this.session.clear();
        }
    }

    /**
     * Save the current session
     * 
     * @return {boolean}
     */
    saveSession() {
        return this.session?.save() || false;
    }

    /**
     * Load a saved session
     * 
     * @return {boolean}
     */
    loadSession() {
        return this.session?.load() || false;
    }

    /**
     * Get current processing state
     * 
     * @return {boolean}
     */
    getIsProcessing() {
        return this.isProcessing;
    }

    /**
     * Get the current session
     * 
     * @return {ChatSession|null}
     */
    getSession() {
        return this.session;
    }
}

// Create singleton instance
const chatOrchestrator = new ChatOrchestrator();

export { ChatOrchestrator, chatOrchestrator, buildSystemPrompt };
export default chatOrchestrator;
