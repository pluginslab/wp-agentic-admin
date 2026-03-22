/**
 * Plugin Install Ability
 *
 * Installs a plugin from the WordPress.org plugin directory.
 * Supports natural language commands like "install woocommerce" or
 * "download contact form 7 and activate it".
 */

// Import the ability registration helper.
import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';
import { formatPluginActionResult } from './shared/plugin-helpers';

/**
 * Extract plugin parameters from user message.
 *
 * Unlike activate/deactivate, we don't check local plugin lists since
 * the plugin isn't installed yet. We extract the slug from natural language.
 *
 * @param {string} userMessage - The user's original message like "install woocommerce"
 * @return {Object|null} Object with { plugin: "slug", activate: boolean } or null if not found
 */
function extractParams( userMessage ) {
	const messageLower = userMessage.toLowerCase();

	// Check if user wants to activate after install.
	const activate =
		/\b(?:and\s+)?activat(?:e|ing)\b/.test( messageLower ) ||
		/\b(?:and\s+)?enabl(?:e|ing)\b/.test( messageLower ) ||
		/\b(?:and\s+)?turn\s+(?:it\s+)?on\b/.test( messageLower );

	// Extract plugin name using action keywords.
	const pattern =
		/(?:install|download|add|get)\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9][a-z0-9\-_ ]+[a-z0-9])["']?/i;

	const match = userMessage.match( pattern );
	if ( match && match[ 1 ] ) {
		// Strip trailing "plugin" and normalize to slug format.
		let name = match[ 1 ].trim().replace( /\s+plugin$/i, '' );
		// Also strip "and activate/enable" suffixes.
		name = name.replace(
			/\s+(?:and\s+)?(?:activate|enable|turn\s+on).*$/i,
			''
		);
		name = name.trim();
		if ( name ) {
			const slug = name.toLowerCase().replace( /\s+/g, '-' );
			const params = { plugin: slug };
			if ( activate ) {
				params.activate = true;
			}
			return params;
		}
	}

	// Try quoted plugin names: install "contact form 7"
	const quotedMatch = userMessage.match( /["']([^"']+)["']/ );
	if ( quotedMatch ) {
		const slug = quotedMatch[ 1 ]
			.trim()
			.toLowerCase()
			.replace( /\s+/g, '-' );
		const params = { plugin: slug };
		if ( activate ) {
			params.activate = true;
		}
		return params;
	}

	return null;
}

/**
 * Register the plugin-install ability.
 *
 * This ability allows users to install WordPress plugins from WordPress.org
 * through natural language commands like "install woocommerce" or
 * "download contact form 7 and activate it".
 */
export function registerPluginInstall() {
	registerAbility( 'wp-agentic-admin/plugin-install', {
		label: 'Install plugins',
		description:
			'Install a WordPress plugin from the WordPress.org directory by name or slug. Can optionally activate after installing.',

		// Keywords for install-related commands.
		keywords: [
			'install',
			'download',
			'add plugin',
			'get plugin',
			'install plugin',
		],

		initialMessage: 'Installing the plugin...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( result.already_installed ) {
				return result.message || 'Plugin is already installed.';
			}
			return formatPluginActionResult(
				result,
				'Plugin has been installed successfully.'
			);
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( result.error ) {
				return `Plugin installation failed: ${ result.error }.`;
			}
			if ( result.already_installed ) {
				let msg = `Plugin "${ result.plugin_name }" is already installed.`;
				if ( ! result.active ) {
					msg += ' It is currently inactive — suggest activating it.';
				}
				return msg;
			}
			let msg =
				result.message || 'The plugin was installed successfully.';
			if ( result.activated ) {
				msg += ' The plugin is now active.';
			}
			return msg;
		},

		// Export extractParams so it can be tested or reused.
		extractParams,

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params             - Parameters from the chat system.
		 * @param {string} params.userMessage - The user's original message.
		 * @return {Promise<Object>} The result from PHP, or an error object.
		 */
		execute: async ( { userMessage } ) => {
			// Extract plugin slug from the user's message.
			const params = extractParams( userMessage );

			// If we couldn't figure out which plugin, return a helpful error.
			if ( ! params || ! params.plugin ) {
				return {
					error: 'Could not determine which plugin to install. Please specify the plugin name, e.g., "install woocommerce"',
				};
			}

			// Execute the PHP ability with the extracted parameters.
			return executeAbility( 'wp-agentic-admin/plugin-install', params );
		},

		requiresConfirmation: false,
	} );
}

export default registerPluginInstall;
