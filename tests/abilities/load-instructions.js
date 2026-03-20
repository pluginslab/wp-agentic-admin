/**
 * Load instruction definitions from markdown files.
 *
 * Reads the .md files in src/extensions/instructions/ and extracts
 * instruction metadata from YAML frontmatter. The body text becomes
 * the context field. This is the Node.js equivalent of the webpack
 * require.context loader in the browser build.
 *
 * @since 0.9.6
 */

const fs = require( 'fs' );
const path = require( 'path' );

const INSTRUCTIONS_DIR = path.resolve(
	__dirname,
	'../../src/extensions/instructions'
);

/**
 * Parse a single instruction markdown file.
 *
 * @param {string} raw - Raw file content
 * @return {Object} Instruction definition with id, label, description, keywords, abilityIds, context
 */
function parseInstruction( raw ) {
	const fmMatch = raw.match( /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/ );
	if ( ! fmMatch ) {
		return null;
	}

	const yaml = fmMatch[ 1 ];
	const body = fmMatch[ 2 ].trim();

	const instruction = {};

	let currentKey = null;
	let currentList = null;

	for ( const line of yaml.split( '\n' ) ) {
		const listItem = line.match( /^\s+-\s+(.+)$/ );
		if ( listItem ) {
			if ( currentList ) {
				currentList.push( listItem[ 1 ].trim() );
			}
			continue;
		}

		const keyValue = line.match( /^(\w+):\s*(.*)$/ );
		if ( keyValue ) {
			if ( currentKey && currentList ) {
				instruction[ currentKey ] = currentList;
			}

			currentKey = keyValue[ 1 ];
			const value = keyValue[ 2 ].trim();

			if ( value ) {
				instruction[ currentKey ] = value;
				currentList = null;
			} else {
				currentList = [];
			}
		}
	}

	if ( currentKey && currentList ) {
		instruction[ currentKey ] = currentList;
	}

	// Map 'abilities' to 'abilityIds' for consistency
	if ( instruction.abilities ) {
		instruction.abilityIds = instruction.abilities;
		delete instruction.abilities;
	}

	if ( body ) {
		instruction.context = body;
	}

	return instruction;
}

/**
 * Load all instructions from the source directory.
 *
 * @return {Object[]} Array of instruction definitions
 */
function loadInstructions() {
	const files = fs
		.readdirSync( INSTRUCTIONS_DIR )
		.filter( ( f ) => f.endsWith( '.md' ) && f !== 'SCENARIOS.md' )
		.map( ( f ) => path.join( INSTRUCTIONS_DIR, f ) );

	const instructions = [];

	for ( const file of files ) {
		const raw = fs.readFileSync( file, 'utf8' );
		const instruction = parseInstruction( raw );
		if ( instruction && instruction.id ) {
			instructions.push( instruction );
		}
	}

	return instructions;
}

module.exports = { loadInstructions, parseInstruction };
