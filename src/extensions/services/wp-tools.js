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
        keywords: ['health', 'version', 'php', 'mysql', 'info', 'status', 'server', 'wordpress version', 'wp version', 'memory', 'memory limit', 'theme', 'url', 'site url', 'home url'],
        initialMessage: "Let me check that for you...",
        summarize: (result, userMessage = '') => {
            const msg = userMessage.toLowerCase();
            
            // Check if user asked about something specific
            if (msg.includes('php')) {
                return `Your PHP version is **${result.php_version || 'Unknown'}**.`;
            }
            if (msg.includes('wordpress') || msg.includes('wp version')) {
                return `You're running **WordPress ${result.wordpress_version || 'Unknown'}**.`;
            }
            if (msg.includes('mysql') || msg.includes('database') || msg.includes('db version')) {
                return `Your database is **MySQL ${result.mysql_version || 'Unknown'}**.`;
            }
            if (msg.includes('server') || msg.includes('nginx') || msg.includes('apache')) {
                return `Your server is **${result.server_software || 'Unknown'}**.`;
            }
            if (msg.includes('theme')) {
                return `Your active theme is **${result.active_theme?.name || 'Unknown'}** (version ${result.active_theme?.version || '?'}).`;
            }
            if (msg.includes('memory')) {
                return `Your PHP memory limit is **${result.memory_limit || 'Unknown'}**.`;
            }
            if (msg.includes('url') || msg.includes('site address') || msg.includes('home')) {
                return `Your site URL is **${result.site_url || result.home_url || 'Unknown'}**.`;
            }
            
            // Full site health summary for general queries
            return `Here's your site health information:\n\n` +
                `**WordPress:** ${result.wordpress_version || 'Unknown'}\n` +
                `**PHP:** ${result.php_version || 'Unknown'}\n` +
                `**Database:** MySQL ${result.mysql_version || 'Unknown'}\n` +
                `**Server:** ${result.server_software || 'Unknown'}\n` +
                `**Theme:** ${result.active_theme?.name || 'Unknown'} (${result.active_theme?.version || '?'})\n` +
                `**Memory Limit:** ${result.memory_limit || 'Unknown'}`;
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
            if (result.error) {
                return `Failed to deactivate plugin: ${result.error}`;
            }
            return result.message || 'Plugin has been deactivated successfully.';
        },
        // Extract plugin slug from user message
        extractParams: (userMessage) => {
            const msg = userMessage.toLowerCase();
            
            // Common plugin name mappings (plugin file path -> common names)
            // The API expects the plugin file path like "hello-dolly/hello.php" or "hello.php"
            const pluginMappings = {
                'hello.php': ['hello dolly', 'hello-dolly', 'hellodolly'],
                'akismet/akismet.php': ['akismet', 'akismet anti-spam', 'anti-spam'],
                'jetpack/jetpack.php': ['jetpack'],
                'woocommerce/woocommerce.php': ['woocommerce', 'woo commerce', 'woo'],
                'contact-form-7/wp-contact-form-7.php': ['contact form 7', 'contact form', 'cf7'],
                'wordpress-seo/wp-seo.php': ['yoast', 'yoast seo'],
                'elementor/elementor.php': ['elementor'],
                'classic-editor/classic-editor.php': ['classic editor'],
                'wordfence/wordfence.php': ['wordfence'],
                'wp-super-cache/wp-cache.php': ['wp super cache', 'super cache'],
                'w3-total-cache/w3-total-cache.php': ['w3 total cache', 'total cache'],
            };
            
            // Try to match a known plugin
            for (const [pluginPath, names] of Object.entries(pluginMappings)) {
                if (names.some(name => msg.includes(name))) {
                    return { plugin: pluginPath };
                }
            }
            
            // Try to extract plugin name after keywords and guess the path
            const patterns = [
                /deactivate\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/i,
                /disable\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/i,
                /turn\s+off\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/i,
            ];
            
            for (const pattern of patterns) {
                const match = userMessage.match(pattern);
                if (match && match[1]) {
                    // Convert to slug format (lowercase, replace spaces with hyphens)
                    const slug = match[1].trim().toLowerCase().replace(/\s+/g, '-');
                    // Guess common plugin path format: plugin-name/plugin-name.php
                    return { plugin: `${slug}/${slug}.php` };
                }
            }
            
            return null; // Could not extract plugin name
        },
        execute: async ({ userMessage }) => {
            // Use extractParams to get the plugin path
            const tool = wpTools.find(t => t.id === 'wp-neural-admin/plugin-deactivate');
            const params = tool.extractParams(userMessage);
            
            if (!params || !params.plugin) {
                return { 
                    error: 'Could not determine which plugin to deactivate. Please specify the plugin name, e.g., "deactivate hello dolly"' 
                };
            }
            
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
