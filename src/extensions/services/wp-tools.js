/**
 * WordPress Tools Registration
 * 
 * Entry point for registering all WordPress SRE abilities and workflows
 * with the chat system. Uses the new extensible registration API.
 * 
 * HOW TO ADD A NEW ABILITY:
 * 1. Create a new PHP file in includes/abilities/ with register_neural_ability()
 * 2. Create a new JS file in src/extensions/abilities/ using registerAbility()
 * 3. Export it from src/extensions/abilities/index.js
 * 4. The ability will be automatically registered on init
 * 
 * HOW TO ADD A NEW WORKFLOW (v1.1):
 * 1. Create a new workflow in src/extensions/workflows/index.js using registerWorkflow()
 * 2. Or use the public API: wp.neuralAdmin.registerWorkflow(...)
 * 
 * For third-party plugins, use the public API:
 * - PHP: add_action('wp_neural_admin_register_abilities', ...)
 * - JS: wp.neuralAdmin.registerAbility(...)
 * - JS: wp.neuralAdmin.registerWorkflow(...) (v1.1)
 * 
 * @package WPNeuralAdmin
 */

import { exposeGlobalAPI } from './neural-abilities-api';
import { registerAllAbilities } from '../abilities';
import { registerAllWorkflows } from '../workflows';

/**
 * Initialize WordPress tools.
 * 
 * This function:
 * 1. Exposes the global API (wp.neuralAdmin.registerAbility, registerWorkflow, etc.)
 * 2. Registers all core abilities
 * 3. Registers all core workflows (v1.1)
 * 
 * Called during app initialization.
 */
const registerWPTools = () => {
    console.log('[WPTools] Initializing WordPress tools...');

    // Expose the global registration API for third-party plugins
    exposeGlobalAPI();

    // Register all core abilities
    registerAllAbilities();

    // Register all core workflows (v1.1)
    registerAllWorkflows();

    console.log('[WPTools] WordPress tools initialized');
};

/**
 * Get the count of registered tools.
 * 
 * @return {number} Number of registered tools.
 */
const getToolCount = () => {
    const abilities = window.wp?.neuralAdmin?.getAbilities?.();
    return abilities ? abilities.length : 0;
};

export { registerWPTools, getToolCount };
export default registerWPTools;
