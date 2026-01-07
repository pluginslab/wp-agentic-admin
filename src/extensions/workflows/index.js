/**
 * Built-in Workflows
 *
 * Pre-defined multi-step workflows using existing abilities.
 * These workflows are registered during initialization and provide
 * common WordPress maintenance operations.
 *
 * DEVELOPER NOTES:
 * ================
 * Workflows chain multiple abilities together as a single user action.
 * Unlike single abilities (where the LLM generates responses), workflow
 * summaries use the `summarize` function DIRECTLY - the LLM is bypassed.
 *
 * This means your `summarize` function is critical for user experience.
 * A poor summarize function = useless output like "Completed 2 steps".
 * A good summarize function = rich, actionable data shown to the user.
 *
 * Key concepts:
 * - `results` array contains StepResult objects for each completed step
 * - Each StepResult has: abilityId, label, stepIndex, success, result, duration
 * - The actual data is in `stepResult.result` (whatever the PHP ability returned)
 * - Use `results.find(r => r.abilityId === '...')` to get specific step results
 * - Always check `stepResult?.success` before accessing `stepResult.result`
 *
 * @package WPNeuralAdmin
 * @since 1.1.0
 * @see docs/workflows-guide.md for complete documentation
 */

import { registerWorkflow } from '../services/neural-abilities-api';

/**
 * Register the "Full Site Cleanup" workflow.
 *
 * This workflow performs common maintenance tasks in sequence:
 * 1. Clear all caches - removes stale cached data
 * 2. Optimize database - runs OPTIMIZE TABLE on all tables
 * 3. Check site health - verifies the site is still healthy after changes
 *
 * WORKFLOW DESIGN NOTES:
 * - Requires confirmation because it modifies data (cache + database)
 * - Steps are ordered logically: clear old data, optimize, then verify
 * - Health check is last to confirm nothing broke
 */
