/**
 * WordPress Tools Registration
 *
 * Entry point for registering all WordPress SRE abilities and workflows
 * with the chat system. Uses the new extensible registration API.
 *
 * HOW TO ADD A NEW ABILITY:
 * 1. Create a new PHP file in includes/abilities/ with register_agentic_ability()
 * 2. Create a new JS file in src/extensions/abilities/ using registerAbility()
 * 3. Export it from src/extensions/abilities/index.js
 * 4. The ability will be automatically registered on init
 *
 * HOW TO ADD A NEW WORKFLOW:
 * 1. Create a new workflow in src/extensions/workflows/index.js using registerWorkflow()
 * 2. Or use the public API: wp.agenticAdmin.registerWorkflow(...)
 *
 * For third-party plugins, use the public API:
 * - PHP: add_action('wp_agentic_admin_register_abilities', ...)
 * - JS: wp.agenticAdmin.registerAbility(...)
 * - JS: wp.agenticAdmin.registerWorkflow(...)
 */

import { exposeGlobalAPI } from './agentic-abilities-api';
import { registerAllAbilities } from '../abilities';
import { registerAllInstructions } from '../instructions';
import { registerAllWorkflows } from '../workflows';
import { createLogger } from '../utils/logger';

const log = createLogger( 'WPTools' );

/**
 * Initialize WordPress tools.
 *
 * This function:
 * 1. Exposes the global API (wp.agenticAdmin.registerAbility, registerWorkflow, etc.)
 * 2. Registers all core abilities
 * 3. Registers all core workflows
 *
 * Called during app initialization.
 */
const registerWPTools = () => {
	log.info( 'Initializing WordPress tools...' );

	// Expose the global registration API for third-party plugins
	exposeGlobalAPI();

	// Register all core abilities
	registerAllAbilities();

	// Register all core instructions (must come after abilities)
	registerAllInstructions();

	// Register all core workflows
	registerAllWorkflows();

	log.info( 'WordPress tools initialized' );
};

/**
 * Get the count of registered tools.
 *
 * @return {number} Number of registered tools.
 */
const getToolCount = () => {
	const abilities = window.wp?.agenticAdmin?.getAbilities?.();
	return abilities ? abilities.length : 0;
};

export { registerWPTools, getToolCount };
export default registerWPTools;
