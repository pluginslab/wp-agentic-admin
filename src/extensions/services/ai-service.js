/**
 * AI Service
 *
 * High-level service for AI inference, handling chat completion with streaming,
 * system prompts, and ability execution coordination.
 *
 * @package WPNeuralAdmin
 */

import modelLoader from './model-loader';
import abilitiesApi from './abilities-api';

/**
 * System prompt for the AI assistant
 * Ultra-minimal for SmolLM2-360M - the model is too small for complex instructions
 * Tool selection is handled by keyword detection, model just provides conversational responses
 */
const SYSTEM_PROMPT = `You are a helpful WordPress assistant. Be brief and friendly.
When given data, summarize it clearly. Do not make up information.`;

/**
 * AIService class for managing AI chat interactions
 */
class AIService {
    constructor() {
        this.conversationHistory = [];
        this.streamCallback = null;
        this.abilityCallback = null;
        this.isGenerating = false;
    }

    /**
     * Set callback for streaming text updates
     *
     * @param {Function} callback - Called with (chunk, fullText) for each token
     */
    onStream(callback) {
        this.streamCallback = callback;
    }

    /**
     * Set callback for ability execution requests
     *
     * @param {Function} callback - Called with (abilityName, params) when AI wants to use an ability
     */
    onAbilityRequest(callback) {
        this.abilityCallback = callback;
    }

    /**
     * Check if the AI model is ready
     *
     * @return {boolean} True if ready for inference
     */
    isReady() {
        return modelLoader.isModelReady();
    }

    /**
     * Detect which ability should be used based on user message keywords
     * This helps guide small models that struggle with tool selection
     *
     * @param {string} message - User message
     * @return {string|null} Suggested ability ID or null
     */
    detectAbilityFromMessage(message) {
        const lower = message.toLowerCase();
        
        // Plugin related
        if (lower.includes('plugin') || lower.includes('installed') || lower.includes('extensions')) {
            return 'wp-neural-admin/plugin-list';
        }
        
        // Error related
        if (lower.includes('error') || lower.includes('problem') || lower.includes('issue') || 
            lower.includes('broken') || lower.includes('white screen') || lower.includes('crash') ||
            lower.includes('not working') || lower.includes('bug') || lower.includes('log')) {
            return 'wp-neural-admin/error-log-read';
        }
        
        // Site health / info related
        if (lower.includes('version') || lower.includes('php') || lower.includes('mysql') ||
            lower.includes('health') || lower.includes('info') || lower.includes('status') ||
            lower.includes('server')) {
            return 'wp-neural-admin/site-health';
        }
        
        // Cache related
        if (lower.includes('cache') || lower.includes('flush') || lower.includes('clear') ||
            lower.includes('purge') || lower.includes('refresh')) {
            return 'wp-neural-admin/cache-flush';
        }
        
        // Database related
        if (lower.includes('database') || lower.includes('db') || lower.includes('optimize') ||
            lower.includes('slow') || lower.includes('performance')) {
            return 'wp-neural-admin/db-optimize';
        }
        
        // Deactivate plugin
        if (lower.includes('deactivate') || lower.includes('disable') || lower.includes('turn off')) {
            return 'wp-neural-admin/plugin-deactivate';
        }
        
        return null;
    }

    /**
     * Send a message and get a response with streaming
     *
     * @param {string} userMessage - The user's message
     * @param {Object} options - Optional settings
     * @return {Promise<Object>} Response with text and any abilities called
     */
    async chat(userMessage, options = {}) {
        if (!this.isReady()) {
            throw new Error('AI model is not loaded. Please load the model first.');
        }

        if (this.isGenerating) {
            throw new Error('AI is already generating a response. Please wait.');
        }

        const engine = modelLoader.getEngine();
        if (!engine) {
            throw new Error('AI engine not available');
        }

        this.isGenerating = true;

        try {
            // Detect suggested ability from keywords
            const suggestedAbility = this.detectAbilityFromMessage(userMessage);
            console.log('[AIService] User message:', userMessage);
            console.log('[AIService] Detected ability from keywords:', suggestedAbility);
            
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
            });

            // Build messages array with system prompt
            // If we detected an ability, add a hint to guide the model
            let systemContent = SYSTEM_PROMPT;
            if (suggestedAbility) {
                systemContent += `\n\nHINT: For this request, you should use: ${suggestedAbility}`;
            }
            
            const messages = [
                { role: 'system', content: systemContent },
                ...this.conversationHistory,
            ];

            let fullResponse = '';
            const abilitiesCalled = [];

            // Use streaming completion
            // Low temperature (0.2) for more deterministic tool calling
            // Short max_tokens (256) to prevent repetitive output
            const asyncChunkGenerator = await engine.chat.completions.create({
                messages,
                temperature: options.temperature || 0.2,
                max_tokens: options.maxTokens || 256,
                stream: true,
                stop: ['User:', 'USER:', '\n\nUser'],
            });

