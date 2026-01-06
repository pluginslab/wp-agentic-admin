/**
 * Neural Abilities Registration API
 * 
 * Public API for registering neural abilities from third-party plugins.
 * Similar to how Gutenberg exposes wp.blocks.registerBlockType().
 * 
 * Usage from third-party plugins:
 * 
 * ```js
 * wp.neuralAdmin.registerAbility('my-plugin/my-ability', {
 *     keywords: ['my', 'ability'],
 *     initialMessage: 'Running my ability...',
 *     summarize: (result) => `Result: ${result.data}`,
 *     execute: async (params) => {
 *         return await wp.neuralAdmin.executeAbility('my-plugin/my-ability', params);
 *     },
 *     requiresConfirmation: false,
 * });
 * ```
 * 
 * @package WPNeuralAdmin
 */

import toolRegistry from './tool-registry';
import abilitiesApi from './abilities-api';

/**
 * Store for ability configurations that need JS-specific handlers.
 * This merges with PHP-provided config from wpNeuralAdmin.abilities.
 */
const abilityExtensions = new Map();

/**
 * Register a neural ability with the chat system.
 * 
 * This function allows third-party plugins to register their own abilities.
 * It can be called after the wp-neural-admin scripts are loaded.
 * 
 * @param {string} id - Unique ability identifier (e.g., 'my-plugin/my-ability').
 *                      Must match the ID used in register_neural_ability() in PHP.
 * @param {Object} config - Ability configuration.
 * @param {string[]} [config.keywords] - Keywords that trigger this ability.
 * @param {string} [config.initialMessage] - Message shown while ability executes.
 * @param {Function} [config.summarize] - Function to generate human-readable summary from result.
 * @param {Function} [config.execute] - Async function that executes the ability.
 * @param {Function} [config.extractParams] - Function to extract parameters from user message.
 * @param {boolean} [config.requiresConfirmation=false] - Whether to show confirmation modal.
 * @param {string} [config.confirmationMessage] - Custom confirmation message.
 * @return {boolean} True if registration succeeded.
 */
function registerAbility(id, config = {}) {
    if (!id || typeof id !== 'string') {
        console.error('[NeuralAbilitiesAPI] registerAbility: id must be a non-empty string');
        return false;
    }

    // Validate ID format (namespace/ability-name)
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id)) {
        console.error(`[NeuralAbilitiesAPI] registerAbility: Invalid ID format "${id}". Must be "namespace/ability-name".`);
        return false;
    }

    // Store the extension config
    abilityExtensions.set(id, config);

    // Build the full tool config
    const toolConfig = buildToolConfig(id, config);

    // Register with the tool registry
    toolRegistry.register(toolConfig);

    console.log(`[NeuralAbilitiesAPI] Registered ability: ${id}`);
    return true;
}

/**
 * Unregister a neural ability.
 * 
 * @param {string} id - Ability identifier.
 * @return {boolean} True if ability was unregistered.
 */
function unregisterAbility(id) {
    const removed = toolRegistry.unregister(id);
    abilityExtensions.delete(id);
    
    if (removed) {
        console.log(`[NeuralAbilitiesAPI] Unregistered ability: ${id}`);
    }
    
    return removed;
}

/**
 * Get a registered ability configuration.
 * 
 * @param {string} id - Ability identifier.
 * @return {Object|undefined} Ability configuration or undefined if not found.
 */
function getAbility(id) {
    return toolRegistry.get(id);
}

/**
 * Get all registered abilities.
 * 
 * @return {Object[]} Array of ability configurations.
 */
function getAbilities() {
    return toolRegistry.getAll();
}

/**
 * Check if an ability is registered.
 * 
 * @param {string} id - Ability identifier.
 * @return {boolean} True if ability exists.
 */
function hasAbility(id) {
    return toolRegistry.has(id);
}

/**
 * Execute an ability by ID.
 * 
 * Helper function that third-party plugins can use in their execute functions.
 * 
 * @param {string} id - Ability identifier.
 * @param {Object} params - Parameters to pass to the ability.
 * @return {Promise<Object>} Ability result.
 */
async function executeAbility(id, params = {}) {
    return abilitiesApi.executeAbilityById(id, params);
}

/**
 * Build a tool configuration from ability config.
 * 
 * Merges PHP-provided config (from wpNeuralAdmin.abilities) with JS-specific handlers.
 * 
 * @param {string} id - Ability identifier.
 * @param {Object} jsConfig - JS-specific configuration.
 * @return {Object} Complete tool configuration for the registry.
 */
function buildToolConfig(id, jsConfig) {
    // Get PHP-provided config if available
    const phpConfig = window.wpNeuralAdmin?.abilities?.[id] || {};

    // Merge configs: JS overrides PHP
    const merged = {
        ...phpConfig,
        ...jsConfig,
        id,
    };

    // Ensure keywords is an array
    if (!Array.isArray(merged.keywords)) {
        merged.keywords = [];
    }

    // Set default execute function if not provided
    if (!merged.execute || typeof merged.execute !== 'function') {
        merged.execute = async (params) => {
            return abilitiesApi.executeAbilityById(id, params);
        };
    }

    // Set default summarize function if not provided
    if (!merged.summarize || typeof merged.summarize !== 'function') {
        merged.summarize = (result) => {
            if (result.message) {
                return result.message;
            }
            if (result.success !== undefined) {
                return result.success ? 'Operation completed successfully.' : 'Operation failed.';
            }
            return 'Task completed. See details below.';
        };
    }

    // Set default initial message if not provided
    if (!merged.initialMessage) {
        merged.initialMessage = 'Working on it...';
    }

    return merged;
}

/**
 * Initialize abilities from PHP configuration.
 * 
 * Called during script initialization to register abilities
 * that were defined in PHP and passed via wp_localize_script.
 */
function initializeFromPHPConfig() {
    const phpAbilities = window.wpNeuralAdmin?.abilities || {};
    
    console.log('[NeuralAbilitiesAPI] Initializing from PHP config:', Object.keys(phpAbilities));

    // These will be registered by individual JS ability files
    // that call registerAbility() with their specific handlers.
    // This function just logs what's available from PHP.
}

/**
 * Expose API globally like Gutenberg does.
 * 
 * This allows third-party plugins to use:
 * - wp.neuralAdmin.registerAbility()
 * - wp.neuralAdmin.unregisterAbility()
 * - wp.neuralAdmin.getAbility()
 * - wp.neuralAdmin.getAbilities()
 * - wp.neuralAdmin.hasAbility()
 * - wp.neuralAdmin.executeAbility()
 */
function exposeGlobalAPI() {
    window.wp = window.wp || {};
    window.wp.neuralAdmin = window.wp.neuralAdmin || {};

    // Public API
    window.wp.neuralAdmin.registerAbility = registerAbility;
    window.wp.neuralAdmin.unregisterAbility = unregisterAbility;
    window.wp.neuralAdmin.getAbility = getAbility;
    window.wp.neuralAdmin.getAbilities = getAbilities;
    window.wp.neuralAdmin.hasAbility = hasAbility;
    window.wp.neuralAdmin.executeAbility = executeAbility;

    console.log('[NeuralAbilitiesAPI] Global API exposed at wp.neuralAdmin');
}

// Export functions
export {
    registerAbility,
    unregisterAbility,
    getAbility,
    getAbilities,
    hasAbility,
    executeAbility,
    buildToolConfig,
    initializeFromPHPConfig,
    exposeGlobalAPI,
};

export default {
    registerAbility,
    unregisterAbility,
    getAbility,
    getAbilities,
    hasAbility,
    executeAbility,
    exposeGlobalAPI,
};
