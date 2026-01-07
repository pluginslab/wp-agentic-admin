/**
 * Rewrite Flush Ability
 *
 * Flushes the WordPress rewrite rules (permalinks).
 * Similar to WP-CLI: wp rewrite flush
 *
 * ABILITY OVERVIEW:
 * =================
 * Regenerates the .htaccess rewrite rules and internal rewrite array.
 * Demonstrates:
 * - Simple success/failure operation
 * - Reporting rule counts before/after
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Rewrite rules flushed successfully.",
 *   rules_count: 89
 * }
 *
 * WHEN TO USE:
 * - After changing permalink structure
 * - After activating/deactivating plugins with custom post types
 * - When 404 errors appear on pages that should exist
 * - After manual .htaccess edits
 *
 * WHY NO CONFIRMATION?
 * Flushing rewrite rules is a safe, standard operation:
 * - WordPress regenerates rules from registered sources
 * - No data is deleted, only cache is refreshed
 * - Worst case: brief regeneration time
 *
 * @package WPNeuralAdmin
 * @since 1.2.0
 * @see includes/abilities/rewrite-flush.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the rewrite-flush ability with the chat system.
 */
export function registerRewriteFlush() {
    registerAbility('wp-neural-admin/rewrite-flush', {
        label: 'Flush rewrite rules',

        keywords: [
            'rewrite',
            'permalink',
            'permalinks',
            'rewrite rule',
            'flush permalink',
            'flush rewrite',
            'regenerate permalink',
        ],

        initialMessage: 'Flushing rewrite rules...',

        /**
         * Generate summary from the result.
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (!result.success) {
                return result.message || 'Failed to flush rewrite rules.';
            }

            let summary = result.message;
            
            if (result.permalink_structure) {
                summary += `\n\nCurrent permalink structure: \`${result.permalink_structure}\``;
            }

            summary += '\n\nThis can fix 404 errors on posts/pages after changing permalink settings or installing new plugins that register custom post types.';

            return summary;
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from PHP.
         */
        execute: async (params) => {
            return executeAbility('wp-neural-admin/rewrite-flush', {});
        },

        // Flushing rewrites is safe and common - no confirmation needed.
        requiresConfirmation: false,
    });
}

export default registerRewriteFlush;
