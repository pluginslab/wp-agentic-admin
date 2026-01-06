/**
 * Database Optimize Ability
 * 
 * Optimizes WordPress database tables.
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the db-optimize ability with the chat system.
 */
export function registerDbOptimize() {
    registerAbility('wp-neural-admin/db-optimize', {
        label: 'Optimize database',
        keywords: [
            'database',
            'db',
            'optimize',
            'slow',
            'performance',
            'speed',
            'cleanup',
            'clean up',
        ],
        initialMessage: "Optimizing the database...",
        
        /**
         * Generate human-readable summary from the result.
         * 
         * @param {Object} result - API response.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (result.tables_optimized !== undefined) {
                return `Database optimization complete! ${result.tables_optimized} tables were optimized. This should help improve your site's performance.`;
            }
            return result.message || 'Database optimization complete.';
        },
        
        /**
         * Execute the ability.
         * 
         * @param {Object} params - Parameters from the chat system (includes userMessage).
         * @return {Promise<Object>} API response.
         */
        execute: async (params) => {
            // This ability doesn't require any input parameters
            return executeAbility('wp-neural-admin/db-optimize', {});
        },
        
        requiresConfirmation: false,
    });
}

export default registerDbOptimize;
