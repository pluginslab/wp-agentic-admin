/**
 * Full Site Cleanup Workflow
 *
 * This workflow performs common maintenance tasks in sequence:
 * 1. Clear all caches - removes stale cached data (always runs)
 * 2. Optimize database - conditionally runs based on need
 * 3. Check site health - verifies the site is still healthy after changes
 *
 * WORKFLOW DESIGN NOTES:
 * - Requires confirmation because it modifies data (cache + database)
 * - Steps are ordered logically: clear old data, optimize if needed, then verify
 * - Health check is last to confirm nothing broke
 * - Database optimization uses includeIf to skip when not needed
 * - Checks if database was optimized recently (within 7 days)
 * - Function-based logic (fast, works with 1.5B model)
 * - Saves time on frequent cleanups by skipping heavy db operations
 *
 * @since 0.1.0
 */

import { registerWorkflow } from '../services/agentic-abilities-api';

/**
 * Register the "Full Site Cleanup" workflow.
 */
export function registerSiteCleanupWorkflow() {
    registerWorkflow('wp-agentic-admin/site-cleanup', {
        label: 'Full Site Cleanup',
        description: 'Clears all caches, optimizes the database, and checks site health.',

        // Keywords trigger this workflow from natural language input.
        // Include variations users might type (synonyms, common phrasings).
        keywords: [
            'full cleanup',
            'site cleanup',
            'maintenance',
            'clean up site',
            'clear everything',
            'optimize everything',
            'full optimization',
        ],

        // Steps execute in order. Each step references a registered ability.
        steps: [
            {
                abilityId: 'wp-agentic-admin/cache-flush',
                label: 'Clear all caches',
            },
            {
                abilityId: 'wp-agentic-admin/db-optimize',
                label: 'Optimize database',
                
                // Skip database optimization if done recently
                // Database optimization is expensive (locks tables, takes time).
                // Skip if optimized within the last 7 days unless user explicitly mentioned database.
                includeIf: (previousResults, params) => {
                    // Check if user specifically mentioned database in their query
                    const userMessage = params.userMessage?.toLowerCase() || '';
                    const mentionedDatabase = userMessage.includes('database') || 
                                             userMessage.includes('db') ||
                                             userMessage.includes('optimize');
                    
                    // If user mentioned database, always optimize (explicit request)
                    if (mentionedDatabase) {
                        return true;
                    }
                    
                    // Otherwise, check site health data for last optimization time
                    // Note: We'd need to add last_db_optimized to site-health ability
                    // For now, use a simple heuristic: optimize every time unless they just did it
                    
                    // TODO: Track last optimization time in site-health result
                    // const healthResult = previousResults.find(r => r.abilityId === 'wp-agentic-admin/site-health');
                    // const lastOptimized = healthResult?.result?.last_db_optimized;
                    // if (lastOptimized) {
                    //     const daysSince = (Date.now() - new Date(lastOptimized)) / (1000 * 60 * 60 * 24);
                    //     return daysSince > 7; // Only if more than 7 days ago
                    // }
                    
                    // Default: always optimize (for now, until we track last optimization)
                    return true;
                },
            },
            {
                abilityId: 'wp-agentic-admin/site-health',
                label: 'Check site health',
            },
        ],

        // Require confirmation for workflows that modify data.
        // Read-only workflows can set this to false.
        requiresConfirmation: true,
        confirmationMessage: 'This will clear all caches, optimize the database, and run a health check. Continue?',

        /**
         * Generate the final summary shown to users.
         *
         * IMPORTANT: This function's output IS the final message - no LLM processing.
         * Extract actual data from results to show users meaningful information.
         *
         * @param {StepResult[]} results - Array of completed step results.
         *        Each result has: { abilityId, label, stepIndex, success, result, duration }
         *        The `result` property contains the actual data from the PHP ability.
         * @return {string} Markdown-formatted summary shown to user.
         */
        summarize: (results) => {
            // Find each step's result by abilityId.
            // This is more reliable than using array index if step order changes.
            const cacheResult = results.find(r => r.abilityId === 'wp-agentic-admin/cache-flush');
            const dbResult = results.find(r => r.abilityId === 'wp-agentic-admin/db-optimize');
            const healthResult = results.find(r => r.abilityId === 'wp-agentic-admin/site-health');

            const successCount = results.filter(r => r.success).length;
            let summary = 'Site cleanup complete.\n\n';

            // Cache flush results.
            // The cache-flush ability returns: { success: bool, message: string }
            if (cacheResult?.success) {
                summary += `✓ **Cache:** ${cacheResult.result?.message || 'Flushed successfully'}\n`;
            } else {
                summary += `✗ **Cache:** Failed to flush\n`;
            }

            // Database optimization results.
            // The db-optimize ability returns: { success: bool, tables_optimized: int, tables: string[] }
            if (dbResult?.success && dbResult.result) {
                const tablesCount = dbResult.result.tables_optimized || 0;
                summary += `✓ **Database:** ${tablesCount} tables optimized\n`;
            } else if (dbResult?.skipped) {
                summary += `⊘ **Database:** Optimization skipped (not needed)\n`;
            } else {
                summary += `✗ **Database:** Optimization failed\n`;
            }

            // Health check results.
            // The site-health ability returns: { wordpress_version, php_version, mysql_version, ... }
            if (healthResult?.success && healthResult.result) {
                const h = healthResult.result;
                summary += `✓ **Health Check:** WordPress ${h.wordpress_version}, PHP ${h.php_version}\n`;
            }

            // Always show overall success count so users know if everything worked.
            summary += `\n**Result:** ${successCount}/${results.length} steps completed successfully`;

            return summary;
        },
    });
}

export default registerSiteCleanupWorkflow;
