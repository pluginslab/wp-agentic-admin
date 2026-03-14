/**
 * Get Block Schema Ability
 *
 * Retrieves detailed schema information about a specific WordPress block using the WASM database.
 * Requires @pluginslab/wp-devdocs-wasm to be installed.
 *
 * ABILITY OVERVIEW:
 * =================
 * This ability looks up a specific WordPress block by name and returns its attributes,
 * supports, and variations.
 * The database is provided by the optional @pluginslab/wp-devdocs-wasm package.
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.10.0
 */

import { registerAbility } from '../services/agentic-abilities-api';

/**
 * Register the get-block-schema ability with the chat system.
 */
export function registerGetBlockSchema() {
	registerAbility( 'wp-agentic-admin/get-block-schema', {
		label: 'Get block schema',
		description:
			'Get detailed schema for a single, specific WordPress block by its exact name. Returns attributes, supports, and variations. Only use when the user names one specific block.',

		keywords: [
			'block schema',
			'block attributes',
			'block supports',
			'block variations',
			'block details',
			'block info',
		],

		initialMessage: 'Looking up block schema...',

		/**
		 * Parse user intent to extract the block name.
		 *
		 * @param {string} message - The user's message.
		 * @return {Object} Extracted parameters.
		 */
		parseIntent: ( message ) => {
			// Look for block names like core/paragraph, core/image, etc.
			const blockNameMatch = message.match(
				/\b([a-z][\w-]*\/[a-z][\w-]*)\b/i
			);
			if ( blockNameMatch ) {
				return { block: blockNameMatch[ 1 ].toLowerCase() };
			}

			// Look for common block names without namespace
			const commonBlocks = [
				'paragraph',
				'heading',
				'image',
				'gallery',
				'list',
				'quote',
				'code',
				'table',
				'buttons',
				'columns',
				'group',
				'cover',
				'media-text',
				'separator',
				'spacer',
				'embed',
				'video',
				'audio',
				'file',
				'pullquote',
				'verse',
				'preformatted',
				'navigation',
				'site-title',
				'site-logo',
				'query',
				'post-title',
				'post-content',
				'post-excerpt',
			];

			const lowerMessage = message.toLowerCase();
			for ( const block of commonBlocks ) {
				if ( lowerMessage.includes( block ) ) {
					return { block: `core/${ block }` };
				}
			}

			// Fallback: clean the message to use as block name
			const cleaned = message
				.toLowerCase()
				.replace(
					/^(tell me about|what is|show me|get|describe|explain)\s+(the\s+)?/i,
					''
				)
				.replace( /\s+(block|schema|attributes?|supports?)$/i, '' )
				.replace( /\?$/, '' )
				.trim();

			return { block: cleaned };
		},

		/**
		 * Generate human-readable summary from the result.
		 *
		 * @param {Object} result - The block schema result.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( result ) => {
			if ( ! result || ! result.success ) {
				return result?.message || 'Unable to retrieve block schema.';
			}

			const { block } = result;
			if ( ! block ) {
				return 'Block not found.';
			}

			const lines = [];
			lines.push( `**${ block.name }**` );
			if ( block.title ) {
				lines.push( `**Title:** ${ block.title }` );
			}
			if ( block.attributes ) {
				const attrCount = Object.keys( block.attributes ).length;
				lines.push( `**Attributes:** ${ attrCount }` );
			}
			if ( block.supports ) {
				const supportList = Object.keys( block.supports )
					.filter( ( k ) => block.supports[ k ] )
					.join( ', ' );
				if ( supportList ) {
					lines.push( `**Supports:** ${ supportList }` );
				}
			}
			if ( block.variations && block.variations.length > 0 ) {
				lines.push( `**Variations:** ${ block.variations.length }` );
			}
			return lines.join( '\n' );
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The block schema result.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result || ! result.success ) {
				return result?.message || 'Unable to retrieve block schema.';
			}

			const { block } = result;
			if ( ! block ) {
				return 'Block not found.';
			}

			const parts = [];
			if ( block.attributes ) {
				parts.push(
					`has ${ Object.keys( block.attributes ).length } attributes`
				);
			}
			if ( block.supports ) {
				const supportList = Object.keys( block.supports )
					.filter( ( k ) => block.supports[ k ] )
					.join( ', ' );
				if ( supportList ) {
					parts.push( `supports: ${ supportList }` );
				}
			}
			if ( block.variations && block.variations.length > 0 ) {
				parts.push(
					`${ block.variations.length } variation${
						block.variations.length === 1 ? '' : 's'
					}`
				);
			}

			if ( parts.length === 0 ) {
				return `Block "${ block.name }" found but has no detailed schema.`;
			}

			return `Block "${ block.name }" ${ parts.join( ', ' ) }.`;
		},

		/**
		 * Execute the ability via dynamic import of the WASM package.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The block schema or an error.
		 */
		execute: async ( params ) => {
			try {
				/* eslint-disable import/no-unresolved */
				const { getBlockSchema } = await import(
					'@pluginslab/wp-devdocs-wasm'
				);
				/* eslint-enable import/no-unresolved */
				const result = await getBlockSchema( params.block );
				return { success: true, ...result };
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

export default registerGetBlockSchema;
