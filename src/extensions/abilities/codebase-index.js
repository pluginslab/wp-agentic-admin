/**
 * Codebase Index Ability
 *
 * Extracts code from the site and builds a local vector index for semantic search.
 *
 * @see includes/abilities/codebase-extract.php for the PHP extraction backend
 * @see src/extensions/services/vector-store.js for the vector store service
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';
import vectorStore from '../services/vector-store';

/**
 * Register the codebase-index ability with the chat system.
 */
export function registerCodebaseIndex() {
	registerAbility( 'wp-agentic-admin/codebase-index', {
		label: 'Index site codebase for search',
		description:
			'Build a search index from active theme and plugin code. Only use when the user explicitly says "index" or "reindex" the codebase. Do NOT use for searching or finding code.',

		keywords: [ 'index codebase', 'reindex', 'build index', 'scan code' ],

		initialMessage: 'Indexing your codebase... This may take 1-3 minutes.',

		requiresConfirmation: true,
		confirmationMessage:
			'This will extract code from your active theme and plugins, then build a search index. This may take 1-3 minutes. Continue?',

		summarize: ( result ) => {
			if ( result.error ) {
				return `Indexing failed: ${ result.error }`;
			}
			return `Indexed **${ result.chunks_indexed }** code chunks from **${ result.total_files }** files. You can now search your codebase.`;
		},

		interpretResult: ( result ) => {
			if ( result.error ) {
				return `Indexing failed: ${ result.error }`;
			}
			return `Indexed ${ result.chunks_indexed } chunks from ${ result.total_files } files. Codebase is now searchable.`;
		},

		execute: async () => {
			try {
				await vectorStore.init();
				await vectorStore.clear();

				let allChunks = [];
				let offset = 0;
				let totalFiles = 0;
				let hasMore = true;

				// Paginate through all files.
				while ( hasMore ) {
					const page = await executeAbility(
						'wp-agentic-admin/codebase-extract',
						{ offset, limit: 50 }
					);

					if ( ! page || ! page.chunks ) {
						break;
					}

					allChunks = allChunks.concat( page.chunks );
					totalFiles = page.total_files || totalFiles;
					hasMore = page.has_more || false;
					offset += 50;
				}

				if ( allChunks.length === 0 ) {
					return {
						chunks_indexed: 0,
						total_files: totalFiles,
						error: 'No code files found to index.',
					};
				}

				const indexed = await vectorStore.index( allChunks );

				return {
					chunks_indexed: indexed,
					total_files: totalFiles,
				};
			} catch ( err ) {
				return {
					chunks_indexed: 0,
					total_files: 0,
					error: err.message,
				};
			}
		},
	} );
}

export default registerCodebaseIndex;
