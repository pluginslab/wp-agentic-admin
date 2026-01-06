/**
 * Error Log Read Ability
 * 
 * Reads recent entries from the WordPress debug.log file.
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the error-log-read ability with the chat system.
 */
export function registerErrorLogRead() {
    registerAbility('wp-neural-admin/error-log-read', {
        label: 'Read error logs',
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
         * Generate human-readable summary from the result.
         * 
         * @param {Object} result - API response.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            // API returns: entries (array of strings), file_exists, debug_enabled, total_lines
            if (!result.file_exists) {
                return "No debug.log file found. Debug logging might not be enabled in your wp-config.php.";
            }
            
            if (!result.debug_enabled) {
                return "Debug logging is not enabled. Add `define('WP_DEBUG_LOG', true);` to wp-config.php to capture errors.";
            }
            
            if (result.entries && result.entries.length > 0) {
                const recentEntries = result.entries.slice(-5); // Last 5 entries
                let summary = `I found **${result.total_lines} lines** in the error log. Here are the most recent entries:\n\n`;
                
                recentEntries.forEach((entry, i) => {
                    const preview = entry.substring(0, 150);
                    summary += `${i + 1}. \`${preview}${entry.length > 150 ? '...' : ''}\`\n`;
                });
                
                summary += `\n**Tip:** Share these errors with your developer to help diagnose the issue.`;
                
                return summary;
            }
            
            return 'No errors found in the error log. Your site looks healthy!';
        },
        
        /**
         * Execute the ability.
         * 
         * @param {Object} params - Parameters from the chat system (includes userMessage).
         * @return {Promise<Object>} API response.
         */
        execute: async (params) => {
            // This ability accepts optional 'lines' parameter, but we use default
            return executeAbility('wp-neural-admin/error-log-read', {});
        },
        
        requiresConfirmation: false,
    });
}

export default registerErrorLogRead;
