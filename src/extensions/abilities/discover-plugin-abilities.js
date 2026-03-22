/**
 * Discover Abilities
 *
 * Discovers abilities registered by other plugins via the WP Abilities API.
 * Returns a compact summary the LLM can use to decide which plugin abilities to call.
 *
 * This is the first half of the dynamic discovery pattern:
 * 1. LLM calls discover-plugin-abilities to see what's available
 * 2. LLM calls run-plugin-ability with the chosen ability ID and args
 *
 * Only 2 tool descriptions in the system prompt instead of N plugin abilities.
 *
 * @see includes/abilities/discover-plugin-abilities.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';

/**
 * Register the discover-plugin-abilities ability with the chat system.
 */
export function registerDiscoverPluginAbilities() {
	registerAbility( 'wp-agentic-admin/discover-plugin-abilities', {
		label: 'Discover plugin abilities',
		description:
			'Discover abilities registered by other plugins. Returns ability IDs, descriptions, and parameter schemas. Use this first to find what plugin tools are available, then use run-plugin-ability to call them.',

		keywords: [
			'discover',
			'find abilities',
			'plugin abilities',
			'other plugins',
			'available tools',
			'what can you do',
			'what tools',
		],

		initialMessage: 'Discovering abilities from other plugins...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result.abilities || result.abilities.length === 0 ) {
				return 'No plugin abilities found from other plugins.';
			}

			const enabled = result.abilities.filter( ( a ) =>
				pluginAbilitiesManager.isEnabled( a.id )
			);

			if ( enabled.length === 0 ) {
				return `Found ${ result.total } plugin abilities, but none are enabled. Enable them in the Plugin Abilities tab.`;
			}

			let summary = `${ enabled.length } plugin abilities enabled:\n\n`;
			enabled.forEach( ( ability ) => {
				summary += `- **${ ability.id }**: ${
					ability.description || ability.label
				}\n`;
			} );
			return summary;
		},

		/**
		 * Plain-English interpretation for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result.abilities || result.abilities.length === 0 ) {
				return 'No plugin abilities discovered. Only built-in tools are available.';
			}

			// Only show enabled abilities to the LLM — disabled ones waste context.
			const enabled = result.abilities.filter( ( a ) =>
				pluginAbilitiesManager.isEnabled( a.id )
			);

			if ( enabled.length === 0 ) {
				return 'Plugin abilities exist but none are enabled. The user must enable them in the Plugin Abilities tab first.';
			}

			let text =
				'IMPORTANT: Now call wp-agentic-admin/run-plugin-ability to execute one of these abilities. ';
			text += `Available (${ enabled.length }): `;
			text += enabled
				.map( ( a ) => {
					let desc = `ability_id="${ a.id }" (${
						a.description || a.label
					})`;
					if ( a.parameters ) {
						const paramNames = Object.keys( a.parameters );
						desc += ` params: ${ paramNames.join( ', ' ) }`;
					}
					return desc;
				} )
				.join( '; ' );
			return text;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The result from PHP.
		 */
		execute: async ( params ) => {
			const input = {};
			if ( params.category ) {
				input.category = params.category;
			}
			if ( params.search ) {
				input.search = params.search;
			}
			const result = await executeAbility(
				'wp-agentic-admin/discover-plugin-abilities',
				input
			);

			// Filter out disabled abilities before the result reaches the LLM.
			if ( result?.abilities ) {
				result.abilities = result.abilities.filter( ( a ) =>
					pluginAbilitiesManager.isEnabled( a.id )
				);
				result.total = result.abilities.length;
				result.message =
					result.abilities.length > 0
						? `Found ${ result.abilities.length } enabled plugin abilities.`
						: 'Plugin abilities exist but none are enabled. The user must enable them in the Plugin Abilities tab first.';
			}

			return result;
		},

		requiresConfirmation: false,
	} );
}

export default registerDiscoverPluginAbilities;
