/**
 * Instruction Definitions — loaded from markdown files
 *
 * Each .md file in this directory defines one instruction set.
 * See plugins.md for the format. To add a new instruction:
 *   1. Create a new .md file in this directory
 *   2. Import it below and add it to the instructionFiles array
 *
 * @since 0.9.6
 */

import instructionRegistry from '../services/instruction-registry';
import { parseInstruction } from './parse-instruction';
import { createLogger } from '../utils/logger';

// Import instruction markdown files as raw strings
// When adding a new instruction, add its import and entry here.
// eslint-disable-next-line import/no-unresolved
import pluginsMd from './plugins.md';
// eslint-disable-next-line import/no-unresolved
import cacheMd from './cache.md';
// eslint-disable-next-line import/no-unresolved
import databaseMd from './database.md';
// eslint-disable-next-line import/no-unresolved
import diagnosticsMd from './diagnostics.md';
// eslint-disable-next-line import/no-unresolved
import routingMd from './routing.md';
// eslint-disable-next-line import/no-unresolved
import cronMd from './cron.md';
// eslint-disable-next-line import/no-unresolved
import themesMd from './themes.md';
// eslint-disable-next-line import/no-unresolved
import usersMd from './users.md';

const log = createLogger( 'Instructions' );

/**
 * All instruction markdown sources.
 * Add new imports to this array when creating a new instruction.
 */
const instructionFiles = [
	pluginsMd,
	cacheMd,
	databaseMd,
	diagnosticsMd,
	routingMd,
	cronMd,
	themesMd,
	usersMd,
];

/**
 * Register all instruction sets from markdown files.
 *
 * Must be called AFTER registerAllAbilities() so that ability IDs exist.
 */
export function registerAllInstructions() {
	for ( const raw of instructionFiles ) {
		try {
			const instruction = parseInstruction( raw );
			instructionRegistry.register( instruction );
		} catch ( err ) {
			log.error( 'Failed to load instruction:', err );
		}
	}

	log.info(
		`Registered ${ instructionRegistry.getAll().length } instruction sets`
	);
}

export default registerAllInstructions;
