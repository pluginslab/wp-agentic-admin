/**
 * Plugin Activate Ability
 *
 * This file demonstrates:
 * - Natural language parameter extraction (matching plugin names to slugs)
 * - Calling PHP abilities from JavaScript
 * - Handling results and errors gracefully
 * - Non-destructive action (no confirmation required)
 */

// Import the ability registration helper.
import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';
import {
	extractPluginParams,
	formatPluginActionResult,
} from './shared/plugin-helpers';

/**
 * Extract plugin parameters from user message.
 *
 * Wrapper around shared helper with activation-specific keywords.
 *
 * @param {string} userMessage - The user's original message like "activate akismet"
 * @return {Object|null} Object with { plugin: "path/file.php" } or null if not found
 */
function extractParams( userMessage ) {
	return extractPluginParams( userMessage, [
		'activate',
		'enable',
		'turn on',
	] );
}

/**
 * Register the plugin-activate ability.
 *
 * This ability allows users to activate WordPress plugins through natural
 * language commands like "activate akismet" or "turn on woocommerce".
 *
 * NOTE: This ability has `requiresConfirmation: false` since activation
 * is generally less risky than deactivation.
 */
export function registerPluginActivate() {
	registerAbility( 'wp-agentic-admin/plugin-activate', {
		label: 'Activate plugins',
		description:
			'Activate a WordPress plugin by name or slug. Returns success or failure with the reason (e.g., plugin not found, already active).',

		// Keywords for activation-related commands.
		keywords: [
			'activate',
			'enable',
			'turn on',
			'activate plugin',
			'enable plugin',
		],

		initialMessage: 'Activating the plugin...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( result.actions?.length ) {
				return (
					result.message ||
					'Multiple plugins matched. Please select one:'
				);
			}
			const base = formatPluginActionResult(
				result,
				'Plugin has been activated successfully.'
			);
			if ( result.certainty && result.success ) {
				return `${ base } (match confidence: ${ result.certainty }/10)`;
			}
			return base;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( result.actions?.length ) {
				const names = result.actions
					.map( ( a ) => a.label )
					.join( ', ' );
				return `Multiple plugins matched. Candidates: ${ names }. Ask the user which one to activate.`;
			}
			if ( result.error ) {
				return `Plugin activation failed: ${ result.error }.`;
			}
			let msg =
				result.message || 'The plugin was activated successfully.';
			if ( result.certainty ) {
				msg += ` Match confidence: ${ result.certainty }/10.`;
			}
			return msg;
		},

		// Export extractParams so it can be tested or reused.
		extractParams,

		/**
		 * Execute the ability.
		 *
		 * PARAMETER EXTRACTION EXAMPLE:
		 * This execute function demonstrates extracting parameters from
		 * natural language. The user says "activate akismet" and we
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
					error: 'Could not determine which plugin to activate. Please specify the plugin name, e.g., "activate hello dolly"',
				};
			}

			// Execute the PHP ability with the extracted parameters.
			return executeAbility( 'wp-agentic-admin/plugin-activate', params );
		},

		// NON-DESTRUCTIVE ACTION: No confirmation needed.
		// Activation is generally safe and can be easily reversed.
		requiresConfirmation: false,
	} );
}

export default registerPluginActivate;
