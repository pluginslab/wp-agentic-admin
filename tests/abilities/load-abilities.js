/**
 * Load ability metadata from JS source files.
 *
 * Reads the ability source files in src/extensions/abilities/ and extracts
 * { id, label, description } from each registerAbility() call. This avoids
 * maintaining a separate manifest — the JS files remain the single source
 * of truth.
 *
 * @since 0.7.0
 */

const fs = require( 'fs' );
const path = require( 'path' );

const ABILITIES_DIR = path.resolve(
	__dirname,
	'../../src/extensions/abilities'
);

/**
 * Extract id, label, and description from a single ability JS file.
 *
 * Matches the pattern:
 *   registerAbility( 'some-id', {
 *       label: 'Some label',
 *       description: 'Some description...',
 *
 * @param {string} filePath Absolute path to the ability JS file.
 * @return {Object|null} { id, label, description } or null if not found.
 */
function extractAbility( filePath ) {
	const src = fs.readFileSync( filePath, 'utf8' );

	// Extract the ability ID from registerAbility( 'id', {
	const idMatch = src.match( /registerAbility\(\s*'([^']+)'/ );
	if ( ! idMatch ) {
		return null;
	}

	// Extract label — handles both single-line and multi-line values
	const labelMatch = src.match( /label:\s*'([^']+)'/ );

	// Extract description — may span multiple lines via string concatenation or template
	// Pattern: description: 'single line' or description:\n\t\t\t'multi line',
	const descMatch = src.match( /description:\s*\n?\s*(['"])(.+?)\1/ );

	if ( ! labelMatch || ! descMatch ) {
		return null;
	}

	return {
		id: idMatch[ 1 ],
		label: labelMatch[ 1 ],
		description: descMatch[ 2 ],
	};
}

/**
 * Load all abilities from the source directory.
 *
 * Reads every .js file in src/extensions/abilities/ (except index.js)
 * and extracts ability metadata.
 *
 * @return {Object[]} Array of { id, label, description }.
 */
function loadAbilities() {
	const files = fs
		.readdirSync( ABILITIES_DIR )
		.filter( ( f ) => f.endsWith( '.js' ) && f !== 'index.js' )
		.map( ( f ) => path.join( ABILITIES_DIR, f ) );

	const abilities = [];

	for ( const file of files ) {
		const ability = extractAbility( file );
		if ( ability ) {
			abilities.push( ability );
		}
	}

	return abilities;
}

module.exports = { loadAbilities, extractAbility };
