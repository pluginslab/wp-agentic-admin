/**
 * Cron List Ability
 *
 * Lists all scheduled WordPress cron events.
 * Similar to WP-CLI: wp cron event list
 *
 * ABILITY OVERVIEW:
 * =================
 * Reads the WordPress cron schedule and displays pending events.
 * Demonstrates:
 * - Handling array data with multiple items
 * - Formatting timestamps for human readability
 * - Detecting overdue/stuck cron jobs
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   events: [
 *     {
 *       hook: "wp_scheduled_delete",
 *       next_run: "2026-01-07 15:00:00",
 *       schedule: "daily",
 *       interval: 86400,
 *       is_overdue: false
 *     },
 *     ...
 *   ],
 *   total_events: 12,
 *   overdue_count: 0
 * }
 *
 * WHAT THIS HELPS DIAGNOSE:
 * - Stuck cron jobs (overdue events)
 * - Missing scheduled tasks
 * - Cron spawn issues (many overdue events)
 * - Plugin scheduling conflicts
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @package WPNeuralAdmin
 * @since 1.2.0
 * @see includes/abilities/cron-list.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the cron-list ability with the chat system.
 */
export function registerCronList() {
    registerAbility('wp-neural-admin/cron-list', {
        label: 'List cron events',

        keywords: [
            'cron',
            'wp-cron',
            'cron event',
            'cron job',
            'scheduled task',
            'cron schedule',
            'background task',
        ],

        initialMessage: 'Fetching scheduled cron events...',

        /**
         * Generate summary from the result.
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (!result.success) {
                return result.message || 'Failed to fetch cron events.';
            }

            const total = result.total_events || 0;
            const overdue = result.overdue_count || 0;

            if (total === 0) {
                return 'No cron events are currently scheduled.';
            }

            let summary = result.message + '\n\n';

            // Show top events (limit to 10 for readability).
            const events = result.events || [];
            const displayEvents = events.slice(0, 10);

            if (displayEvents.length > 0) {
                summary += '**Upcoming events:**\n';
                
                displayEvents.forEach((event) => {
                    const status = event.is_overdue ? ' (OVERDUE)' : '';
                    const timeInfo = event.is_overdue 
                        ? `${event.next_run_diff} ago`
                        : `in ${event.next_run_diff}`;
                    
                    summary += `- \`${event.hook}\` - ${event.schedule} - ${timeInfo}${status}\n`;
                });

                if (events.length > 10) {
                    summary += `\n...and ${events.length - 10} more events.`;
                }
            }

            if (overdue > 0) {
                summary += `\n\n**Note:** ${overdue} overdue event(s) may indicate wp-cron is not running properly. Consider checking your hosting configuration or using a real cron job.`;
            }

            return summary;
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from PHP.
         */
        execute: async (params) => {
            return executeAbility('wp-neural-admin/cron-list', {
                show_overdue: true,
            });
        },

        // Read-only operation - no confirmation needed.
        requiresConfirmation: false,
    });
}

export default registerCronList;