            // Process streaming chunks
            for await (const chunk of asyncChunkGenerator) {
                const delta = chunk.choices[0]?.delta?.content || '';
                fullResponse += delta;

                // Call stream callback if set
                if (this.streamCallback) {
                    this.streamCallback(delta, fullResponse);
                }
            }

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: fullResponse,
            });

            // Parse for ability calls from model output
            let abilities = this.parseAbilityCalls(fullResponse);
            
            // FALLBACK: If model didn't use a tool but we detected one should be used,
            // auto-execute the suggested ability (helps tiny models)
            if (abilities.length === 0 && suggestedAbility) {
                console.log('[AIService] Model did not call ability, using fallback:', suggestedAbility);
                abilities = [{ name: suggestedAbility, params: {} }];
            }
            
            // Execute abilities if any were requested
            console.log('[AIService] Abilities to execute:', abilities);
            for (const ability of abilities) {
                // If no callback set, execute directly
                let shouldExecute = true;
                if (this.abilityCallback) {
                    shouldExecute = await this.abilityCallback(ability.name, ability.params);
                }
                console.log('[AIService] Should execute', ability.name, ':', shouldExecute);
                
                if (shouldExecute) {
                    try {
                        console.log('[AIService] Executing ability:', ability.name);
                        const result = await this.executeAbility(ability.name, ability.params);
                        console.log('[AIService] Ability result:', result);
                        abilitiesCalled.push({
                            ...ability,
                            result,
                            success: true,
                        });
                    } catch (err) {
                        console.error('[AIService] Ability error:', err);
                        abilitiesCalled.push({
                            ...ability,
                            error: err.message,
                            success: false,
                        });
                    }
                }
            }
            console.log('[AIService] Final abilitiesCalled:', abilitiesCalled);

            return {
                text: fullResponse,
                abilities: abilitiesCalled,
            };
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Parse ability calls from AI response
     *
     * @param {string} text - The AI's response text
     * @return {Array} Array of ability call objects
     */
    parseAbilityCalls(text) {
        const abilities = [];
        const abilityRegex = /<ability\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/ability>/g;
        
        let match;
        while ((match = abilityRegex.exec(text)) !== null) {
            const name = match[1];
            let params = {};
            
            try {
                const paramsText = match[2].trim();
                if (paramsText) {
                    params = JSON.parse(paramsText);
                }
            } catch (err) {
                console.warn('Failed to parse ability params:', err);
            }

            abilities.push({ name, params });
        }

        return abilities;
    }

    /**
     * Execute an ability via the Abilities API
     *
     * @param {string} abilityId - Full ability ID (e.g., 'wp-neural-admin/error-log-read')
     * @param {Object} params - Ability parameters
     * @return {Promise<Object>} Ability execution result
     */
    async executeAbility(abilityId, params = {}) {
        return abilitiesApi.executeAbilityById(abilityId, params);
    }

    /**
     * Add an ability result to the conversation context
     *
     * @param {string} abilityName - Name of the ability
     * @param {Object} result - Result from the ability
     * @param {boolean} success - Whether it succeeded
     */
    addAbilityResult(abilityName, result, success = true) {
        const content = success
            ? `[Ability "${abilityName}" executed successfully]\nResult:\n${JSON.stringify(result, null, 2)}`
            : `[Ability "${abilityName}" failed]\nError: ${result}`;

        this.conversationHistory.push({
            role: 'user', // Add as user message so AI sees it
            content,
        });
    }

    /**
     * Continue the conversation after ability execution
     *
     * @param {string} abilityName - The ability that was executed
     * @param {Object} result - The ability result
     * @param {boolean} success - Whether it succeeded
     * @return {Promise<Object>} AI's analysis of the result
     */
    async analyzeAbilityResult(abilityName, result, success = true) {
        const prompt = success
            ? `I just ran the "${abilityName}" ability. Here are the results:\n\n${JSON.stringify(result, null, 2)}\n\nPlease analyze these results and tell me what you found.`
            : `I tried to run the "${abilityName}" ability but it failed with this error: ${result}\n\nWhat does this mean and what should I try next?`;

        return this.chat(prompt);
    }

    /**
     * Get a simple non-streaming completion
     *
     * @param {string} prompt - The prompt to complete
     * @param {Object} options - Optional settings
     * @return {Promise<string>} The completion text
     */
    async complete(prompt, options = {}) {
        if (!this.isReady()) {
            throw new Error('AI model is not loaded');
        }

        const engine = modelLoader.getEngine();
        const response = await engine.chat.completions.create({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 512,
            stream: false,
        });

        return response.choices[0]?.message?.content || '';
    }

    /**
     * Clear the conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get the current conversation history
     *
     * @return {Array} The conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Stop the current generation (if supported)
     */
    async stopGeneration() {
        if (this.isGenerating) {
            const engine = modelLoader.getEngine();
            if (engine) {
                try {
                    await engine.interruptGenerate();
                } catch (err) {
                    console.warn('Error stopping generation:', err);
                }
            }
            this.isGenerating = false;
        }
    }

    /**
     * Get generation status
     *
     * @return {boolean} True if currently generating
     */
    isCurrentlyGenerating() {
        return this.isGenerating;
    }
}

// Create singleton instance
const aiService = new AIService();

export { AIService, aiService, SYSTEM_PROMPT };
export default aiService;
