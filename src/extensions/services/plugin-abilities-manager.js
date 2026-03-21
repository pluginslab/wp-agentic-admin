/**
 * Plugin Abilities Manager
 *
 * Manages enabling/disabling of plugin abilities and token budget tracking.
 * Enabled abilities get registered in the tool registry so the LLM can use them.
 * State is persisted in localStorage.
 */

import abilitiesApi from './abilities-api';
import toolRegistry from './tool-registry';
import { createLogger } from '../utils/logger';

const log = createLogger( 'PluginAbilities' );

const STORAGE_KEY = 'wp-agentic-admin-plugin-abilities';

/**
 * Approximate characters per token for Qwen models.
 * Conservative estimate — overcount is safer than undercount.
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Tokens reserved for conversation, tool results, and LLM responses.
 * This is the minimum headroom the agent needs to function.
 */
const CONVERSATION_RESERVE = 1500;

/**
 * Estimate token count for a string.
 *
 * @param {string} text - Text to estimate tokens for.
 * @return {number} Estimated token count.
 */
function estimateTokens( text ) {
	if ( ! text ) {
		return 0;
	}
	return Math.ceil( text.length / CHARS_PER_TOKEN );
}

/**
 * Estimate tokens for a single ability's tool description line.
 * This mirrors what buildSystemPromptPromptBased() generates:
 * "- {id}: {description}"
 *
 * @param {Object} ability - Ability with id, description, label.
 * @return {number} Estimated token count.
 */
function estimateAbilityTokens( ability ) {
	const line = `- ${ ability.id || ability.name }: ${
		ability.description || ability.label || ''
	}`;
	return estimateTokens( line );
}

/**
 * Get the current model's max context size.
 *
 * @return {number} Max context tokens.
 */
function getMaxContext() {
	// Use ModelLoader's effective context size which respects localStorage overrides
	const { ModelLoader } = require( './model-loader' );
	const settings = window.wpAgenticAdmin || {};
	const modelId = settings.currentModel || '';
	return ModelLoader.getEffectiveContextSize( modelId );
}

/**
 * PluginAbilitiesManager class
 */
class PluginAbilitiesManager {
	constructor() {
		this.enabledIds = new Set();
		this.discoveredAbilities = [];
		this.listeners = new Set();
		this.loadState();

		// If there are enabled abilities, fetch their metadata on startup
		// so we can update the run-plugin-ability tool description.
		if ( this.enabledIds.size > 0 ) {
			this.init();
		}
	}

	/**
	 * Fetch abilities and update the run tool description on startup.
	 */
	async init() {
		try {
			const data = await abilitiesApi.listAbilities();
			const all = Array.isArray( data ) ? data : [];
			const external = all.filter(
				( a ) =>
					a.name &&
					! a.name.startsWith( 'wp-agentic-admin/' ) &&
					! a.name.startsWith( 'core/' )
			);
			this.setDiscoveredAbilities( external );
			log.info(
				`Loaded ${ external.length } plugin abilities on startup, ${ this.enabledIds.size } enabled`
			);
		} catch ( err ) {
			log.warn( 'Failed to load plugin abilities on startup:', err );
		}
	}

	/**
	 * Load enabled state from localStorage.
	 */
	loadState() {
		try {
			const data = localStorage.getItem( STORAGE_KEY );
			if ( data ) {
				const parsed = JSON.parse( data );
				this.enabledIds = new Set( parsed.enabledIds || [] );
			}
		} catch ( err ) {
			log.warn( 'Failed to load state:', err );
		}
	}

