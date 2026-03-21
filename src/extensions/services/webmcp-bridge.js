/**
 * WebMCP Bridge
 *
 * Bridges the WP Agentic Admin tool registry to Chrome's WebMCP API
 * (navigator.modelContext), exposing all registered abilities as tools
 * for external AI agents like Chrome DevTools MCP, OpenClaw, and Claude Code.
 *
 * @see https://chromestatus.com/feature/5264704088866816
 */

import toolRegistry from './tool-registry';
import abilitiesApi from './abilities-api';
import { createLogger } from '../utils/logger';

const log = createLogger( 'WebMCPBridge' );

/**
 * WebMCPBridge class
 *
 * Singleton that registers all abilities as WebMCP tools when the API
 * is available. Uses the same abilitiesApi.executeAbilityById() path
 * as the internal chat, ensuring consistent behavior.
 */
class WebMCPBridge {
	constructor() {
		/** @type {Map<string, Object>} toolName → registration handle */
		this.registeredTools = new Map();

		/** @type {boolean} Whether initialize() has been called */
		this._initialized = false;
	}

	/**
	 * Check if the WebMCP API is available.
	 *
	 * @return {boolean} True if navigator.modelContext.registerTool exists.
	 */
	isSupported() {
		return (
			typeof navigator !== 'undefined' &&
			!! navigator.modelContext &&
			typeof navigator.modelContext.registerTool === 'function'
		);
	}

	/**
	 * Initialize the bridge: register all abilities as WebMCP tools.
	 *
	 * Only registers if:
	 * - WebMCP API is available
	 * - User is authenticated (nonce exists)
	 * - Not already initialized
	 */
	initialize() {
		if ( this._initialized ) {
			log.warn( 'WebMCP bridge already initialized' );
			return;
		}

		if ( ! this.isSupported() ) {
			log.info( 'WebMCP not supported, skipping initialization' );
			return;
		}

		const nonce = window.wpAgenticAdmin?.nonce;
		if ( ! nonce ) {
			log.warn( 'No auth nonce found, skipping WebMCP registration' );
			return;
		}

		const tools = toolRegistry.getAll();
		let registered = 0;

		for ( const tool of tools ) {
			try {
				this.registerTool( tool );
				registered++;
			} catch ( err ) {
				log.error(
					`Failed to register WebMCP tool ${ tool.id }:`,
					err.message
				);
			}
		}

		this._initialized = true;

		// Clean up on page hide
		window.addEventListener( 'pagehide', () => this.cleanup() );

		log.info(
			`WebMCP bridge initialized: ${ registered }/${ tools.length } tools registered`
		);
	}

	/**
	 * Register a single ability as a WebMCP tool.
	 *
	 * @param {Object} tool - Tool definition from the registry.
	 */
	registerTool( tool ) {
		const toolName = this.toToolName( tool.id );
		const description = tool.description || tool.phpLabel || tool.id;
		const inputSchema = this.buildInputSchema( tool.id, tool );

		const registration = navigator.modelContext.registerTool( {
			name: toolName,
			description,
			inputSchema,
			execute: this.createHandler( tool ),
		} );

		this.registeredTools.set( toolName, registration );
	}

	/**
	 * Create an async handler for a WebMCP tool.
	 *
	 * Destructive tools require a two-step confirmation: the first call
	 * returns an error instructing the agent to re-invoke with
	 * `confirmed: true`.
	 *
	 * @param {Object} tool - Tool definition from the registry.
	 * @return {Function} Async handler function.
	 */
	createHandler( tool ) {
		const isDestructive =
			tool.requiresConfirmation ||
			( tool.annotations && tool.annotations.destructive );

		return async ( params = {} ) => {
			try {
				// Two-step confirmation for destructive operations
				if ( isDestructive && ! params.confirmed ) {
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify( {
									error: 'confirmation_required',
									message: `This is a destructive operation (${ tool.id }). Re-invoke with { "confirmed": true } to proceed.`,
									tool: tool.id,
								} ),
							},
						],
					};
				}

				const result = await abilitiesApi.executeAbilityById(
					tool.id,
					params
				);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify( result ),
						},
					],
				};
			} catch ( err ) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify( {
								error: 'execution_failed',
								message: err.message || 'Unknown error',
								tool: tool.id,
							} ),
						},
					],
				};
			}
		};
	}

	/**
	 * Build a JSON Schema for the WebMCP tool input.
	 *
	 * Uses the PHP-provided input_schema if available, otherwise
	 * generates an empty object schema. Injects a `confirmed` boolean
	 * property for destructive tools.
	 *
	 * @param {string} toolId - Ability identifier.
	 * @param {Object} tool   - Tool definition from the registry.
	 * @return {Object} JSON Schema object.
	 */
	buildInputSchema( toolId, tool ) {
		// Get PHP schema from localized config
		const phpAbility = window.wpAgenticAdmin?.abilities?.[ toolId ];
		const phpSchema = phpAbility?.inputSchema;

		let schema;

		if ( phpSchema && typeof phpSchema === 'object' ) {
			// Clone to avoid mutating the original
			schema = JSON.parse( JSON.stringify( phpSchema ) );
		} else {
			schema = {
				type: 'object',
				properties: {},
			};
		}

		// Inject confirmed property for destructive tools
		const isDestructive =
			tool.requiresConfirmation ||
			( tool.annotations && tool.annotations.destructive );

		if ( isDestructive ) {
			if ( ! schema.properties ) {
				schema.properties = {};
			}
			schema.properties.confirmed = {
				type: 'boolean',
				description:
					'Set to true to confirm this destructive operation.',
			};
		}

		return schema;
	}

	/**
	 * Convert an ability ID to a WebMCP tool name.
	 *
	 * @example toToolName('wp-agentic-admin/cache-flush') → 'wp_agentic_admin__cache_flush'
	 *
	 * @param {string} abilityId - Ability identifier (e.g. 'wp-agentic-admin/cache-flush').
	 * @return {string} Snake_case tool name with double underscore namespace separator.
	 */
	toToolName( abilityId ) {
		return abilityId.replace( /\//g, '__' ).replace( /-/g, '_' );
	}

	/**
	 * Convert a WebMCP tool name back to an ability ID.
	 *
	 * @example fromToolName('wp_agentic_admin__cache_flush') → 'wp-agentic-admin/cache-flush'
	 *
	 * @param {string} toolName - Snake_case tool name.
	 * @return {string} Ability identifier.
	 */
	fromToolName( toolName ) {
		return toolName.replace( /__/g, '/' ).replace( /_/g, '-' );
	}

	/**
	 * Clean up all registered WebMCP tools.
	 */
	cleanup() {
		if ( ! this._initialized ) {
			return;
		}

		for ( const [ toolName, registration ] of this.registeredTools ) {
			try {
				if (
					navigator.modelContext &&
					typeof navigator.modelContext.unregisterTool === 'function'
				) {
					navigator.modelContext.unregisterTool( toolName );
				} else if (
					registration &&
					typeof registration.unregister === 'function'
				) {
					registration.unregister();
				}
			} catch ( err ) {
				log.error(
					`Failed to unregister WebMCP tool ${ toolName }:`,
					err.message
				);
			}
		}

		this.registeredTools.clear();
		this._initialized = false;
		log.info( 'WebMCP bridge cleaned up' );
	}
}

// Create singleton instance
const webmcpBridge = new WebMCPBridge();

export { WebMCPBridge, webmcpBridge };
export default webmcpBridge;
