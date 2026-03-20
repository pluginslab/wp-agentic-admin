/**
 * Core Editor Blocks Ability
 *
 * Lists all blocks on the current page in the block editor.
 * JS-only ability (no PHP needed) — uses wp.data to query the editor store.
 *
 * ABILITY OVERVIEW:
 * =================
 * Provides a chat-friendly interface for querying the block editor contents.
 * Only works on block editor screens where the core/block-editor store exists.
 * Demonstrates:
 * - JS-only ability (like core/get-site-info)
 * - Accessing wp.data stores from the chat interface
 * - Recursive block tree summarization
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.9.6
 */

import { registerAbility } from '../services/agentic-abilities-api';

/**
 * Recursively summarize a block tree for LLM consumption.
 *
 * @param {Array} blocks - Array of block objects from the editor store.
 * @return {Array} Simplified block summaries.
 */
function summarizeBlocks( blocks ) {
	return blocks.map( ( block ) => {
		const summary = { name: block.name };

		// Include text content when available (truncated)
		if ( block.attributes?.content ) {
			// Strip HTML tags for cleaner output
			const text = block.attributes.content
				.replace( /<[^>]*>/g, '' )
				.substring( 0, 120 );
			if ( text ) {
				summary.content = text;
			}
		}

		// Include heading level
		if ( block.attributes?.level ) {
			summary.level = block.attributes.level;
		}

		// Include image alt text or URL
		if ( block.attributes?.alt ) {
			summary.alt = block.attributes.alt;
		}
		if ( block.attributes?.url ) {
			summary.url = block.attributes.url;
		}

		// Recurse into inner blocks
		if ( block.innerBlocks?.length ) {
			summary.innerBlocks = summarizeBlocks( block.innerBlocks );
		}

		return summary;
	} );
}

/**
 * Register the core/get-editor-blocks ability with the chat system.
 */
export function registerCoreEditorBlocks() {
	registerAbility( 'core/get-editor-blocks', {
		label: 'List editor blocks',
		description:
			'List all blocks on the current page in the block editor. Shows block types, content previews, and nesting structure.',

		keywords: [
			'blocks',
			'editor blocks',
			'page blocks',
			'content blocks',
			'what blocks',
			'gutenberg',
			'block list',
			'page content',
		],

		initialMessage: 'Reading editor blocks...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The ability result.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result?.success ) {
				return result?.message || 'Unable to read editor blocks.';
			}

			if ( result.count === 0 ) {
				return 'The editor is empty — no blocks found.';
			}

			const lines = [ `Found **${ result.count }** block(s):` ];

			const formatBlock = ( block, indent = '' ) => {
				let line = `${ indent }- **${ block.name }**`;
				if ( block.level ) {
					line += ` (H${ block.level })`;
				}
				if ( block.content ) {
					line += `: "${ block.content }"`;
				}
				if ( block.alt ) {
					line += ` [alt: ${ block.alt }]`;
				}
				lines.push( line );

				if ( block.innerBlocks ) {
					block.innerBlocks.forEach( ( inner ) =>
						formatBlock( inner, indent + '  ' )
					);
				}
			};

			result.blocks.forEach( ( block ) => formatBlock( block ) );
			return lines.join( '\n' );
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The ability result.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result?.success ) {
				return result?.message || 'Unable to read editor blocks.';
			}

			if ( result.count === 0 ) {
				return 'The editor is empty with no blocks.';
			}

			const blockNames = result.blocks.map( ( b ) => b.name );
			const uniqueNames = [ ...new Set( blockNames ) ];
			return `The editor has ${
				result.count
			} block(s) using these types: ${ uniqueNames.join( ', ' ) }.`;
		},

		/**
		 * Execute the ability by reading the block editor store.
		 *
		 * @return {Object} Result with block data.
		 */
		execute: async () => {
			// Check if wp.data and the block-editor store are available
			if (
				typeof wp === 'undefined' ||
				! wp.data ||
				! wp.data.select( 'core/block-editor' )
			) {
				return {
					success: false,
					message:
						'Block editor is not available. This ability only works inside the Gutenberg editor.',
				};
			}

			const blocks = wp.data.select( 'core/block-editor' ).getBlocks();
			const summarized = summarizeBlocks( blocks );

			return {
				success: true,
				blocks: summarized,
				count: blocks.length,
			};
		},

		requiresConfirmation: false,
	} );
}

export default registerCoreEditorBlocks;
