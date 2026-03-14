/**
 * Search WordPress Blocks Ability
 *
 * Searches WordPress Gutenberg blocks using the WASM block markup database.
 * Requires @pluginslab/wp-devdocs-wasm to be installed.
 *
 * ABILITY OVERVIEW:
 * =================
 * This ability uses a client-side SQLite WASM database to search registered
 * WordPress blocks by name or keyword.
 * The database is provided by the optional @pluginslab/wp-devdocs-wasm package.
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.10.0
 */

import { registerAbility } from '../services/agentic-abilities-api';

/**
 * Register the search-wp-blocks ability with the chat system.
 */
export function registerSearchWpBlocks() {
	registerAbility( 'wp-agentic-admin/search-wp-blocks', {
		label: 'Search WordPress blocks',
		description:
			'Search for multiple WordPress blocks matching a keyword. Returns a list of matching Gutenberg blocks. Use when the user wants to find, list, or discover blocks — not when asking about one specific block by name.',

		keywords: [
			'block',
			'blocks',
			'gutenberg',
			'block editor',
			'block type',
			'search blocks',
			'find block',
		],

		initialMessage: 'Searching WordPress blocks...',

		/**
		 * Parse user intent to extract the search query.
		 *
		 * @param {string} message - The user's message.
		 * @return {Object} Extracted parameters.
		 */
		parseIntent: ( message ) => {
			const lowerMessage = message.toLowerCase();

			let query = lowerMessage
				.replace(
					/^(search|find|look up|show me|what|which|list|get)\s+(wordpress\s+)?(gutenberg\s+)?(blocks?)\s+(for|about|related to|that|like)\s+/i,
					''
				)
				.replace( /\?$/, '' )
				.trim();

			if ( ! query || query.length < 2 ) {
				query = lowerMessage
					.replace(
						/(search|find|look up|show me|list|get)\s+(wordpress\s+)?(gutenberg\s+)?(blocks?)\s*/i,
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
				return result?.message || 'Unable to search WordPress blocks.';
			}

			const { blocks, query } = result;
			if ( ! blocks || blocks.length === 0 ) {
				return `No blocks found matching "${ query }".`;
			}

			let summary = `Found ${ blocks.length } block${
				blocks.length === 1 ? '' : 's'
			} matching "${ query }":\n\n`;
			for ( const block of blocks ) {
				const renderType = block.isDynamic ? 'dynamic' : 'static';
				summary += `- **${ block.name }** (${ renderType })\n`;
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
				return result?.message || 'Unable to search WordPress blocks.';
			}

			const { blocks, query } = result;
			if ( ! blocks || blocks.length === 0 ) {
				return `No blocks found matching "${ query }".`;
			}

			const blockList = blocks
				.map(
					( b ) =>
						`${ b.name } (${ b.isDynamic ? 'dynamic' : 'static' })`
				)
				.join( ', ' );
			return `Found ${ blocks.length } blocks matching "${ query }": ${ blockList }.`;
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
				const { searchBlocks } = await import(
					'@pluginslab/wp-devdocs-wasm'
				);
				/* eslint-enable import/no-unresolved */
				const results = await searchBlocks( params.query );
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

export default registerSearchWpBlocks;
