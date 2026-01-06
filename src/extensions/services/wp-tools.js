/**
 * WordPress Tools Registration
 * 
 * Entry point for registering all WordPress SRE abilities with the chat system.
 * Uses the new extensible registration API.
 * 
 * HOW TO ADD A NEW ABILITY:
 * 1. Create a new PHP file in includes/abilities/ with register_neural_ability()
 * 2. Create a new JS file in src/extensions/abilities/ using registerAbility()
 * 3. Export it from src/extensions/abilities/index.js
 * 4. The ability will be automatically registered on init
 * 
 * For third-party plugins, use the public API:
 * - PHP: add_action('wp_neural_admin_register_abilities', ...)
 * - JS: wp.neuralAdmin.registerAbility(...)
 * 
 * @package WPNeuralAdmin
 */

import { exposeGlobalAPI } from './neural-abilities-api';
import { registerAllAbilities } from '../abilities';

/**
 * Initialize WordPress tools.
 * 
 * This function:
 * 1. Exposes the global API (wp.neuralAdmin.registerAbility, etc.)
 * 2. Registers all core abilities
 * 
 * Called during app initialization.
 */
const registerWPTools = () => {
    console.log('[WPTools] Initializing WordPress tools...');

    // Expose the global registration API for third-party plugins
    exposeGlobalAPI();

    // Register all core abilities
    registerAllAbilities();

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