function registerSiteCleanupWorkflow() {
    registerWorkflow('wp-neural-admin/site-cleanup', {
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
                abilityId: 'wp-neural-admin/cache-flush',
                label: 'Clear all caches',
            },
            {
                abilityId: 'wp-neural-admin/db-optimize',
                label: 'Optimize database',
            },
            {
                abilityId: 'wp-neural-admin/site-health',
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
            const cacheResult = results.find(r => r.abilityId === 'wp-neural-admin/cache-flush');
            const dbResult = results.find(r => r.abilityId === 'wp-neural-admin/db-optimize');
            const healthResult = results.find(r => r.abilityId === 'wp-neural-admin/site-health');

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

/**
 * Register the "Quick Performance Check" workflow.
 *
 * A read-only diagnostic workflow that gathers information without modifying anything.
 *
 * Steps:
 * 1. Check site health - get PHP/WP/MySQL versions and configuration
 * 2. Read error log - look for recent errors (optional step)
 *
 * WORKFLOW DESIGN NOTES:
 * - No confirmation needed because it's read-only (doesn't modify data)
 * - Error log step is marked `optional: true` so workflow continues even if
 *   debug.log doesn't exist or is unreadable
 * - Useful for quick diagnostics when users report "something feels slow"
 */
function registerPerformanceCheckWorkflow() {
    registerWorkflow('wp-neural-admin/performance-check', {
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
                abilityId: 'wp-neural-admin/site-health',
                label: 'Check site health status',
            },
            {
                abilityId: 'wp-neural-admin/error-log-read',
                label: 'Review error logs',
                // Optional steps don't fail the workflow if they error.
                // Use for steps that might legitimately fail (e.g., debug.log not existing).
                optional: true,
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
            const healthResult = results.find(r => r.abilityId === 'wp-neural-admin/site-health');
            const errorResult = results.find(r => r.abilityId === 'wp-neural-admin/error-log-read');

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
            } else if (errorResult && !errorResult.success) {
                // Step failed - explain why this might happen.
                summary += `**Error Log:** Could not read (debug.log may not exist)\n`;
            }

            return summary;
        },
    });
}

/**
 * Register the "Plugin Audit" workflow.
 *
 * Helps users understand their plugin landscape and identify potential issues.
 *
 * Steps:
 * 1. List all plugins - get names, versions, active/inactive status
 * 2. Check site health - provides context about the environment
 *
 * WORKFLOW DESIGN NOTES:
 * - Read-only, so no confirmation needed
 * - Inactive plugins are flagged because they're often forgotten and can be
 *   security risks or just clutter
 * - Combines plugin data with environment info for context
 */
function registerPluginAuditWorkflow() {
    registerWorkflow('wp-neural-admin/plugin-audit', {
        label: 'Plugin Audit',
        description: 'Lists all plugins and checks for plugin-related issues.',
        keywords: [
            'plugin audit',
            'audit plugins',
            'check plugins',
            'plugin health',
            'plugin status',
            'review plugins',
            'plugin review',
        ],
        steps: [
            {
                abilityId: 'wp-neural-admin/plugin-list',
                label: 'List all installed plugins',
            },
            {
                abilityId: 'wp-neural-admin/site-health',
                label: 'Check for plugin-related issues',
            },
        ],
        requiresConfirmation: false,

        /**
         * Generate plugin audit summary.
         *
         * This is an example of a data-rich summary that shows:
         * - Overview counts (total, active, inactive)
         * - Full plugin lists with versions
         * - Actionable hints (inactive plugins should be removed)
         * - Environment context
         *
         * @param {StepResult[]} results - Completed step results.
         * @return {string} Markdown-formatted summary.
         */
        summarize: (results) => {
            const pluginResult = results.find(r => r.abilityId === 'wp-neural-admin/plugin-list');
            const healthResult = results.find(r => r.abilityId === 'wp-neural-admin/site-health');

            let summary = 'Plugin audit complete.\n\n';

            // Plugin data.
            // The plugin-list ability returns: { plugins: [], total: int, active: int }
            // Each plugin has: { name, slug, version, active }
            if (pluginResult?.success && pluginResult.result) {
                // Destructure with defaults to handle missing data gracefully.
                const { plugins = [], total = 0, active = 0 } = pluginResult.result;
                const inactive = total - active;

                // Show counts first for quick overview.
                summary += `**Plugins Overview:**\n`;
                summary += `- Total: ${total} plugins\n`;
                summary += `- Active: ${active}\n`;
                summary += `- Inactive: ${inactive}${inactive > 0 ? ' ⚠️' : ''}\n\n`;

                // Show actual plugin names - this is what makes the summary useful.
                if (plugins.length > 0) {
                    const activePlugins = plugins.filter(p => p.active);
                    const inactivePlugins = plugins.filter(p => !p.active);

                    if (activePlugins.length > 0) {
                        summary += `**Active Plugins:**\n`;
                        activePlugins.forEach(p => {
                            summary += `- ${p.name} (v${p.version})\n`;
                        });
                        summary += '\n';
                    }

                    // Flag inactive plugins with actionable advice.
                    if (inactivePlugins.length > 0) {
                        summary += `**Inactive Plugins** (consider removing):\n`;
                        inactivePlugins.forEach(p => {
                            summary += `- ${p.name} (v${p.version})\n`;
                        });
                        summary += '\n';
                    }
                }
            }

            // Add environment context at the end.
            if (healthResult?.success && healthResult.result) {
                const h = healthResult.result;
                summary += `**Environment:** WordPress ${h.wordpress_version || '?'}, PHP ${h.php_version || '?'}, Theme: ${h.active_theme?.name || 'unknown'}`;
            }

            return summary;
        },
    });
}

/**
 * Register the "Database Maintenance" workflow.
 *
 * Optimizes database tables and clears caches for best results.
 *
 * Steps:
 * 1. Optimize database - runs OPTIMIZE TABLE on all WordPress tables
 * 2. Clear caches - ensures cached queries are refreshed with optimized tables
 *
 * WORKFLOW DESIGN NOTES:
 * - Requires confirmation because it modifies the database
 * - Cache clear comes AFTER optimization so queries are re-cached against
 *   the optimized tables
 * - Shows actual table names to prove work was done
 */
function registerDatabaseMaintenanceWorkflow() {
    registerWorkflow('wp-neural-admin/database-maintenance', {
        label: 'Database Maintenance',
        description: 'Optimizes the database and clears related caches.',
        keywords: [
            'database maintenance',
            'db maintenance',
            'optimize database',
            'database cleanup',
            'db cleanup',
            'fix database',
            'repair database',
        ],
        steps: [
            {
                abilityId: 'wp-neural-admin/db-optimize',
                label: 'Optimize database tables',
            },
            {
                abilityId: 'wp-neural-admin/cache-flush',
                label: 'Clear caches after optimization',
            },
        ],
        requiresConfirmation: true,
        confirmationMessage: 'This will optimize database tables and clear caches. Continue?',

        /**
         * Generate database maintenance summary.
         *
         * Shows concrete evidence of work done (table count, table names).
         * This builds user trust - they can see exactly what happened.
         *
         * @param {StepResult[]} results - Completed step results.
         * @return {string} Markdown-formatted summary.
         */
        summarize: (results) => {
            const dbResult = results.find(r => r.abilityId === 'wp-neural-admin/db-optimize');
            const cacheResult = results.find(r => r.abilityId === 'wp-neural-admin/cache-flush');

            let summary = 'Database maintenance complete.\n\n';

            // Database optimization results.
            // The db-optimize ability returns: { success, tables_optimized, tables: [] }
            if (dbResult?.success && dbResult.result) {
                const { tables_optimized = 0, tables = [] } = dbResult.result;
                summary += `✓ **Optimized ${tables_optimized} tables**\n`;

                // Show some table names as proof of work.
                // Limit to 5 to keep the summary manageable.
                if (tables.length > 0) {
                    const displayTables = tables.slice(0, 5);
                    displayTables.forEach(t => {
                        summary += `  - ${t}\n`;
                    });
                    if (tables.length > 5) {
                        summary += `  - ...and ${tables.length - 5} more\n`;
                    }
                }
                summary += '\n';
            } else {
                summary += `✗ **Database optimization failed**\n\n`;
            }

            // Cache clear confirmation.
            if (cacheResult?.success) {
                summary += `✓ **Cache cleared** after optimization`;
            } else {
                summary += `✗ **Cache clear failed**`;
            }

            return summary;
        },
    });
}

/**
 * Register all built-in workflows.
 *
 * Called during plugin initialization to register all pre-defined workflows.
 * Third-party plugins can register additional workflows using:
 *   wp.neuralAdmin.registerWorkflow('my-plugin/my-workflow', { ... })
 *
 * @see docs/workflows-guide.md for how to create custom workflows
 * @see docs/third-party-integration.md for integration examples
 */
export function registerAllWorkflows() {
    registerSiteCleanupWorkflow();
    registerPerformanceCheckWorkflow();
    registerPluginAuditWorkflow();
    registerDatabaseMaintenanceWorkflow();

    console.log('[Workflows] All built-in workflows registered');
}

export default registerAllWorkflows;
