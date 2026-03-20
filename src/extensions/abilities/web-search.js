/**
 * Web Search Ability
 *
 * Searches the web for documentation and troubleshooting.
 *
 * @see includes/abilities/web-search.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the web-search ability with the chat system.
 */
export function registerWebSearch() {
	registerAbility( 'wp-agentic-admin/web-search', {
		label: 'Search the web for documentation',
		description:
			'Search the web via DuckDuckGo for WordPress docs, error solutions, and troubleshooting. Use when users ask how to fix an error, need documentation, or want external help. Args: query (search string).',

		keywords: [
			'search',
			'google',
			'look up',
			'find',
			'documentation',
			'docs',
			'how to',
		],

		initialMessage: "I'll search the web for that...",

		summarize: ( result ) => {
			if ( ! result.success ) {
				return `Search failed: ${ result.message }`;
			}

			if ( result.total === 0 ) {
				return 'No results found for your search.';
			}

			let summary = `Found **${ result.total }** result${
				result.total !== 1 ? 's' : ''
			}:\n\n`;

			result.results.forEach( ( r, i ) => {
				summary += `${ i + 1 }. **[${ r.title }](${ r.url })**\n`;
				summary += `   ${ r.snippet.substring( 0, 150 ) }\n\n`;
			} );

			return summary;
		},

		interpretResult: ( result ) => {
			if ( ! result.success ) {
				return `Search failed: ${ result.message }`;
			}
			if ( result.total === 0 ) {
				return 'No search results found.';
			}
			const items = result.results
				.map( ( r, i ) => `${ i + 1 }. ${ r.title } (${ r.url })` )
				.join( '; ' );
			return `Found ${ result.total } web results: ${ items }`;
		},

		execute: async ( params ) => {
			if ( ! params.query ) {
				return { success: false, message: 'No search query provided.' };
			}
			return executeAbility( 'wp-agentic-admin/web-search', {
				query: params.query,
				num_results: params.num_results || 3,
			} );
		},

		requiresConfirmation: false,
	} );
}

export default registerWebSearch;
