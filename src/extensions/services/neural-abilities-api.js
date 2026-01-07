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
import workflowRegistry from './workflow-registry';

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

    // Ensure annotations from PHP config are included
    // These come from meta.annotations in the PHP ability definition
    if (phpConfig.annotations && !merged.annotations) {
        merged.annotations = phpConfig.annotations;
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

// ============================================================================
// WORKFLOW API (v1.1)
// ============================================================================

/**
 * Register a multi-step workflow with the chat system.
 * 
 * Workflows define sequences of abilities that work together.
 * 
 * Usage from third-party plugins:
 * 
 * ```js
 * wp.neuralAdmin.registerWorkflow('my-plugin/cleanup-workflow', {
 *     label: 'Full Site Cleanup',
 *     description: 'Clears cache, optimizes database, and checks site health',
 *     keywords: ['full cleanup', 'site cleanup', 'maintenance'],
 *     steps: [
 *         {
 *             abilityId: 'wp-neural-admin/cache-flush',
 *             label: 'Clear all caches',
 *         },
 *         {
 *             abilityId: 'wp-neural-admin/db-optimize',
 *             label: 'Optimize database',
 *         },
 *         {
 *             abilityId: 'wp-neural-admin/site-health',
 *             label: 'Check site health',
 *         },
 *     ],
 *     requiresConfirmation: true,
 * });
 * ```
 * 
 * @param {string} id - Unique workflow identifier (e.g., 'my-plugin/my-workflow').
 * @param {Object} config - Workflow configuration.
 * @param {string} config.label - Human-readable name for the workflow.
 * @param {string} [config.description] - Description of what the workflow does.
 * @param {string[]} [config.keywords] - Keywords that trigger this workflow.
 * @param {Object[]} config.steps - Array of step definitions.
 * @param {string} config.steps[].abilityId - Ability ID for this step.
 * @param {string} config.steps[].label - Human-readable label for this step.
 * @param {Function} [config.steps[].mapParams] - Function to map previous results to params.
 * @param {Function} [config.steps[].rollback] - Rollback function if later steps fail.
 * @param {boolean} [config.steps[].optional=false] - If true, workflow continues if step fails.
 * @param {boolean} [config.requiresConfirmation=true] - Whether to confirm before execution.
 * @param {string} [config.confirmationMessage] - Custom confirmation message.
 * @param {Function} [config.summarize] - Function to generate summary from all results.
 * @return {boolean} True if registration succeeded.
 */
function registerWorkflow(id, config = {}) {
    if (!id || typeof id !== 'string') {
        console.error('[NeuralAbilitiesAPI] registerWorkflow: id must be a non-empty string');
        return false;
    }

    // Validate ID format (namespace/workflow-name)
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id)) {
        console.error(`[NeuralAbilitiesAPI] registerWorkflow: Invalid ID format "${id}". Must be "namespace/workflow-name".`);
        return false;
    }

    if (!config.label) {
        console.error(`[NeuralAbilitiesAPI] registerWorkflow: workflow "${id}" must have a label`);
        return false;
    }

    if (!config.steps || !Array.isArray(config.steps) || config.steps.length === 0) {
        console.error(`[NeuralAbilitiesAPI] registerWorkflow: workflow "${id}" must have at least one step`);
        return false;
    }

    // Validate each step references a valid ability
    for (const step of config.steps) {
        if (!step.abilityId) {
            console.error(`[NeuralAbilitiesAPI] registerWorkflow: each step in "${id}" must have an abilityId`);
            return false;
        }
        // Note: We don't validate if ability exists here because it might be registered later
    }

    try {
        workflowRegistry.register({
            id,
            ...config,
        });
        console.log(`[NeuralAbilitiesAPI] Registered workflow: ${id} (${config.steps.length} steps)`);
        return true;
    } catch (error) {
        console.error(`[NeuralAbilitiesAPI] registerWorkflow error:`, error.message);
        return false;
    }
}

/**
 * Unregister a workflow.
 * 
 * @param {string} id - Workflow identifier.
 * @return {boolean} True if workflow was unregistered.
 */
function unregisterWorkflow(id) {
    const removed = workflowRegistry.unregister(id);
    
    if (removed) {
        console.log(`[NeuralAbilitiesAPI] Unregistered workflow: ${id}`);
    }
    
    return removed;
}

/**
 * Get a registered workflow configuration.
 * 
 * @param {string} id - Workflow identifier.
 * @return {Object|undefined} Workflow configuration or undefined if not found.
 */
function getWorkflow(id) {
    return workflowRegistry.get(id);
}

/**
 * Get all registered workflows.
 * 
 * @return {Object[]} Array of workflow configurations.
 */
function getWorkflows() {
    return workflowRegistry.getAll();
}

/**
 * Check if a workflow is registered.
 * 
 * @param {string} id - Workflow identifier.
 * @return {boolean} True if workflow exists.
 */
function hasWorkflow(id) {
    return workflowRegistry.has(id);
}

/**
 * Expose API globally like Gutenberg does.
 * 
 * This allows third-party plugins to use:
 * 
 * Abilities API:
 * - wp.neuralAdmin.registerAbility()
 * - wp.neuralAdmin.unregisterAbility()
 * - wp.neuralAdmin.getAbility()
 * - wp.neuralAdmin.getAbilities()
 * - wp.neuralAdmin.hasAbility()
 * - wp.neuralAdmin.executeAbility()
 * 
 * Workflows API (v1.1):
 * - wp.neuralAdmin.registerWorkflow()
 * - wp.neuralAdmin.unregisterWorkflow()
 * - wp.neuralAdmin.getWorkflow()
 * - wp.neuralAdmin.getWorkflows()
 * - wp.neuralAdmin.hasWorkflow()
 */
function exposeGlobalAPI() {
    window.wp = window.wp || {};
    window.wp.neuralAdmin = window.wp.neuralAdmin || {};

    // Abilities API
    window.wp.neuralAdmin.registerAbility = registerAbility;
    window.wp.neuralAdmin.unregisterAbility = unregisterAbility;
    window.wp.neuralAdmin.getAbility = getAbility;
    window.wp.neuralAdmin.getAbilities = getAbilities;
    window.wp.neuralAdmin.hasAbility = hasAbility;
    window.wp.neuralAdmin.executeAbility = executeAbility;

    // Workflows API (v1.1)
    window.wp.neuralAdmin.registerWorkflow = registerWorkflow;
    window.wp.neuralAdmin.unregisterWorkflow = unregisterWorkflow;
    window.wp.neuralAdmin.getWorkflow = getWorkflow;
    window.wp.neuralAdmin.getWorkflows = getWorkflows;
    window.wp.neuralAdmin.hasWorkflow = hasWorkflow;

    console.log('[NeuralAbilitiesAPI] Global API exposed at wp.neuralAdmin (v1.1 with Workflows)');
}

// Export functions
export {
    // Abilities API
    registerAbility,
    unregisterAbility,
    getAbility,
    getAbilities,
    hasAbility,
    executeAbility,
    buildToolConfig,
    initializeFromPHPConfig,
    exposeGlobalAPI,
    // Workflows API (v1.1)
    registerWorkflow,
    unregisterWorkflow,
    getWorkflow,
    getWorkflows,
    hasWorkflow,
};

export default {
    // Abilities API
    registerAbility,
    unregisterAbility,
    getAbility,
    getAbilities,
    hasAbility,
    executeAbility,
    exposeGlobalAPI,
    // Workflows API (v1.1)
    registerWorkflow,
    unregisterWorkflow,
    getWorkflow,
    getWorkflows,
    hasWorkflow,
};
