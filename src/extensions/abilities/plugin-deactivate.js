/**
 * Plugin Deactivate Ability
 * 
 * Deactivates a specific WordPress plugin by its slug.
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Common plugin name mappings (plugin file path -> common names).
 * The API expects the plugin file path like "hello-dolly/hello.php" or "hello.php".
 */
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

/**
 * Extract plugin slug from user message.
 * 
 * @param {string} userMessage - The user's message.
 * @return {Object|null} Parameters object with plugin path, or null if not found.
 */
function extractParams(userMessage) {
    const msg = userMessage.toLowerCase();
    
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
}

/**
 * Register the plugin-deactivate ability with the chat system.
 */
export function registerPluginDeactivate() {
    registerAbility('wp-neural-admin/plugin-deactivate', {
        label: 'Deactivate plugins',
        keywords: [
            'deactivate',
            'disable',
            'turn off',
            'deactivate plugin',
        ],
        initialMessage: "Deactivating the plugin...",
        
        /**
         * Generate human-readable summary from the result.
         * 
         * @param {Object} result - API response.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (result.error) {
                return `Failed to deactivate plugin: ${result.error}`;
            }
            return result.message || 'Plugin has been deactivated successfully.';
        },
        
        /**
         * Extract parameters from user message.
         */
        extractParams,
        
        /**
         * Execute the ability.
         * 
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} API response.
         */
        execute: async ({ userMessage }) => {
            const params = extractParams(userMessage);
            
            if (!params || !params.plugin) {
                return { 
                    error: 'Could not determine which plugin to deactivate. Please specify the plugin name, e.g., "deactivate hello dolly"' 
                };
            }
            
            return executeAbility('wp-neural-admin/plugin-deactivate', params);
        },
        
        requiresConfirmation: true,
        confirmationMessage: 'Are you sure you want to deactivate this plugin? This may affect your site functionality.',
    });
}

export default registerPluginDeactivate;
