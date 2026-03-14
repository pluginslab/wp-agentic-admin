/**
 * Search WordPress Hooks Ability
 *
 * Searches WordPress hooks (actions and filters) using the WASM dev docs database.
 * Requires @pluginslab/wp-devdocs-wasm to be installed.
 *
 * ABILITY OVERVIEW:
 * =================
 * This ability uses a client-side SQLite WASM database to search WordPress hooks.
 * The database is provided by the optional @pluginslab/wp-devdocs-wasm package.
 * If the package is not installed, the ability gracefully returns an error message.
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.10.0
 */

import { registerAbility } from '../services/agentic-abilities-api';

/**
 * Register the search-wp-hooks ability with the chat system.
 */
export function registerSearchWpHooks() {
	registerAbility( 'wp-agentic-admin/search-wp-hooks', {
		label: 'Search WordPress hooks',
		description:
			'Search for multiple WordPress hooks matching a keyword. Returns a list of matching actions and filters. Use when the user wants to find, list, or discover hooks — not when asking about one specific hook by name.',

		keywords: [
			'hook',
			'hooks',
			'action',
			'filter',
			'do_action',
			'apply_filters',
			'add_action',
			'add_filter',
			'wordpress hook',
		],

		initialMessage: 'Searching WordPress hooks...',

		/**
		 * Parse user intent to extract the search query.
		 *
		 * @param {string} message - The user's message.
		 * @return {Object} Extracted parameters.
		 */
		parseIntent: ( message ) => {
			const lowerMessage = message.toLowerCase();

			// Remove common preamble phrases to extract the search query
			let query = lowerMessage
				.replace(
					/^(search|find|look up|show me|what|which|list|get)\s+(wordpress\s+)?(hooks?|actions?|filters?)\s+(for|about|related to|that|during|when|on)\s+/i,
					''
				)
				.replace(
					/^(what|which)\s+(hooks?|actions?|filters?)\s+(fire|run|execute|trigger)\s+(during|when|on|for)\s+/i,
					''
				)
				.replace( /\?$/, '' )
				.trim();

			// If we couldn't extract a meaningful query, use the whole message
			if ( ! query || query.length < 2 ) {
				query = lowerMessage
					.replace(
						/(search|find|look up|show me|list|get)\s+(wordpress\s+)?(hooks?|actions?|filters?)\s*/i,
						''
					)
					.replace( /\?$/, '' )
					.trim();
			}

			return { query };
		},

		/**
		 * Generate human-readable summary from the result.
		 *
		 * @param {Object} result - The search result.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( result ) => {
			if ( ! result || ! result.success ) {
				return result?.message || 'Unable to search WordPress hooks.';
			}

			const { hooks, query } = result;
			if ( ! hooks || hooks.length === 0 ) {
				return `No hooks found matching "${ query }".`;
			}

			let summary = `Found ${ hooks.length } hook${
				hooks.length === 1 ? '' : 's'
			} matching "${ query }":\n\n`;
			for ( const hook of hooks ) {
				summary += `- **${ hook.name }** (${ hook.type })\n`;
			}
			return summary;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The search result.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result || ! result.success ) {
				return result?.message || 'Unable to search WordPress hooks.';
			}

			const { hooks, query } = result;
			if ( ! hooks || hooks.length === 0 ) {
				return `No hooks found matching "${ query }".`;
			}

			const hookList = hooks
				.map( ( h ) => `${ h.name } (${ h.type })` )
				.join( ', ' );
			return `Found ${ hooks.length } hooks matching "${ query }": ${ hookList }.`;
		},

		/**
		 * Execute the ability via dynamic import of the WASM package.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The search results or an error.
		 */
		execute: async ( params ) => {
			try {
				/* eslint-disable import/no-unresolved */
				const { searchHooks } = await import(
					'@pluginslab/wp-devdocs-wasm'
				);
				/* eslint-enable import/no-unresolved */
				const results = await searchHooks( params.query );
				return { success: true, query: params.query, ...results };
			} catch ( err ) {
				return {
					success: false,
					message:
						'WordPress dev docs WASM module is not available. Install @pluginslab/wp-devdocs-wasm to enable this feature.',
				};
			}
		},

		requiresConfirmation: false,
	} );
}

export default registerSearchWpHooks;
