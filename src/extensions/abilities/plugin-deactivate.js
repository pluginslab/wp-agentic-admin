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
 * @see includes/abilities/plugin-deactivate.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';
import {
	extractPluginParams,
	formatPluginActionResult,
} from './shared/plugin-helpers';

/**
 * Extract plugin slug from user message.
 *
 * Wrapper around shared helper with deactivation-specific keywords.
 *
 * @param {string} userMessage - The user's natural language message.
 * @return {Object|null} Parameters object with plugin path, or null if not found.
 *
 * @example
 * extractParams("deactivate akismet") -> { plugin: "akismet/akismet.php" }
 * extractParams("turn off hello dolly") -> { plugin: "hello.php" }
 * extractParams("disable my-custom-plugin") -> { plugin: "my-custom-plugin/my-custom-plugin.php" }
 */
function extractParams( userMessage ) {
	return extractPluginParams( userMessage, [
		'deactivate',
		'disable',
		'turn off',
	] );
}

/**
 * Register the plugin-deactivate ability with the chat system.
 */
export function registerPluginDeactivate() {
	registerAbility( 'wp-agentic-admin/plugin-deactivate', {
		label: 'Deactivate plugins',

		// Limited keywords since this is a destructive action.
		// We want users to be explicit about wanting to deactivate.
		keywords: [ 'deactivate', 'disable', 'turn off', 'deactivate plugin' ],

		initialMessage: 'Deactivating the plugin...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			return formatPluginActionResult(
				result,
				'Plugin has been deactivated successfully.'
			);
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
		 * @param {Object} params             - Parameters from the chat system.
		 * @param {string} params.userMessage - The user's original message.
		 * @return {Promise<Object>} The result from PHP, or an error object.
		 */
		execute: async ( { userMessage } ) => {
			// Extract plugin path from the user's message.
			const params = extractParams( userMessage );

			// If we couldn't figure out which plugin, return a helpful error.
			if ( ! params || ! params.plugin ) {
				return {
					error: 'Could not determine which plugin to deactivate. Please specify the plugin name, e.g., "deactivate hello dolly"',
				};
			}

			// Execute the PHP ability with the extracted parameters.
			return executeAbility(
				'wp-agentic-admin/plugin-deactivate',
				params
			);
		},

		// DESTRUCTIVE ACTION: Require user confirmation before executing.
		// This prevents accidental deactivation from misunderstood commands.
		requiresConfirmation: true,
		confirmationMessage:
			'Are you sure you want to deactivate this plugin? This may affect your site functionality.',
	} );
}

export default registerPluginDeactivate;
