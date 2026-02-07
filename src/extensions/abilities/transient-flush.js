/**
 * Transient Flush Ability
 *
 * Deletes expired or all transients from the database.
 * Similar to WP-CLI: wp transient delete --all / --expired
 *
 * ABILITY OVERVIEW:
 * =================
 * Cleans up transient data stored in the options table.
 * Demonstrates:
 * - Supporting multiple operation modes (expired-only vs all)
 * - Parsing user intent to determine mode
 * - Reporting before/after counts
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Deleted 15 expired transients.",
 *   deleted_count: 15,
 *   expired_only: true
 * }
 *
 * OPERATION MODES:
 * 1. expired_only: true - Only delete transients past their expiration
 * 2. expired_only: false - Delete ALL transients (more aggressive cleanup)
 *
 * WHY NO CONFIRMATION?
 * Transients are temporary cache data by design:
 * - They're meant to be deleted and regenerated
 * - WordPress and plugins will recreate needed transients
 * - No permanent data loss occurs
 *
 * @since 0.1.0
 * @see includes/abilities/transient-flush.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/agentic-abilities-api';

/**
 * Register the transient-flush ability with the chat system.
 */
export function registerTransientFlush() {
    registerAbility('wp-agentic-admin/transient-flush', {
        label: 'Flush transients',

        keywords: [
            'transient',
            'transients',
            'flush transient',
            'clear transient',
            'delete transient',
            'expired transient',
        ],

        initialMessage: 'Flushing transients...',

        /**
         * Generate summary from the result.
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (!result.success) {
                return result.message || 'Failed to flush transients.';
            }

            const count = result.deleted_count || 0;
            const type = result.expired_only ? 'expired ' : '';
            
            if (count === 0) {
                return result.expired_only 
                    ? 'No expired transients found. Your database is clean!'
                    : 'No transients found to delete.';
            }

            return `${result.message} This helps keep your database clean and can improve performance.`;
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from PHP.
         */
        execute: async (params) => {
            // Default to expired only unless user explicitly requests all.
            const expiredOnly = params.expired_only !== false;
            return executeAbility('wp-agentic-admin/transient-flush', {
                expired_only: expiredOnly,
            });
        },

        /**
         * Parse user intent to extract parameters.
         *
         * @param {string} message - The user's message.
         * @return {Object} Extracted parameters.
         */
        parseIntent: (message) => {
            const lowerMessage = message.toLowerCase();
            
            // Check if user wants to delete ALL transients (more destructive).
            const deleteAll = lowerMessage.includes('all transient') ||
                            lowerMessage.includes('delete all') ||
                            lowerMessage.includes('clear all') ||
                            lowerMessage.includes('flush all');

            return {
                expired_only: !deleteAll,
            };
        },

        // Deleting expired transients is safe - no confirmation needed.
        // Deleting ALL transients might need confirmation in future versions.
        requiresConfirmation: false,
    });
}

export default registerTransientFlush;
