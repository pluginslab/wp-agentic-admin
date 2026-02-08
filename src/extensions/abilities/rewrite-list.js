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
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The result from PHP.
		 */
		execute: async ( params ) => {
			return executeAbility( 'wp-agentic-admin/rewrite-list', {
				show_details: params.show_details || false,
			} );
		},

		// Reading rules is safe - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerRewriteList;
