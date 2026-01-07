/**
 * Plugin Deactivate Ability
 *
 * Deactivates a specific WordPress plugin by its slug.
 *
 * ABILITY OVERVIEW:
 * =================
 * This is a DESTRUCTIVE ability that modifies the WordPress configuration.
 * It demonstrates:
 * - Parameter extraction from natural language (finding plugin name in message)
 * - Plugin name to file path mapping (common plugins have known paths)
 * - Confirmation dialogs for destructive actions
 * - Error handling for missing/invalid parameters
 *
 * PHP BACKEND EXPECTS:
 * {
 *   plugin: "plugin-folder/plugin-file.php"  // e.g., "akismet/akismet.php"
 * }
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Plugin deactivated successfully."
 * }
 * // or on error:
 * {
 *   error: "Plugin not found or already inactive."
 * }
 *
 * @package WPNeuralAdmin
 * @see includes/abilities/plugin-deactivate.php for the PHP implementation
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Common plugin name mappings.
 *
 * Maps plugin file paths to common names users might say.
 * The API expects the plugin file path like "akismet/akismet.php" or "hello.php".
 *
 * WHY THIS EXISTS:
 * Users don't know (or want to know) plugin file paths. They say "deactivate Akismet"
 * not "deactivate akismet/akismet.php". This mapping handles common cases.
 *
 * For unknown plugins, we fall back to guessing: "my-plugin" -> "my-plugin/my-plugin.php"
 *
 * EXTENDING:
 * Add more mappings here for popular plugins you want to support by name.
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
 * PARAMETER EXTRACTION PATTERN:
 * When users say "deactivate the Akismet plugin", we need to:
 * 1. Check if it matches a known plugin in our mappings
 * 2. If not, try to extract the plugin name with regex
 * 3. Convert the extracted name to the expected file path format
 *
 * @param {string} userMessage - The user's natural language message.
 * @return {Object|null} Parameters object with plugin path, or null if not found.
 *
 * @example
 * extractParams("deactivate akismet") -> { plugin: "akismet/akismet.php" }
 * extractParams("turn off hello dolly") -> { plugin: "hello.php" }
 * extractParams("disable my-custom-plugin") -> { plugin: "my-custom-plugin/my-custom-plugin.php" }
 */
function extractParams(userMessage) {
    const msg = userMessage.toLowerCase();

    // First, try to match a known plugin from our mappings.
    // This handles common plugins where the file path isn't obvious.
    for (const [pluginPath, names] of Object.entries(pluginMappings)) {
        if (names.some(name => msg.includes(name))) {
            return { plugin: pluginPath };
        }
    }

    // No known plugin matched. Try to extract plugin name with regex patterns.
    // Support various phrasings: "deactivate X", "disable X", "turn off X"
    const patterns = [
        /deactivate\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/i,
        /disable\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/i,
        /turn\s+off\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/i,
    ];

    for (const pattern of patterns) {
        const match = userMessage.match(pattern);
        if (match && match[1]) {
            // Convert to slug format: lowercase, replace spaces with hyphens.
            const slug = match[1].trim().toLowerCase().replace(/\s+/g, '-');

            // Guess common plugin path format: plugin-name/plugin-name.php
            // This works for most plugins following WordPress conventions.
            return { plugin: `${slug}/${slug}.php` };
        }
    }

    // Could not extract plugin name from the message.
    return null;
}

/**
 * Register the plugin-deactivate ability with the chat system.
 */
export function registerPluginDeactivate() {
    registerAbility('wp-neural-admin/plugin-deactivate', {
        label: 'Deactivate plugins',

        // Limited keywords since this is a destructive action.
        // We want users to be explicit about wanting to deactivate.
        keywords: [
            'deactivate',
            'disable',
            'turn off',
            'deactivate plugin',
        ],

        initialMessage: "Deactivating the plugin...",

        /**
         * Generate summary from the result.
         *
         * @param {Object} result - The result from PHP.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            // Handle error case first.
            if (result.error) {
                return `Failed to deactivate plugin: ${result.error}`;
            }
            return result.message || 'Plugin has been deactivated successfully.';
        },

        // Export extractParams so it can be tested or reused.
        extractParams,

        /**
         * Execute the ability.
         *
         * PARAMETER EXTRACTION EXAMPLE:
         * This execute function demonstrates extracting parameters from
         * natural language. The user says "deactivate akismet" and we
         * need to figure out the actual plugin file path to send to PHP.
         *
         * @param {Object} params - Parameters from the chat system.
         * @param {string} params.userMessage - The user's original message.
         * @return {Promise<Object>} The result from PHP, or an error object.
         */
        execute: async ({ userMessage }) => {
            // Extract plugin path from the user's message.
            const params = extractParams(userMessage);

            // If we couldn't figure out which plugin, return a helpful error.
            if (!params || !params.plugin) {
                return {
                    error: 'Could not determine which plugin to deactivate. Please specify the plugin name, e.g., "deactivate hello dolly"'
                };
            }

            // Execute the PHP ability with the extracted parameters.
            return executeAbility('wp-neural-admin/plugin-deactivate', params);
        },

        // DESTRUCTIVE ACTION: Require user confirmation before executing.
        // This prevents accidental deactivation from misunderstood commands.
        requiresConfirmation: true,
        confirmationMessage: 'Are you sure you want to deactivate this plugin? This may affect your site functionality.',
    });
}

export default registerPluginDeactivate;
