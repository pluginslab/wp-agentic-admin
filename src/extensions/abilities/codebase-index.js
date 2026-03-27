/**
 * Codebase Index Ability
 *
 * Thin wrapper that delegates to the Knowledge Base service in Settings.
 * When invoked from chat, runs the full indexing pipeline.
 * Users can also build the index from the Settings tab.
 *
 * @see src/extensions/services/knowledge-base.js for the indexing service
 * @see src/extensions/services/vector-store.js for the vector store
 */

import { registerAbility } from '../services/agentic-abilities-api';
import { buildIndex, getKBStatus } from '../services/knowledge-base';

/**
 * Register the codebase-index ability with the chat system.
 */
export function registerCodebaseIndex() {
	registerAbility( 'wp-agentic-admin/codebase-index', {
		label: 'Build knowledge base index',
		description:
			'Build a search index from site code, database schema, WordPress API, and reference docs. Only use when the user explicitly says "index", "reindex", or "build knowledge base". Do NOT use for searching.',

		keywords: [
			'index codebase',
			'reindex',
			'build index',
			'scan code',
			'build knowledge base',
		],

		initialMessage:
			'Building your knowledge base... This may take 1-3 minutes.',

		requiresConfirmation: true,
		confirmationMessage:
			'This will build a search index from your site code, database schema, WordPress API signatures, and reference docs. This may take 1-3 minutes. Continue?',

		summarize: ( result ) => {
			if ( result.error ) {
				return `Indexing failed: ${ result.error }`;
			}
			let summary = `Indexed **${ result.totalChunks }** chunks from **${ result.codeFiles }** code files.`;
			if ( result.schemaTables ) {
				summary += ` Includes **${ result.schemaTables }** database table schemas.`;
			}
			if ( result.apiChunks ) {
				summary += ` Includes **${ result.apiChunks }** WP API signature chunks.`;
			}
			if ( result.docsChunks ) {
				summary += ` Includes **${ result.docsChunks }** reference doc chunks.`;
			}
			summary += ' Your knowledge base is ready to search.';
			return summary;
		},

		interpretResult: ( result ) => {
			if ( result.error ) {
				return `Indexing failed: ${ result.error }`;
			}
			let summary = `Indexed ${ result.totalChunks } chunks from ${ result.codeFiles } files.`;
			if ( result.schemaTables ) {
				summary += ` ${ result.schemaTables } DB schemas.`;
			}
			if ( result.apiChunks ) {
				summary += ` ${ result.apiChunks } API signatures.`;
			}
			if ( result.docsChunks ) {
				summary += ` ${ result.docsChunks } doc sections.`;
			}
			summary += ' Knowledge base is now searchable.';
			return summary;
		},

		execute: async () => {
			try {
				// Check if already indexed recently (< 5 min ago).
				const existing = getKBStatus();
				if (
					existing &&
					Date.now() - existing.lastIndexed < 5 * 60 * 1000
				) {
					return {
						...existing,
						note: 'Knowledge base was already built recently. You can rebuild from Settings if needed.',
					};
				}

				const status = await buildIndex();
				return status;
			} catch ( err ) {
				return {
					error: err.message,
				};
			}
		},
	} );
}

export default registerCodebaseIndex;