	/**
	 * Save enabled state to localStorage.
	 */
	saveState() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify( {
					enabledIds: Array.from( this.enabledIds ),
				} )
			);
		} catch ( err ) {
			log.warn( 'Failed to save state:', err );
		}
	}

	/**
	 * Subscribe to state changes.
	 *
	 * @param {Function} listener - Callback on change.
	 * @return {Function} Unsubscribe function.
	 */
	subscribe( listener ) {
		this.listeners.add( listener );
		return () => this.listeners.delete( listener );
	}

	/**
	 * Notify listeners.
	 */
	notify() {
		this.listeners.forEach( ( fn ) => fn() );
	}

	/**
	 * Set the discovered abilities list (from AbilityBrowser or discover-abilities).
	 *
	 * @param {Object[]} abilities - Array of ability objects from the REST API.
	 */
	setDiscoveredAbilities( abilities ) {
		this.discoveredAbilities = abilities;
		// Prune enabled IDs that no longer exist.
		const validIds = new Set( abilities.map( ( a ) => a.name || a.id ) );
		let changed = false;
		for ( const id of this.enabledIds ) {
			if ( ! validIds.has( id ) ) {
				this.enabledIds.delete( id );
				changed = true;
			}
		}
		if ( changed ) {
			this.saveState();
		}
		this.updateRunToolDescription();
		this.notify();
	}

	/**
	 * Enable a plugin ability.
	 *
	 * @param {string} abilityId - Ability ID to enable.
	 */
	enable( abilityId ) {
		if ( this.enabledIds.has( abilityId ) ) {
			return;
		}

		this.enabledIds.add( abilityId );
		this.saveState();
		this.updateRunToolDescription();
		this.notify();
		log.info( `Enabled plugin ability: ${ abilityId }` );
	}

	/**
	 * Disable a plugin ability.
	 *
	 * @param {string} abilityId - Ability ID to disable.
	 */
	disable( abilityId ) {
		if ( ! this.enabledIds.has( abilityId ) ) {
			return;
		}

		this.enabledIds.delete( abilityId );
		this.saveState();
		this.updateRunToolDescription();
		this.notify();
		log.info( `Disabled plugin ability: ${ abilityId }` );
	}

	/**
	 * Toggle an ability's enabled state.
	 *
	 * @param {string} abilityId - Ability ID to toggle.
	 */
	toggle( abilityId ) {
		if ( this.enabledIds.has( abilityId ) ) {
			this.disable( abilityId );
		} else {
			this.enable( abilityId );
		}
	}

	/**
	 * Enable all discovered abilities.
	 */
	enableAll() {
		this.discoveredAbilities.forEach( ( a ) => {
			const id = a.name || a.id;
			this.enabledIds.add( id );
		} );
		this.saveState();
		this.updateRunToolDescription();
		this.notify();
	}

	/**
	 * Disable all plugin abilities.
	 */
	disableAll() {
		this.enabledIds.clear();
		this.saveState();
		this.updateRunToolDescription();
		this.notify();
	}

	/**
	 * Check if an ability is enabled.
	 *
	 * @param {string} abilityId - Ability ID.
	 * @return {boolean} True if enabled.
	 */
	isEnabled( abilityId ) {
		return this.enabledIds.has( abilityId );
	}

	/**
	 * Get the list of enabled ability IDs.
	 *
	 * @return {string[]} Array of enabled ability IDs.
	 */
	getEnabledIds() {
		return Array.from( this.enabledIds );
	}

	/**
	 * Update the run-plugin-ability tool's description to include enabled abilities.
	 *
	 * This injects the list of available plugin abilities directly into the
	 * system prompt so the 1.7B model knows what ability_id values to use.
	 */
	updateRunToolDescription() {
		const runTool = toolRegistry.get(
			'wp-agentic-admin/run-plugin-ability'
		);
		if ( ! runTool ) {
			return;
		}

		if ( this.enabledIds.size === 0 ) {
			runTool.description =
				'Run a plugin ability by ID. No plugin abilities are currently enabled.';
			return;
		}

		const lines = [];
		for ( const id of this.enabledIds ) {
			const ability = this.discoveredAbilities.find(
				( a ) => ( a.name || a.id ) === id
			);
			if ( ability ) {
				lines.push(
					`${ id }: ${ ability.description || ability.label }`
				);
			}
		}

		runTool.description =
			'Run a plugin ability. Pass ability_id and args. Available: ' +
			lines.join( '; ' );
	}

	/**
	 * Get token budget information.
	 *
	 * Uses the same tool list format as the ReAct agent system prompt
	 * to estimate token usage. The system prompt is built from
	 * toolRegistry.getAll(), which includes both built-in and any
	 * enabled external abilities.
	 *
	 * @return {Object} Budget info.
	 */
	getTokenBudget() {
		const maxContext = getMaxContext();
		const allTools = toolRegistry.getAll();

		// Build the full system prompt the same way react-agent does.
		// This is the single source of truth for token cost.
		const toolsList = allTools
			.map( ( t ) => `- ${ t.id }: ${ t.description || t.label || '' }` )
			.join( '\n' );

		const systemPromptTokens = estimateTokens( toolsList );

		// Split: which tokens come from built-in vs external tools.
		let builtInTokens = 0;
		let externalTokens = 0;
		const breakdown = [];

		for ( const tool of allTools ) {
			const line = `- ${ tool.id }: ${
				tool.description || tool.label || ''
			}\n`;
			const tokens = estimateTokens( line );

			if ( this.enabledIds.has( tool.id ) ) {
				externalTokens += tokens;
				breakdown.push( { id: tool.id, tokens } );
			} else {
				builtInTokens += tokens;
			}
		}

		// Total used = full system prompt + conversation reserve.
		const totalUsed = systemPromptTokens + CONVERSATION_RESERVE;

		// Budget available for external abilities.
		const availableForExternal =
			maxContext - builtInTokens - CONVERSATION_RESERVE;
		const totalBudget = Math.max( availableForExternal, 0 );

		const percentage =
			totalBudget > 0
				? Math.min(
						Math.round( ( externalTokens / totalBudget ) * 100 ),
						100
				  )
				: 0;

		return {
			used: externalTokens,
			total: totalBudget,
			maxContext,
			totalUsed,
			builtInTokens,
			percentage,
			breakdown,
		};
	}

	/**
	 * Estimate tokens that would be added by enabling an ability.
	 *
	 * @param {string} abilityId - Ability ID.
	 * @return {number} Estimated tokens.
	 */
	estimateAbilityTokenCost( abilityId ) {
		const ability = this.discoveredAbilities.find(
			( a ) => ( a.name || a.id ) === abilityId
		);
		return ability ? estimateAbilityTokens( ability ) : 0;
	}

	/**
	 * Get dynamic bundles grouped by plugin namespace.
	 *
	 * Groups all enabled plugin abilities by their namespace (e.g. "woocommerce")
	 * and returns bundle objects compatible with ABILITY_BUNDLES.
	 *
	 * @return {Object[]} Array of bundle objects.
	 */
	getPluginBundles() {
		const groups = {};

		for ( const id of this.enabledIds ) {
			const ability = this.discoveredAbilities.find(
				( a ) => ( a.name || a.id ) === id
			);
			if ( ! ability ) {
				continue;
			}

			const namespace = id.split( '/' )[ 0 ];
			if ( ! groups[ namespace ] ) {
				groups[ namespace ] = {
					abilities: [],
					icon: ability.icon || null,
					label: namespace,
				};
			}
			groups[ namespace ].abilities.push( ability );
		}

		return Object.entries( groups ).map( ( [ namespace, group ] ) => ( {
			id: `plugin-${ namespace }`,
			label: group.label,
			icon: group.icon,
			isPluginBundle: true,
			pluginNamespace: namespace,
			description: `${ group.abilities.length } abilities from ${ namespace }`,
			abilities: [ 'wp-agentic-admin/run-plugin-ability' ],
			pluginAbilityIds: group.abilities.map( ( a ) => a.name || a.id ),
		} ) );
	}

	/**
	 * Temporarily scope the run-plugin-ability description to a single plugin.
	 *
	 * Call this before sending a message with a plugin bundle active,
	 * then call clearPluginScope() after the message completes.
	 *
	 * @param {string} namespace - Plugin namespace to scope to.
	 */
	scopeToPlugin( namespace ) {
		const runTool = toolRegistry.get(
			'wp-agentic-admin/run-plugin-ability'
		);
		if ( ! runTool ) {
			return;
		}

		// Save original description for restoration.
		if ( ! this._savedDescription ) {
			this._savedDescription = runTool.description;
		}

		const lines = [];
		for ( const id of this.enabledIds ) {
			if ( ! id.startsWith( namespace + '/' ) ) {
				continue;
			}
			const ability = this.discoveredAbilities.find(
				( a ) => ( a.name || a.id ) === id
			);
			if ( ability ) {
				lines.push(
					`${ id }: ${ ability.description || ability.label }`
				);
			}
		}

		runTool.description =
			'Run a plugin ability. Pass ability_id and args. Available: ' +
			lines.join( '; ' );
	}

	/**
	 * Restore the run-plugin-ability description after plugin-scoped request.
	 */
	clearPluginScope() {
		const runTool = toolRegistry.get(
			'wp-agentic-admin/run-plugin-ability'
		);
		if ( runTool && this._savedDescription ) {
			runTool.description = this._savedDescription;
			this._savedDescription = null;
		}
	}
}

// Singleton
const pluginAbilitiesManager = new PluginAbilitiesManager();

export {
	PluginAbilitiesManager,
	pluginAbilitiesManager,
	estimateTokens,
	estimateAbilityTokens,
};
export default pluginAbilitiesManager;
