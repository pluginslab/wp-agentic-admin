/**
 * Tool Router
 * 
 * Routes user messages to appropriate tools based on keyword matching.
 * Provides fallback detection when LLM fails to select the right tool.
 * 
 * @package WPNeuralAdmin
 */

import toolRegistry from './tool-registry';

/**
 * ToolRouter class
 * Handles keyword-based tool detection and routing
 */
class ToolRouter {
    constructor(registry = toolRegistry) {
        this.registry = registry;
    }

    /**
     * Detect which tool should handle a message based on keywords
     * 
     * @param {string} message - User message to analyze
     * @return {Object|null} Tool definition or null if no match
     */
    detectTool(message) {
        if (!message || typeof message !== 'string') {
            return null;
        }

        const lowerMessage = message.toLowerCase();
        const tools = this.registry.getAll();

        // Score each tool based on keyword matches
        let bestMatch = null;
        let bestScore = 0;

        for (const tool of tools) {
            const score = this.calculateMatchScore(lowerMessage, tool.keywords);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = tool;
            }
        }

        // Require at least one keyword match
        if (bestScore > 0) {
            console.log(`[ToolRouter] Detected tool: ${bestMatch.id} (score: ${bestScore})`);
            return bestMatch;
        }

        console.log('[ToolRouter] No tool matched for message');
        return null;
    }

    /**
     * Calculate match score for a set of keywords
     * 
     * @param {string} message - Lowercase message
     * @param {string[]} keywords - Keywords to match
     * @return {number} Match score
     */
    calculateMatchScore(message, keywords) {
        let score = 0;

        for (const keyword of keywords) {
            if (message.includes(keyword)) {
                // Longer keywords get higher scores (more specific)
                score += keyword.length;
            }
        }

        return score;
    }

    /**
     * Check if a message should trigger any tool
     * 
     * @param {string} message - User message
     * @return {boolean}
     */
    shouldUseTool(message) {
        return this.detectTool(message) !== null;
    }

    /**
     * Get the tool ID for a message (convenience method)
     * 
     * @param {string} message - User message
     * @return {string|null} Tool ID or null
     */
    getToolId(message) {
        const tool = this.detectTool(message);
        return tool ? tool.id : null;
    }
}

// Create singleton instance with default registry
const toolRouter = new ToolRouter();

export { ToolRouter, toolRouter };
export default toolRouter;
