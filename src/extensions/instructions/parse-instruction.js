/**
 * Parse an instruction markdown file into a registry-compatible object.
 *
 * Markdown format:
 *   ---
 *   id: plugins
 *   label: Plugin Management
 *   description: List, activate, and deactivate plugins
 *   keywords:
 *     - plugin
 *     - plugins
 *   abilities:
 *     - wp-agentic-admin/plugin-list
 *   ---
 *   Optional context guidance (body text).
 *
 * @param {string} raw - Raw markdown string
 * @return {Object} Parsed instruction definition
 */
export function parseInstruction( raw ) {
	const fmMatch = raw.match( /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/ );
	if ( ! fmMatch ) {
		throw new Error( 'Instruction file missing YAML frontmatter' );
	}

	const yaml = fmMatch[ 1 ];
	const body = fmMatch[ 2 ].trim();

	const instruction = {};

	// Parse simple key: value and key:\n  - item lists
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
			// Save previous list
			if ( currentKey && currentList ) {
				instruction[ currentKey ] = currentList;
			}

			currentKey = keyValue[ 1 ];
			const value = keyValue[ 2 ].trim();

			if ( value ) {
				instruction[ currentKey ] = value;
				currentList = null;
			} else {
				// Start collecting list items
				currentList = [];
			}
		}
	}

	// Save final list
	if ( currentKey && currentList ) {
		instruction[ currentKey ] = currentList;
	}

	// Map 'abilities' to 'abilityIds' for registry compatibility
	if ( instruction.abilities ) {
		instruction.abilityIds = instruction.abilities;
		delete instruction.abilities;
	}

	// Body text becomes context guidance
	if ( body ) {
		instruction.context = body;
	}

	if ( ! instruction.id ) {
		throw new Error( 'Instruction file missing "id" in frontmatter' );
	}

	return instruction;
}

export default parseInstruction;
