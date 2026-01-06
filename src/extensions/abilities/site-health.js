/**
 * Site Health Ability
 * 
 * Gets comprehensive site health information.
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the site-health ability with the chat system.
 */
export function registerSiteHealth() {
    registerAbility('wp-neural-admin/site-health', {
        label: 'Check site health (PHP version, WordPress version, server info)',
        keywords: [
            'health',
            'version',
            'php',
            'mysql',
            'info',
            'status',
            'server',
            'wordpress version',
            'wp version',
            'memory',
            'memory limit',
            'theme',
            'url',
            'site url',
            'home url',
        ],
        initialMessage: "Let me check that for you...",
        
        /**
         * Generate human-readable summary from the result.
         * Provides context-aware responses based on what the user asked about.
         * 
         * @param {Object} result - API response.
         * @param {string} userMessage - The user's original message.
         * @return {string} Human-readable summary.
         */
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
        
        /**
         * Execute the ability.
         * 
         * @param {Object} params - Parameters from the chat system (includes userMessage).
         * @return {Promise<Object>} API response.
         */
        execute: async (params) => {
            // This ability doesn't require any input parameters
            return executeAbility('wp-neural-admin/site-health', {});
        },
        
        requiresConfirmation: false,
    });
}

export default registerSiteHealth;
