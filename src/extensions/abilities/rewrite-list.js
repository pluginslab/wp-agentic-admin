/**
 * Rewrite List Ability
 *
 * Lists and counts WordPress rewrite rules.
 * Similar to WP-CLI: wp rewrite list
 *
 * @since 0.1.0
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the rewrite-list ability with the chat system.
 */
export function registerRewriteList() {
	registerAbility( 'wp-agentic-admin/rewrite-list', {
		label: 'List rewrite rules',
		description:
			'List all WordPress rewrite rules (URL routing patterns). Returns rule count, permalink structure, and each rule pattern.',

		keywords: [
			'list rewrite',
			'show rewrite',
			'view rewrite',
			'count rewrite',
			'how many rewrite',
			'rewrite rules count',
			'rewrite rules list',
		],

		initialMessage: 'Getting rewrite rules...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result.success ) {
				return result.message || 'Failed to get rewrite rules.';
			}

			let summary = result.message;

			if ( result.permalink_structure ) {
				summary += `\n\nCurrent permalink structure: \`${ result.permalink_structure }\``;
			}

			if ( result.rules_count === 0 ) {
				summary +=
					'\n\n⚠️ No rewrite rules found. This is unusual and might indicate a problem with your permalink setup.';
			} else if ( result.rules_count > 200 ) {
				summary += `\n\n⚠️ You have a high number of rewrite rules( ${ result.rules_count } ). This might impact performance. Consider reviewing your plugins and custom post types.`;
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
			if ( ! result.success ) {
				return `Failed to get rewrite rules: ${
					result.message || 'unknown error'
				}.`;
			}
			const count = result.rules_count || 0;
			let text = `Found ${ count } rewrite rules.`;
			if ( result.permalink_structure ) {
				text += ` Permalink structure: ${ result.permalink_structure }.`;
			}
			if ( count === 0 ) {
				text +=
					' WARNING: No rewrite rules found. This is unusual and may indicate a problem with the permalink setup.';
			} else if ( count > 200 ) {
				text +=
					' NOTE: This is a high number of rules, which might impact performance.';
			}
			return text;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The result from PHP.
		 */
		execute: async ( params ) => {
			return executeAbility( 'wp-agentic-admin/rewrite-list', {} );
		},

		// Reading rules is safe - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerRewriteList;
