/**
 * WordPress Tools Configuration
 * 
 * Defines all WordPress-specific tools (abilities) for the chat system.
 * Each tool includes keywords for detection, messages, and execution handlers.
 * 
 * HOW TO ADD A NEW TOOL:
 * 1. Register the ability in PHP (includes/class-abilities.php)
 * 2. Add a new tool object to the wpTools array below with:
 *    - id: Must match the PHP ability ID (e.g., 'wp-neural-admin/my-tool')
 *    - keywords: Array of words/phrases that trigger this tool
 *    - initialMessage: Shown while tool executes (streamed with typewriter effect)
 *    - summarize(result): Function that converts API result to human-readable text
 *    - execute(params): Async function that calls the ability API
 *    - requiresConfirmation: Set true for destructive actions (shows modal)
 * 3. Run `npm run build` to rebuild
 * 
 * KEYWORD TIPS:
 * - Longer keywords get higher scores (more specific = better match)
 * - Include common variations and synonyms
 * - Test with various phrasings to ensure reliable detection
 * 
 * @package WPNeuralAdmin
 */

import toolRegistry from './tool-registry';
import abilitiesApi from './abilities-api';

/**
 * WordPress SRE Tools Configuration
 * These map to the abilities registered in PHP
 */
const wpTools = [
    {
        id: 'wp-neural-admin/plugin-list',
        keywords: ['plugin', 'plugins', 'installed', 'extensions', 'addons', 'add-ons'],
        initialMessage: "I'll check your installed plugins...",
        summarize: (result) => {
            const { plugins, total, active } = result;
            const activePlugins = plugins.filter(p => p.active).map(p => p.name);
            const inactivePlugins = plugins.filter(p => !p.active).map(p => p.name);
            
            let summary = `I found ${total} plugins installed. ${active} are active and ${total - active} are inactive.\n\n`;
            
            if (activePlugins.length > 0) {
                summary += `**Active plugins:** ${activePlugins.join(', ')}\n\n`;
            }
            if (inactivePlugins.length > 0) {
                summary += `**Inactive plugins:** ${inactivePlugins.join(', ')}`;
            }
            return summary;
        },
        execute: async (params) => {
            return abilitiesApi.executeAbilityById('wp-neural-admin/plugin-list', params);
        },
        requiresConfirmation: false,
    },
    {
        id: 'wp-neural-admin/site-health',
        keywords: ['health', 'version', 'php', 'mysql', 'info', 'status', 'server', 'wordpress version', 'wp version'],
        initialMessage: "Let me check your site health information...",
        summarize: (result) => {
            const { wordpress, php, server, database } = result;
            return `Here's your site health information:\n\n` +
                `**WordPress:** ${wordpress?.version || 'Unknown'}\n` +
                `**PHP:** ${php?.version || 'Unknown'}\n` +
                `**Server:** ${server?.software || 'Unknown'}\n` +
                `**Database:** ${database?.server || 'Unknown'} ${database?.version || ''}`;
        },
        execute: async (params) => {
            return abilitiesApi.executeAbilityById('wp-neural-admin/site-health', params);
        },
        requiresConfirmation: false,
    },
    {
        id: 'wp-neural-admin/error-log-read',
        keywords: ['error', 'errors', 'log', 'logs', 'problem', 'issue', 'broken', 'white screen', 'crash', 'not working', 'bug', 'debug'],
        initialMessage: "I'll look at your error log...",
        summarize: (result) => {
            if (result.errors && result.errors.length > 0) {
                const errorCount = result.errors.length;
                const recentErrors = result.errors.slice(0, 3);
                let summary = `I found ${errorCount} error(s) in the log.\n\n`;
                
                if (recentErrors.length > 0) {
                    summary += `**Recent errors:**\n`;
                    recentErrors.forEach((err, i) => {
                        const preview = err.message?.substring(0, 100) || 'Unknown error';
                        summary += `${i + 1}. ${preview}${err.message?.length > 100 ? '...' : ''}\n`;
                    });
                }
                
                return summary;
            } else if (result.message) {
                return result.message;
            }
            return 'No errors found in the error log. Your site looks healthy!';
        },
        execute: async (params) => {
            return abilitiesApi.executeAbilityById('wp-neural-admin/error-log-read', params);
        },
        requiresConfirmation: false,
    },
    {
        id: 'wp-neural-admin/cache-flush',
        keywords: ['cache', 'flush', 'clear', 'purge', 'refresh', 'reset cache'],
        initialMessage: "Flushing the cache...",
        summarize: (result) => {
            return result.message || 'Cache has been flushed successfully. Your site should now serve fresh content.';
        },
        execute: async (params) => {
            return abilitiesApi.executeAbilityById('wp-neural-admin/cache-flush', params);
        },
        requiresConfirmation: false,
    },
    {
        id: 'wp-neural-admin/db-optimize',
        keywords: ['database', 'db', 'optimize', 'slow', 'performance', 'speed', 'cleanup', 'clean up'],
        initialMessage: "Optimizing the database...",
        summarize: (result) => {
            if (result.tables_optimized !== undefined) {
                return `Database optimization complete! ${result.tables_optimized} tables were optimized. This should help improve your site's performance.`;
            }
            return result.message || 'Database optimization complete.';
        },
        execute: async (params) => {
            return abilitiesApi.executeAbilityById('wp-neural-admin/db-optimize', params);
        },
        requiresConfirmation: false,
    },
    {
        id: 'wp-neural-admin/plugin-deactivate',
        keywords: ['deactivate', 'disable', 'turn off', 'deactivate plugin'],
        initialMessage: "Deactivating the plugin...",
        summarize: (result) => {
            return result.message || 'Plugin has been deactivated successfully.';
        },
        execute: async (params) => {
            return abilitiesApi.executeAbilityById('wp-neural-admin/plugin-deactivate', params);
        },
        requiresConfirmation: true,
        confirmationMessage: 'Are you sure you want to deactivate this plugin? This may affect your site functionality.',
    },
];

/**
 * Register all WordPress tools with the registry
 */
const registerWPTools = () => {
    console.log('[WPTools] Registering WordPress tools...');
    toolRegistry.registerAll(wpTools);
    console.log(`[WPTools] Registered ${wpTools.length} tools`);
};

/**
 * Get a specific tool configuration by ID
 * 
 * @param {string} id - Tool ID
 * @return {Object|undefined}
 */
const getToolConfig = (id) => {
    return wpTools.find(tool => tool.id === id);
};

/**
 * Get all tool IDs
 * 
 * @return {string[]}
 */
const getToolIds = () => {
    return wpTools.map(tool => tool.id);
};

export { wpTools, registerWPTools, getToolConfig, getToolIds };
export default registerWPTools;
