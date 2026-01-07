/**
 * Error Log Read Ability
 *
 * Reads recent entries from the WordPress debug.log file.
 *
 * ABILITY OVERVIEW:
 * =================
 * Reads and parses the WordPress debug.log file.
 * Demonstrates:
 * - Handling multiple possible result states (file exists, debug enabled, etc.)
 * - Truncating long content for readability
 * - Providing actionable next steps in the summary
 *
 * PHP BACKEND RETURNS:
 * {
 *   entries: ["[01-Jan-2026 12:00:00] PHP Fatal error: ...", ...],
 *   file_exists: true,
 *   debug_enabled: true,
 *   total_lines: 150
 * }
 *
 * POSSIBLE STATES:
 * 1. file_exists: false - debug.log doesn't exist (logging never enabled)
 * 2. debug_enabled: false - WP_DEBUG_LOG is not true in wp-config.php
 * 3. entries: [] - File exists but is empty or has no recent entries
 * 4. entries: [...] - Found errors to display
 *
 * @package WPNeuralAdmin
 * @see includes/abilities/error-log-read.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the error-log-read ability with the chat system.
 */
export function registerErrorLogRead() {
    registerAbility('wp-neural-admin/error-log-read', {
        label: 'Read error logs',

        // Keywords cover both technical terms and user-language descriptions.
        // Users often describe symptoms ("white screen", "not working") rather
        // than asking directly for "error logs".
        keywords: [
            'error',
            'errors',
            'log',
            'logs',
            'problem',
            'issue',
            'broken',
            'white screen',
            'crash',
            'not working',
            'bug',
            'debug',
        ],

        initialMessage: "I'll look at your error log...",

        /**
         * Generate summary from the result.
         *
         * MULTI-STATE HANDLING:
         * This ability has several possible states to handle:
         * - File doesn't exist
         * - Debug logging not enabled
         * - File empty / no errors
         * - Errors found
         *
         * Each state gets a helpful message with actionable advice.
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            // State 1: debug.log file doesn't exist.
            // Common on new installs or when debug logging was never enabled.
            if (!result.file_exists) {
                return "No debug.log file found. Debug logging might not be enabled in your wp-config.php.";
            }

            // State 2: File exists but WP_DEBUG_LOG is not enabled.
            // The file might be old/stale from a previous debugging session.
            if (!result.debug_enabled) {
                return "Debug logging is not enabled. Add `define('WP_DEBUG_LOG', true);` to wp-config.php to capture errors.";
            }

            // State 3 & 4: File exists and logging is enabled.
            if (result.entries && result.entries.length > 0) {
                // Show last 5 entries - enough context without overwhelming.
                const recentEntries = result.entries.slice(-5);

                let summary = `I found **${result.total_lines} lines** in the error log. Here are the most recent entries:\n\n`;

                // Format each entry with truncation for long lines.
                recentEntries.forEach((entry, i) => {
                    const preview = entry.substring(0, 150);
                    summary += `${i + 1}. \`${preview}${entry.length > 150 ? '...' : ''}\`\n`;
                });

                // Provide actionable next step.
                summary += `\n**Tip:** Share these errors with your developer to help diagnose the issue.`;

                return summary;
            }

            // State 4b: File exists, logging enabled, but no errors.
            return 'No errors found in the error log. Your site looks healthy!';
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from PHP.
         */
        execute: async (params) => {
            // The PHP ability accepts optional 'lines' parameter to limit output.
            // For now we use the default (typically 50-100 lines).
            return executeAbility('wp-neural-admin/error-log-read', {});
        },

        // Read-only operation - no confirmation needed.
        requiresConfirmation: false,
    });
}

export default registerErrorLogRead;
