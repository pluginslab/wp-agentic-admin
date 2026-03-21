/**
 * Plugin List Ability
 *
 * Lists all installed WordPress plugins with their status.
 *
 * ABILITY OVERVIEW:
 * =================
 * This is a read-only ability that retrieves plugin information from WordPress.
 * It demonstrates a simple ability that:
 * - Takes no required input parameters
 * - Returns structured data (plugins array with metadata)
 * - Has a summarize function that formats the data nicely
 *
 * PHP BACKEND RETURNS:
 * {
 *   plugins: [
 *     { name: "Akismet", slug: "akismet/akismet.php", version: "5.0", active: true },
 *     { name: "Hello Dolly", slug: "hello.php", version: "1.7.2", active: false },
 *     ...
 *   ],
 *   total: 5,
 *   active: 3
 * }
 *
 * @see includes/abilities/plugin-list.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the plugin-list ability with the chat system.
 *
 * This function is called during initialization to wire up the ability
 * to the chat's keyword detection and tool execution system.
 */
export function registerPluginList() {
	registerAbility( 'wp-agentic-admin/plugin-list', {
		// Label appears in the AI's system prompt to describe capabilities.
		// Make it descriptive so the LLM knows when to suggest using this ability.
		label: 'List installed plugins',
		description:
			'List all installed WordPress plugins with their active/inactive status, version, and author. Use for questions about installed plugins, plugin counts, or which plugins are active. Do NOT use for checking updates — use update-check instead.',

		// Keywords help the LLM understand when to use this ability.
		// Include common variations of how users might phrase requests.
		// These are used in the system prompt to describe available tools.
		keywords: [
			'plugin',
			'plugins',
			'installed',
			'extensions',
			'addons',
			'add-ons',
		],

		// Shown while the ability executes. Keep it short and friendly.
		initialMessage: "I'll check your installed plugins...",

		/**
		 * Generate human-readable summary from the result.
		 *
		 * WHEN THIS IS USED:
		 * For single abilities, this is a FALLBACK - only used when:
		 * - The LLM is not loaded
		 * - The LLM fails to generate a response
		 *
		 * When the LLM IS loaded, it receives the raw result data and generates
		 * a contextual response. This provides better UX since the LLM can
		 * tailor the response to exactly what the user asked.
		 *
		 * NOTE: For workflows, the summarize function is PRIMARY (not fallback).
		 * See workflows/index.js for examples of data-rich workflow summaries.
		 *
		 * @param {Object}   result         - The data returned by the PHP ability.
		 * @param {Object[]} result.plugins - Array of plugin objects.
		 * @param {number}   result.total   - Total plugin count.
		 * @param {number}   result.active  - Active plugin count.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( result ) => {
			// Destructure the result data.
			const { plugins, total, active } = result;

			// Separate active and inactive for the summary.
			const activePlugins = plugins
				.filter( ( p ) => p.active )
				.map( ( p ) => p.name );
			const inactivePlugins = plugins
				.filter( ( p ) => ! p.active )
				.map( ( p ) => p.name );

			// Build a markdown-formatted response.
			let summary = `I found ${ total } plugins installed. ${ active } are active and ${
				total - active
			} are inactive.\n\n`;

			if ( activePlugins.length > 0 ) {
				summary += ` * * Active plugins: * * ${ activePlugins.join(
					', '
				) }\n\n`;
			}
			if ( inactivePlugins.length > 0 ) {
				summary += ` * * Inactive plugins: * * ${ inactivePlugins.join(
					', '
				) }`;
			}
			return summary;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			const { plugins, total, active } = result;
			if ( ! plugins || plugins.length === 0 ) {
				return 'No plugins are installed on this site.';
			}
			const activeNames = plugins
				.filter( ( p ) => p.active )
				.map( ( p ) => p.name );
			const inactiveNames = plugins
				.filter( ( p ) => ! p.active )
				.map( ( p ) => p.name );
			let text = `Found ${ total } plugins installed. ${ active } active, ${
				total - active
			} inactive.`;
			if ( activeNames.length > 0 ) {
				text += ` Active: ${ activeNames.join( ', ' ) }.`;
			}
			if ( inactiveNames.length > 0 ) {
				text += ` Inactive: ${ inactiveNames.join( ', ' ) }.`;
			}
			return text;
		},

		/**
		 * Execute the ability.
		 *
		 * This function is called when the chat system determines this ability
		 * should handle a user message. It calls the PHP backend via REST API.
		 *
		 * @return {Promise<Object>} The result from the PHP ability.
		 */
		execute: async () => {
			// This ability doesn't require any input parameters.
			// For abilities with parameters, extract them from params.userMessage
			// or pass them directly to executeAbility().
			return executeAbility( 'wp-agentic-admin/plugin-list', {} );
		},

		// Read-only abilities don't need confirmation.
		// Set to true for abilities that modify or delete data.
		requiresConfirmation: false,
	} );
}

export default registerPluginList;
