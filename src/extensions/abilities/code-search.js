/**
 * Code Search Ability
 *
 * Searches the locally indexed codebase using semantic vector search.
 *
 * @see src/extensions/services/vector-store.js for the vector store service
 * @see src/extensions/abilities/codebase-index.js for the indexing ability
 */

import { registerAbility } from '../services/agentic-abilities-api';
import vectorStore from '../services/vector-store';
import { createLogger } from '../utils/logger';

const log = createLogger( 'CodeSearch' );

/**
 * Register the code-search ability with the chat system.
 */
export function registerCodeSearch() {
	registerAbility( 'wp-agentic-admin/code-search', {
		label: 'Search site codebase',
		description:
			'Search code for functions, classes, or patterns. Use when users ask to find, search, or locate code in the codebase.',

		keywords: [
			'search code',
			'find function',
			'where is',
			'codebase',
			'find class',
			'find code',
			'code search',
			'search codebase',
		],

		initialMessage: 'Searching your codebase...',

		parseIntent: ( message ) => {
			return { query: message };
		},

		summarize: ( result ) => {
			if ( result.error ) {
				return result.error;
			}

			if ( ! result.matches || result.matches.length === 0 ) {
				return 'No matching code found.';
			}

			let summary = `Found **${ result.matches.length }** relevant code sections:\n\n`;

			result.matches.forEach( ( match, i ) => {
				summary += `**${ i + 1 }. ${ match.path }** (lines ${
					match.start_line
				}-${ match.end_line })\n`;
				summary += '```\n';
				// Truncate for display.
				const preview =
					match.content.length > 500
						? match.content.slice( 0, 500 ) + '\n...'
						: match.content;
				summary += preview + '\n';
				summary += '```\n\n';
			} );

			return summary;
		},

		interpretResult: ( result ) => {
			if ( result.error ) {
				return result.error;
			}

			if ( ! result.matches || result.matches.length === 0 ) {
				return 'No matching code found in the index.';
			}

			// Strict budget: max 2 snippets, ~400 chars each, total under 800 chars.
			const snippets = result.matches.slice( 0, 2 );
			const parts = snippets.map( ( match ) => {
				const content = match.content.slice( 0, 400 );
				return `${ match.path }:${ match.start_line }: ${ content }`;
			} );

			return parts.join( '\n' );
		},

		execute: async ( params ) => {
			try {
				// Initialize vector store (loads Voy, restores from IndexedDB).
				await vectorStore.init();

				if ( ! vectorStore.isReady() ) {
					return {
						error: "Codebase not indexed yet. Run 'index the codebase' first.",
					};
				}

				// Extract query from params.
				const query = params.query || params.userMessage || 'code';

				log.info( `Query: "${ query }"` );
				log.info( `Index has ${ vectorStore.getChunkCount() } chunks` );

				const matches = await vectorStore.search( query, 3 );

				matches.forEach( ( match, i ) => {
					log.info(
						`Result ${ i + 1 }: ${ match.path }:${
							match.start_line
						}-${ match.end_line } (score: ${ match.score }) type: ${
							match.type
						}`
					);
					log.info(
						`  Preview: ${ match.content.slice( 0, 150 ) }...`
					);
				} );

				return {
					matches,
					total: matches.length,
					indexed_chunks: vectorStore.getChunkCount(),
				};
			} catch ( err ) {
				return {
					error: `Search failed: ${ err.message }`,
				};
			}
		},

		requiresConfirmation: false,
	} );
}

export default registerCodeSearch;
