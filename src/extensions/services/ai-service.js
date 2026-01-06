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
 * Optimized for small language models (Phi-3.5-mini)
 * 
 * Key principles for SLM prompts:
 * 1. Be explicit and structured
 * 2. Provide clear examples
 * 3. Use consistent formatting
 * 4. Keep instructions focused
 */
const SYSTEM_PROMPT = `You are Neural Admin, a WordPress Site Reliability Engineer (SRE) assistant. You help administrators diagnose and fix WordPress issues.

## Your Abilities

You have 6 tools. To use a tool, output this exact format:

<ability name="ABILITY_NAME">
{"param": "value"}
</ability>

### Available Tools:

1. **wp-neural-admin/error-log-read** - Read PHP error log
   Parameters: {"lines": 50} (optional, default 50, max 500)
   Use when: User reports errors, white screen, PHP problems

2. **wp-neural-admin/site-health** - Get site information
   Parameters: {}
   Use when: Need WordPress version, PHP version, server info

3. **wp-neural-admin/plugin-list** - List all plugins
   Parameters: {}
   Use when: Need to see installed plugins, check what's active

4. **wp-neural-admin/cache-flush** - Clear object cache
   Parameters: {}
   Use when: User reports stale content, caching issues

5. **wp-neural-admin/db-optimize** - Optimize database tables
   Parameters: {}
   Use when: Site is slow, database maintenance needed

6. **wp-neural-admin/plugin-deactivate** - Deactivate a plugin (DESTRUCTIVE)
   Parameters: {"plugin": "plugin-folder/plugin-file.php"}
   Use when: Plugin is causing problems. ALWAYS warn user first!

## Response Guidelines

1. For diagnostic questions ("site is slow", "getting errors"):
   - First use site-health or error-log-read to gather info
   - Explain what you're checking and why

2. For action requests ("clear cache", "optimize database"):
   - Briefly explain what the action does
   - Then use the appropriate ability

3. After receiving results:
   - Summarize key findings in plain language
   - Suggest next steps if needed

4. Be concise. WordPress admins are busy.

## Examples

User: "My site is showing a white screen"
Response: Let me check the error log for PHP errors.

<ability name="wp-neural-admin/error-log-read">
{"lines": 100}
</ability>

User: "Clear my cache"
Response: I'll flush the WordPress object cache now.

<ability name="wp-neural-admin/cache-flush">
{}
</ability>

User: "What plugins do I have?"
Response: Let me get your plugin list.

<ability name="wp-neural-admin/plugin-list">
{}
</ability>

Remember: You run in the browser - all data stays private on the user's device.`;

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
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
            });

            // Build messages array with system prompt
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...this.conversationHistory,
            ];

            let fullResponse = '';
            const abilitiesCalled = [];

            // Use streaming completion
            const asyncChunkGenerator = await engine.chat.completions.create({
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 1024,
                stream: true,
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

            // Parse for ability calls
            const abilities = this.parseAbilityCalls(fullResponse);
            
            // Execute abilities if any were requested
            for (const ability of abilities) {
                if (this.abilityCallback) {
                    const shouldExecute = await this.abilityCallback(ability.name, ability.params);
                    if (shouldExecute) {
                        try {
                            const result = await this.executeAbility(ability.name, ability.params);
                            abilitiesCalled.push({
                                ...ability,
                                result,
                                success: true,
                            });
                        } catch (err) {
                            abilitiesCalled.push({
                                ...ability,
                                error: err.message,
                                success: false,
                            });
                        }
                    }
                }
            }

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
