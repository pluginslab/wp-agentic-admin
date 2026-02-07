/**
 * Database Optimize Ability
 *
 * Optimizes WordPress database tables using MySQL OPTIMIZE TABLE.
 *
 * ABILITY OVERVIEW:
 * =================
 * Runs OPTIMIZE TABLE on all WordPress database tables.
 * Demonstrates handling numeric data in the result.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   tables_optimized: 12,
 *   tables: ["wp_posts", "wp_postmeta", "wp_options", ...]
 * }
 *
 * WHAT OPTIMIZE TABLE DOES:
 * - Reclaims unused space from deleted rows
 * - Defragments the data file
 * - Updates index statistics
 * - Can improve SELECT query performance
 *
 * WHY NO CONFIRMATION?
 * OPTIMIZE TABLE is a safe, non-destructive operation:
 * - It doesn't delete any data
 * - It's a standard MySQL maintenance operation
 * - Worst case: brief lock on tables during optimization
 *
 * @see includes/abilities/db-optimize.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/agentic-abilities-api';

/**
 * Register the db-optimize ability with the chat system.
 */
export function registerDbOptimize() {
    registerAbility('wp-agentic-admin/db-optimize', {
        label: 'Optimize database',

        // Keywords cover performance-related terms since DB optimization
        // is often requested when the site "feels slow".
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
         * Generate summary from the result.
         *
         * Show the number of tables optimized to prove work was done.
         * Users like to see concrete numbers, not just "done".
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            // Check for the specific data we expect.
            if (result.tables_optimized !== undefined) {
                return `Database optimization complete! ${result.tables_optimized} tables were optimized. This should help improve your site's performance.`;
            }
            // Fallback for unexpected result format.
            return result.message || 'Database optimization complete.';
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from PHP.
         */
        execute: async (params) => {
            // No parameters needed - optimize all tables.
            return executeAbility('wp-agentic-admin/db-optimize', {});
        },

        // Safe operation - no confirmation needed.
        requiresConfirmation: false,
    });
}

export default registerDbOptimize;
