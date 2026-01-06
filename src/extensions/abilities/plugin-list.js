/**
 * Plugin List Ability
 * 
 * Lists all installed WordPress plugins with their status.
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the plugin-list ability with the chat system.
 */
export function registerPluginList() {
    registerAbility('wp-neural-admin/plugin-list', {
        label: 'List installed plugins',
        keywords: [
            'plugin',
            'plugins',
            'installed',
            'extensions',
            'addons',
            'add-ons',
        ],
        initialMessage: "I'll check your installed plugins...",
        
        /**
         * Generate human-readable summary from the result.
         * 
         * @param {Object} result - API response.
         * @return {string} Human-readable summary.
         */
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
        
        /**
         * Execute the ability.
         * 
         * @param {Object} params - Parameters from the chat system (includes userMessage).
         * @return {Promise<Object>} API response.
         */
        execute: async (params) => {
            // This ability doesn't require any input parameters
            return executeAbility('wp-neural-admin/plugin-list', {});
        },
        
        requiresConfirmation: false,
    });
}

export default registerPluginList;
