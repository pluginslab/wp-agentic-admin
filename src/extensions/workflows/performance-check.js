/**
 * Quick Performance Check Workflow
 *
 * A read-only diagnostic workflow that gathers information without modifying anything.
 *
 * Steps:
 * 1. Check site health - get PHP/WP/MySQL versions and configuration
 * 2. Read error log - conditionally executed based on context
 *
 * WORKFLOW DESIGN NOTES:
 * - No confirmation needed because it's read-only (doesn't modify data)
 * - Error log step uses `includeIf` to skip if debug mode is off AND
 *   user didn't specifically mention errors (more efficient than always trying)
 * - Useful for quick diagnostics when users report "something feels slow"
 * - Uses function-based includeIf for fast, deterministic logic (works with 1.5B model)
 * - Skips error log reading when not relevant (saves time, avoids unnecessary file I/O)
 *
 * @since 0.1.0
 */

import { registerWorkflow } from '../services/agentic-abilities-api';

/**
 * Register the "Quick Performance Check" workflow.
 */
export function registerPerformanceCheckWorkflow() {
    registerWorkflow('wp-agentic-admin/performance-check', {
        label: 'Quick Performance Check',
        description: 'Checks site health and reviews error logs for issues.',
        keywords: [
            'performance check',
            'health check',
            'check performance',
            'check site',
            'diagnose site',
            'site diagnosis',
            'check for errors',
            'check health and errors',
        ],
        steps: [
            {
                abilityId: 'wp-agentic-admin/site-health',
                label: 'Check site health status',
            },
            {
                abilityId: 'wp-agentic-admin/error-log-read',
                label: 'Review error logs',
                optional: true, // Still optional in case file read fails
                
                // Conditional execution based on context
                // Only read error log if:
                // 1. Debug mode is enabled (user has WP_DEBUG = true), OR
                // 2. User explicitly mentioned errors in their query
                includeIf: (previousResults, params) => {
                    // Get site health result
                    const healthResult = previousResults[0];
                    if (!healthResult?.success || !healthResult.result) {
                        // Health check failed - skip error log (no point)
                        return false;
                    }
                    
                    // Check if debug mode is enabled
                    const debugEnabled = healthResult.result.debug_mode === true;
                    
                    // Check if user mentioned errors in their query
                    const userMessage = params.userMessage?.toLowerCase() || '';
                    const mentionedErrors = userMessage.includes('error') || 
                                           userMessage.includes('warning') || 
                                           userMessage.includes('log');
                    
                    // Execute if debug mode is on OR user asked about errors
                    return debugEnabled || mentionedErrors;
                },
            },
        ],

        // Read-only workflows don't need confirmation.
        requiresConfirmation: false,

        /**
         * Generate performance check summary.
         *
         * Shows environment details and any errors found.
         * Handles the case where error log step fails gracefully.
         *
         * @param {StepResult[]} results - Completed step results.
         * @return {string} Markdown-formatted summary.
         */
        summarize: (results) => {
            const healthResult = results.find(r => r.abilityId === 'wp-agentic-admin/site-health');
            const errorResult = results.find(r => r.abilityId === 'wp-agentic-admin/error-log-read');

            let summary = 'Performance check complete.\n\n';

            // Site health data.
            // Extract specific fields to show users actionable info.
            if (healthResult?.success && healthResult.result) {
                const h = healthResult.result;
                summary += `**Environment:**\n`;
                summary += `- WordPress ${h.wordpress_version || 'unknown'}\n`;
                summary += `- PHP ${h.php_version || 'unknown'}\n`;
                summary += `- Memory: ${h.memory_limit || 'unknown'}\n`;

                // Warn about debug mode being enabled (common in dev, bad in production).
                if (h.debug_mode) {
                    summary += `- ⚠️ Debug mode is ON\n`;
                }
                summary += '\n';
            }

            // Error log data.
            // The error-log-read ability returns: { entries: [], file_exists, debug_enabled, total_lines }
            // Note: entries might be strings or objects depending on implementation.
            if (errorResult?.success && errorResult.result?.entries) {
                const entries = errorResult.result.entries;
                const errorCount = entries.length;

                if (errorCount > 0) {
                    summary += `**Error Log:** Found ${errorCount} recent entries\n`;

                    // Show first few errors to give users context.
                    // Truncate long messages to keep summary readable.
                    entries.slice(0, 3).forEach(entry => {
                        // Handle both string entries and object entries with .message
                        const msg = typeof entry === 'string' ? entry : entry.message;
                        const shortMsg = msg?.substring(0, 80) || 'Unknown error';
                        summary += `- ${shortMsg}${msg?.length > 80 ? '...' : ''}\n`;
                    });

                    if (errorCount > 3) {
                        summary += `- ...and ${errorCount - 3} more\n`;
                    }
                } else {
                    summary += `**Error Log:** No recent errors found ✓\n`;
                }
            } else if (errorResult?.skipped) {
                // Step was skipped by includeIf logic
                summary += `**Error Log:** Skipped (debug mode off, no errors mentioned)\n`;
            } else if (errorResult && !errorResult.success) {
                // Step failed - explain why this might happen.
                summary += `**Error Log:** Could not read (debug.log may not exist)\n`;
            }

            return summary;
        },
    });
}

export default registerPerformanceCheckWorkflow;
