/**
 * Cache Flush Ability
 * 
 * Flushes the WordPress object cache.
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the cache-flush ability with the chat system.
 */
export function registerCacheFlush() {
    registerAbility('wp-neural-admin/cache-flush', {
        label: 'Flush cache',
        keywords: [
            'cache',
            'flush',
            'clear',
            'purge',
            'refresh',
            'reset cache',
        ],
        initialMessage: "Flushing the cache...",
        
        /**
         * Generate human-readable summary from the result.
         * 
         * @param {Object} result - API response.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            return result.message || 'Cache has been flushed successfully. Your site should now serve fresh content.';
        },
        
        /**
         * Execute the ability.
         * 
         * @param {Object} params - Parameters from the chat system (includes userMessage).
         * @return {Promise<Object>} API response.
         */
        execute: async (params) => {
            // This ability doesn't require any input parameters
            return executeAbility('wp-neural-admin/cache-flush', {});
        },
        
        requiresConfirmation: false,
    });
}

export default registerCacheFlush;
