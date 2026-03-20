/**
 * Instruction Registry
 *
 * Central registry for instruction sets — domain-specific groupings of abilities.
 * Instructions enable progressive disclosure: the LLM sees a compact index of
 * available domains instead of every tool definition, then loads full tool
 * definitions on demand via load_instruction / unload_instruction.
 *
 * @since 0.9.6
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'InstructionRegistry' );

/**
 * @typedef {Object} InstructionDefinition
 * @property {string}   id          - Unique instruction identifier (e.g., 'plugins')
 * @property {string}   label       - Human-readable label (e.g., 'Plugin Management')
 * @property {string}   description - Short description for the LLM index
 * @property {string[]} keywords    - Keywords for auto-detection from user messages
 * @property {string[]} abilityIds  - Tool IDs grouped under this instruction
 * @property {string}   [context]   - Guidance text injected into the system prompt when active
 */

/**
 * InstructionRegistry class
 * Manages registration and retrieval of instruction sets.
 */
class InstructionRegistry {
	constructor() {
		/** @type {Map<string, InstructionDefinition>} */
		this.instructions = new Map();
	}

	/**
	 * Register a new instruction set.
	 *
	 * @param {InstructionDefinition} instruction - Instruction definition object
	 * @throws {Error} If instruction is missing required fields
	 */
	register( instruction ) {
		if ( ! instruction.id ) {
			throw new Error( 'Instruction must have an id' );
		}
		if (
			! instruction.abilityIds ||
			! Array.isArray( instruction.abilityIds )
		) {
			throw new Error(
				`Instruction ${ instruction.id } must have abilityIds array`
			);
		}
		if (
			! instruction.keywords ||
			! Array.isArray( instruction.keywords )
		) {
			throw new Error(
				`Instruction ${ instruction.id } must have keywords array`
			);
		}

		if ( this.instructions.has( instruction.id ) ) {
			log.warn( `Overwriting existing instruction: ${ instruction.id }` );
		}

		const instructionWithDefaults = {
			label: instruction.id,
			description: '',
			...instruction,
			keywords: instruction.keywords.map( ( k ) => k.toLowerCase() ),
		};

		this.instructions.set( instruction.id, instructionWithDefaults );
		log.info( `Registered instruction: ${ instruction.id }` );
	}

	/**
	 * Get an instruction by ID.
	 *
	 * @param {string} id - Instruction ID
	 * @return {InstructionDefinition|undefined} The instruction or undefined
	 */
	get( id ) {
		return this.instructions.get( id );
	}

	/**
	 * Get all registered instructions.
	 *
	 * @return {InstructionDefinition[]} Array of all instruction definitions
	 */
	getAll() {
		return Array.from( this.instructions.values() );
	}

	/**
	 * Check if an instruction exists.
	 *
	 * @param {string} id - Instruction ID
	 * @return {boolean} True if the instruction exists
	 */
	has( id ) {
		return this.instructions.has( id );
	}

	/**
	 * Detect which instructions match a user message based on keywords.
	 *
	 * @param {string} message - Lowercased user message
	 * @return {string[]} Array of matching instruction IDs
	 */
	detectInstructions( message ) {
		const lower = message.toLowerCase();
		const matches = [];

		for ( const instruction of this.instructions.values() ) {
			for ( const keyword of instruction.keywords ) {
				if ( lower.includes( keyword ) ) {
					matches.push( instruction.id );
					break;
				}
			}
		}

		return matches;
	}

	/**
	 * Get the instruction that contains a given ability ID.
	 *
	 * @param {string} abilityId - Tool/ability ID
	 * @return {InstructionDefinition|undefined} The containing instruction or undefined
	 */
	getInstructionForAbility( abilityId ) {
		for ( const instruction of this.instructions.values() ) {
			if ( instruction.abilityIds.includes( abilityId ) ) {
				return instruction;
			}
		}
		return undefined;
	}

	/**
	 * Clear all registered instructions.
	 */
	clear() {
		this.instructions.clear();
	}
}

// Create singleton instance
const instructionRegistry = new InstructionRegistry();

export { InstructionRegistry, instructionRegistry };
export default instructionRegistry;
