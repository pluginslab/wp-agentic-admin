/**
 * Run Plugin Ability
 *
 * Generic proxy to execute any ability discovered via discover-plugin-abilities.
 * The LLM first discovers what's available, then calls this to execute it.
 *
 * This is the second half of the dynamic discovery pattern:
 * 1. LLM calls discover-plugin-abilities to see what's available
 * 2. LLM calls run-plugin-ability with the chosen ability ID and args
 *
 * @see includes/abilities/run-plugin-ability.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';

/**
 * Register the run-plugin-ability ability with the chat system.
 */
export function registerRunPluginAbility() {
	registerAbility( 'wp-agentic-admin/run-plugin-ability', {
		label: 'Run a plugin ability',
		description:
			'Run an ability from another plugin by its ID. Use discover-plugin-abilities first to find available abilities and their parameters. Pass ability_id and args.',

		keywords: [
			'execute plugin',
			'run ability',
			'call ability',
			'use ability',
		],

		initialMessage: 'Executing plugin ability...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result.success ) {
				return `Failed to execute ability: ${ result.message }`;
			}
			let summary = `**${ result.ability_id }** executed successfully.`;
			if ( result.result ) {
				// Try to show a compact version of the result.
				if ( result.result.message ) {
					summary += `\n${ result.result.message }`;
				}
			}
			return summary;
		},

		/**
		 * Plain-English interpretation for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result.success ) {
				return `Execution failed: ${ result.message }`;
			}
			let text = `Successfully executed "${ result.ability_id }". `;
			if ( result.result ) {
				// Provide the nested result to the LLM.
				const resultStr = JSON.stringify( result.result );
				if ( resultStr.length <= 1500 ) {
					text += `Result: ${ resultStr }`;
				} else {
					text += `Result (truncated): ${ resultStr.substring(
						0,
						1500
					) }...`;
				}
			}
			return text;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters including ability_id and args.
		 * @return {Promise<Object>} The result from PHP.
		 */
		execute: async ( params ) => {
			const abilityId = params.ability_id;

			// Only allow running abilities that are enabled via the toggle.
			if (
				abilityId &&
				! pluginAbilitiesManager.isEnabled( abilityId )
			) {
				return {
					success: false,
					message: `Plugin ability "${ abilityId }" is not enabled. Enable it in the Plugin Abilities tab first.`,
				};
			}

			const input = { ability_id: abilityId };
			if ( params.args ) {
				input.args = params.args;
			}
			return executeAbility(
				'wp-agentic-admin/run-plugin-ability',
				input
			);
		},

		requiresConfirmation: true,
	} );
}

export default registerRunPluginAbility;
