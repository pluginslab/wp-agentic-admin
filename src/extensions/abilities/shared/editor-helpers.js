/**
 * Shared Editor Helper Functions
 *
 * Common functionality used across editor content abilities to avoid code duplication.
 * Provides block editor detection, block format conversion, and editor manipulation.
 */

/**
 * Check if the block editor is available on the current page.
 *
 * @return {boolean} True if the block editor store is accessible.
 */
export function isBlockEditorAvailable() {
	return (
		typeof wp !== 'undefined' &&
		wp.data &&
		!! wp.data.select( 'core/block-editor' ) &&
		typeof wp.blocks !== 'undefined' &&
		typeof wp.blocks.createBlock === 'function'
	);
}

/**
 * Get a standard error result for when the block editor is not available.
 *
 * @return {Object} Error result with navigation instructions.
 */
export function getEditorNotAvailableResult() {
	return {
		success: false,
		message:
			'This ability only works inside the block editor. Please navigate to a page or post (e.g. Pages → Edit) and try again from there.',
	};
}

/**
 * Convert editor blocks to a compact JSON format suitable for LLM processing.
 * Strips internal properties (clientId, isValid, etc.) and keeps only
 * name, relevant attributes, and innerBlocks.
 *
 * @param {Array} blocks - Array of block objects from wp.data.select('core/block-editor').getBlocks().
 * @return {Array} Compact block representations.
 */
export function blocksToCompactFormat( blocks ) {
	return blocks.map( ( block ) => {
		const compact = {
			name: block.name,
		};

		// Only include attributes that have content
		if ( block.attributes ) {
			const attrs = {};
			const keepKeys = [
				'content',
				'level',
				'url',
				'alt',
				'caption',
				'citation',
				'value',
				'ordered',
				'anchor',
				'align',
			];
			for ( const key of keepKeys ) {
				if (
					block.attributes[ key ] !== undefined &&
					block.attributes[ key ] !== '' &&
					block.attributes[ key ] !== null
				) {
					attrs[ key ] = block.attributes[ key ];
				}
			}
			if ( Object.keys( attrs ).length > 0 ) {
				compact.attributes = attrs;
			}
		}

		// Recurse into inner blocks
		if ( block.innerBlocks?.length ) {
			compact.innerBlocks = blocksToCompactFormat( block.innerBlocks );
		}

		return compact;
	} );
}

/**
 * Convert compact block format (from LLM response) to real Gutenberg blocks.
 * Uses wp.blocks.createBlock() to create proper block instances.
 *
 * @param {Array} compactBlocks - Array of { name, attributes, innerBlocks } objects.
 * @return {Array} Array of Gutenberg block objects.
 */
export function compactFormatToBlocks( compactBlocks ) {
	if ( ! Array.isArray( compactBlocks ) ) {
		return [];
	}

	return compactBlocks
		.map( ( block ) => {
			if ( ! block.name ) {
				return null;
			}

			const innerBlocks = block.innerBlocks
				? compactFormatToBlocks( block.innerBlocks )
				: [];

			try {
				return wp.blocks.createBlock(
					block.name,
					block.attributes || {},
					innerBlocks
				);
			} catch ( e ) {
				// Block type not registered — skip it
				return null;
			}
		} )
		.filter( Boolean );
}

/**
 * Replace all blocks in the editor with the provided blocks.
 * This is undoable via Ctrl+Z.
 *
 * @param {Array} blocks - Array of Gutenberg block objects.
 */
export function replaceEditorBlocks( blocks ) {
	wp.data.dispatch( 'core/block-editor' ).resetBlocks( blocks );
}

/**
 * Get the current post title from the editor.
 *
 * @return {string} The post title, or empty string.
 */
export function getEditorPostTitle() {
	try {
		return (
			wp.data.select( 'core/editor' ).getEditedPostAttribute( 'title' ) ||
			''
		);
	} catch ( e ) {
		return '';
	}
}
