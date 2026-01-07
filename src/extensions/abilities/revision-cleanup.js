/**
 * Revision Cleanup Ability
 *
 * Deletes old post revisions to clean up the database.
 * Similar to WP-CLI: wp post delete $(wp post list --post_type=revision --format=ids)
 *
 * ABILITY OVERVIEW:
 * =================
 * Removes old post revisions while keeping recent ones per post.
 * Demonstrates:
 * - Destructive operation requiring confirmation
 * - Dry-run/preview mode (no confirmation needed)
 * - Configurable retention (keep_last parameter)
 * - Dynamic confirmation based on parsed intent
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Deleted 45 revisions...",
 *   deleted_count: 45,
 *   total_revisions: 120,
 *   kept_count: 75,
 *   dry_run: false,
 *   space_saved: "2.5 MB"
 * }
 *
 * OPERATION MODES:
 * 1. dry_run: true - Preview what would be deleted (no confirmation)
 * 2. dry_run: false - Actually delete revisions (requires confirmation)
 *
 * CONFIRMATION LOGIC:
 * - "preview revisions" / "dry run" -> No confirmation (safe preview)
 * - "clean up revisions" / "delete revisions" -> Requires confirmation
 *
 * @package WPNeuralAdmin
 * @since 1.2.0
 * @see includes/abilities/revision-cleanup.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the revision-cleanup ability with the chat system.
 */
export function registerRevisionCleanup() {
    registerAbility('wp-neural-admin/revision-cleanup', {
        label: 'Clean up revisions',

        keywords: [
            'revision',
            'revisions',
            'post revision',
            'clean revision',
            'delete revision',
            'revision cleanup',
        ],

        initialMessage: 'Analyzing post revisions...',

        /**
         * Generate summary from the result.
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (!result.success) {
                return result.message || 'Failed to clean up revisions.';
            }

            let summary = result.message;

            if (result.dry_run) {
                summary += '\n\n**This was a dry run.** To actually delete the revisions, confirm the action.';
            } else if (result.deleted_count > 0) {
                summary += '\n\nYour database is now cleaner! This can improve backup times and reduce storage costs.';
            }

            return summary;
        },

        /**
         * Get confirmation message before executing.
         *
         * @param {Object} params - The parameters that will be used.
         * @return {string} Confirmation message to show user.
         */
        getConfirmationMessage: (params) => {
            const keepLast = params.keep_last || 3;
            return `This will delete post revisions, keeping the ${keepLast} most recent revisions per post. This action cannot be undone. Do you want to proceed?`;
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from PHP.
         */
        execute: async (params) => {
            const keepLast = params.keep_last !== undefined ? params.keep_last : 3;
            const dryRun = params.dry_run !== undefined ? params.dry_run : false;

            return executeAbility('wp-neural-admin/revision-cleanup', {
                keep_last: keepLast,
                dry_run: dryRun,
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
            
            // Check for specific keep_last values.
            let keepLast = 3; // Default.
            
            // Match patterns like "keep 5 revisions", "keep last 2", etc.
            const keepMatch = lowerMessage.match(/keep\s*(?:last\s*)?(\d+)/);
            if (keepMatch) {
                keepLast = parseInt(keepMatch[1], 10);
            }
            
            // Check if user wants to delete ALL revisions.
            if (lowerMessage.includes('all revision') || 
                lowerMessage.includes('delete all') ||
                lowerMessage.includes('remove all')) {
                keepLast = 0;
            }

            // Check for dry run/preview request.
            const dryRun = lowerMessage.includes('dry run') || 
                          lowerMessage.includes('preview') ||
                          lowerMessage.includes('what would');

            return {
                keep_last: keepLast,
                dry_run: dryRun,
            };
        },

        /**
         * Only require confirmation for actual deletions, not previews/dry runs.
         *
         * @param {Object} params - The parsed parameters.
         * @return {boolean} Whether confirmation is required.
         */
        requiresConfirmation: (params) => {
            // Don't require confirmation for dry runs/previews
            return !params.dry_run;
        },
    });
}

export default registerRevisionCleanup;
