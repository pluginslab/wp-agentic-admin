/**
 * Core Site URL Ability
 *
 * Wraps WordPress core ability: core/get-site-info (fields: ['url'])
 * Returns only the site URL for focused queries like "what is my site URL?"
 *
 * ABILITY OVERVIEW:
 * =================
 * This is a focused wrapper around core/get-site-info that returns only the
 * site URL. Solves the problem where URL queries either route to conversational
 * mode (returning generic explanations) or return all site info fields.
 *
 * No PHP registration needed - uses WordPress core's get-site-info ability.
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.9.0
 * @see core-site-info.js for the full site info ability
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the core/get-site-url ability with the chat system.
 */
export function registerCoreSiteUrl() {
	registerAbility( 'core/get-site-url', {
		label: 'Get site URL',
		description:
			'Get the WordPress site URL (address). Returns the public-facing site URL.',

		keywords: [
			'site url',
			'siteurl',
			'address',
			'web address',
			'my url',
			'home url',
			'site address',
		],

		initialMessage: 'Fetching site URL...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from WordPress core.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || ! result.url ) {
				return 'Unable to retrieve the site URL.';
			}

			return `**Site URL:** ${ result.url }`;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from WordPress core.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result || ! result.url ) {
				return 'Unable to retrieve the site URL.';
			}

			return `The site URL is ${ result.url }.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @return {Promise<Object>} The result from WordPress core.
		 */
		execute: async () => {
			return executeAbility( 'core/get-site-info', {
				fields: [ 'url' ],
			} );
		},

		// Read-only operation - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerCoreSiteUrl;
