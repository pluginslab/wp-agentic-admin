/**
 * Tool Registry
 *
 * Central registry for all available tools. Tools are registered with their
 * configuration including keywords for detection, messages, and handlers.
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'ToolRegistry' );

/**
 * @typedef {Object} ToolAnnotations
 * @property {boolean} [readOnly]    - Whether the tool only reads data (default: true)
 * @property {boolean} [destructive] - Whether the tool may cause data loss (default: false)
 * @property {boolean} [idempotent]  - Whether the tool is safe to repeat (default: true)
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string}          id                           - Unique tool identifier (e.g., 'wp-agentic-admin/plugin-list')
 * @property {string[]}        keywords                     - Keywords that trigger this tool
 * @property {string}          initialMessage               - Message shown when tool starts executing
 * @property {Function}        summarize                    - Function that generates summary from result (for users)
 * @property {Function}        [interpretResult]            - Function that generates plain-English interpretation (for LLM).
 *                                                          Receives (result, userMessage) and returns a string that helps the
 *                                                          LLM understand the tool output, especially empty or negative results.
 * @property {Function}        execute                      - Async function that executes the tool
 * @property {boolean}         [requiresConfirmation=false] - Whether to confirm before executing
 * @property {string}          [confirmationMessage]        - Custom confirmation message
 * @property {ToolAnnotations} [annotations]                - Operation type annotations
 */

/**
 * ToolRegistry class
 * Manages registration and retrieval of tools
 */
class ToolRegistry {
	constructor() {
		/** @type {Map<string, ToolDefinition>} */
		this.tools = new Map();
	}

	/**
	 * Register a new tool
	 *
	 * @param {ToolDefinition} tool - Tool definition object
	 * @throws {Error} If tool with same ID already exists
	 */
	register( tool ) {
		if ( ! tool.id ) {
			throw new Error( 'Tool must have an id' );
		}
		if ( ! tool.keywords || ! Array.isArray( tool.keywords ) ) {
			throw new Error( `Tool ${ tool.id } must have keywords array` );
		}
		if ( ! tool.execute || typeof tool.execute !== 'function' ) {
			throw new Error(
				`Tool ${ tool.id } must have an execute function`
			);
		}

		if ( this.tools.has( tool.id ) ) {
			log.warn( `Overwriting existing tool: ${ tool.id }` );
		}

		// Set defaults
		const toolWithDefaults = {
			requiresConfirmation: false,
			initialMessage: 'Working on it...',
			summarize: () => 'Task completed. See details below.',
			...tool,
			// Normalize keywords to lowercase
			keywords: tool.keywords.map( ( k ) => k.toLowerCase() ),
			// Merge annotations with defaults
			annotations: {
				readonly: true,
				destructive: false,
				idempotent: true,
				...( tool.annotations || {} ),
			},
		};

		this.tools.set( tool.id, toolWithDefaults );
		log.info( `Registered tool: ${ tool.id }` );
	}

	/**
	 * Register multiple tools at once
	 *
	 * @param {ToolDefinition[]} tools - Array of tool definitions
	 */
	registerAll( tools ) {
		tools.forEach( ( tool ) => this.register( tool ) );
	}

	/**
	 * Get a tool by ID
	 *
	 * @param {string} id - Tool ID
	 * @return {ToolDefinition|undefined} The tool definition or undefined if not found
	 */
	get( id ) {
		return this.tools.get( id );
	}

	/**
	 * Get all registered tools
	 *
	 * @return {ToolDefinition[]} Array of all registered tool definitions
	 */
	getAll() {
		return Array.from( this.tools.values() );
	}

	/**
	 * Check if a tool exists
	 *
	 * @param {string} id - Tool ID
	 * @return {boolean} True if the tool exists
	 */
	has( id ) {
		return this.tools.has( id );
	}

	/**
	 * Unregister a tool
	 *
	 * @param {string} id - Tool ID
	 * @return {boolean} True if tool was removed
	 */
	unregister( id ) {
		return this.tools.delete( id );
	}

	/**
	 * Clear all registered tools
	 */
	clear() {
		this.tools.clear();
	}

	/**
	 * Get tools that require confirmation
	 *
	 * @return {ToolDefinition[]} Array of tools that require user confirmation.
	 */
	getDestructiveTools() {
		return this.getAll().filter( ( tool ) => tool.requiresConfirmation );
	}

	/**
	 * Get tools matching a list of IDs.
	 *
	 * @param {string[]} ids - Array of tool IDs to retrieve
	 * @return {ToolDefinition[]} Matching tools (in the order of ids)
	 */
	getByIds( ids ) {
		return ids
			.map( ( id ) => this.tools.get( id ) )
			.filter( Boolean );
	}

	/**
	 * Get tools that are not grouped under any instruction.
	 *
	 * These tools are always visible in the system prompt regardless of
	 * which instructions are active.
	 *
	 * @param {Object} instructionRegistry - InstructionRegistry instance
	 * @return {ToolDefinition[]} Tools not belonging to any instruction
	 */
	getUngrouped( instructionRegistry ) {
		const groupedIds = new Set();
		for ( const instruction of instructionRegistry.getAll() ) {
			for ( const id of instruction.abilityIds ) {
				groupedIds.add( id );
			}
		}
		return this.getAll().filter( ( tool ) => ! groupedIds.has( tool.id ) );
	}
}

// Create singleton instance
const toolRegistry = new ToolRegistry();

export { ToolRegistry, toolRegistry };
export default toolRegistry;
