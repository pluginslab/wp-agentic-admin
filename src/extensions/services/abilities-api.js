/**
 * Abilities API Client
 *
 * REST client for interacting with the WordPress Abilities API.
 *
 */

/**
 * AbilitiesAPI class for making REST API calls to the Abilities API
 */
class AbilitiesAPI {
	/**
	 * Constructor
	 */
	constructor() {
		const settings = window.wpAgenticAdmin || {};
		this.restUrl = settings.restUrl || '/wp-json/wp-abilities/v1';
		this.nonce = settings.nonce || '';
		this.abilitiesCache = new Map(); // Cache ability metadata
	}

	/**
	 * Make a fetch request with proper headers
	 *
	 * @param {string} endpoint - API endpoint
	 * @param {Object} options  - Fetch options
	 * @return {Promise<Object>} Response data
	 */
	async request( endpoint, options = {} ) {
		const url = `${ this.restUrl }${ endpoint }`;

		const headers = {
			'X-WP-Nonce': this.nonce,
			...options.headers,
		};

		// Only add Content-Type for requests with JSON body
		if ( options.body ) {
			headers[ 'Content-Type' ] = 'application/json';
		}

		console.log( '[AbilitiesAPI] Request:', options.method || 'GET', url );

		try {
			const response = await fetch( url, {
				...options,
				headers,
				credentials: 'same-origin',
			} );

			if ( ! response.ok ) {
				const errorData = await response.json().catch( () => ( {} ) );
				console.error( '[AbilitiesAPI] Error response:', errorData );
				throw new Error(
					errorData.message || `HTTP error ${ response.status }`
				);
			}

			const data = await response.json();
			console.log( '[AbilitiesAPI] Response:', data );
			return data;
		} catch ( error ) {
			console.error( '[AbilitiesAPI] Request failed:', error );
			throw error;
		}
	}

	/**
	 * List all available abilities
	 *
	 * @param {string|null} category - Optional category filter
	 * @return {Promise<Array>} List of abilities
	 */
	async listAbilities( category = null ) {
		let endpoint = '/abilities';
		if ( category ) {
			endpoint += `?category=${ encodeURIComponent( category ) }`;
		}
		const abilities = await this.request( endpoint );

		// Cache the abilities metadata
		if ( Array.isArray( abilities ) ) {
			abilities.forEach( ( ability ) => {
				// The API returns 'name' not 'id'
				const abilityId = ability.name || ability.id;
				if ( abilityId ) {
					this.abilitiesCache.set( abilityId, ability );
					console.log(
						'[AbilitiesAPI] Cached ability:',
						abilityId,
						'isReadOnly:',
						ability?.meta?.annotations?.isReadOnly
					);
				}
			} );
		}

		return abilities;
	}

	/**
	 * Get a specific ability by namespace and name
	 *
	 * @param {string} namespace - Ability namespace (e.g., 'wp-agentic-admin')
	 * @param {string} name      - Ability name (e.g., 'error-log-read')
	 * @return {Promise<Object>} Ability details
	 */
	async getAbility( namespace, name ) {
		const abilityId = `${ namespace }/${ name }`;

		// Check cache first
		if ( this.abilitiesCache.has( abilityId ) ) {
			return this.abilitiesCache.get( abilityId );
		}

		const ability = await this.request(
			`/abilities/${ namespace }/${ name }`
		);

		// Cache the result
		if ( ability ) {
			this.abilitiesCache.set( abilityId, ability );
		}

		return ability;
	}

	/**
	 * Check if an ability is read-only based on its metadata
	 *
	 * @param {Object} ability - Ability metadata object
	 * @return {boolean} True if the ability is read-only
	 */
	isReadOnly( ability ) {
		// Check annotations for readonly flag
		const annotations = ability?.meta?.annotations || {};
		return annotations.isReadOnly === true;
	}

	/**
	 * Check if an ability is destructive based on its metadata
	 *
	 * @param {Object} ability - Ability metadata object
	 * @return {boolean} True if the ability is destructive
	 */
	isDestructive( ability ) {
		const annotations = ability?.meta?.annotations || {};
		return annotations.destructive === true;
	}

	/**
	 * Determine the correct HTTP method for an ability
	 *
	 * WordPress Abilities API requires:
	 * - GET for read-only abilities
	 * - DELETE for destructive write operations
	 * - POST for non-destructive write operations
	 *
	 * @param {Object} ability - Ability metadata object
	 * @return {string} HTTP method (GET, POST, or DELETE)
	 */
	getHttpMethod( ability ) {
		if ( this.isReadOnly( ability ) ) {
			return 'GET';
		}
		// Destructive operations require DELETE method
		if ( this.isDestructive( ability ) ) {
			return 'DELETE';
		}
		// Non-destructive write operations use POST
		return 'POST';
	}

	/**
	 * Build query string for nested object parameters
	 * Converts {lines: 50} to input[lines]=50
	 *
	 * @param {Object} input - Input object
	 * @return {string} Query string
	 */
	buildInputQueryString( input ) {
		if ( ! input || typeof input !== 'object' ) {
			return '';
		}

		const params = new URLSearchParams();

		// For nested object format: input[key]=value
		Object.entries( input ).forEach( ( [ key, value ] ) => {
			if ( value !== undefined && value !== null ) {
				params.append( `input[${ key }]`, String( value ) );
			}
		} );

		const queryString = params.toString();
		return queryString ? `?${ queryString }` : '';
	}

	/**
	 * Execute an ability
	 *
	 * @param {string} namespace - Ability namespace
	 * @param {string} name      - Ability name
	 * @param {Object} input     - Input parameters for the ability
	 * @return {Promise<Object>} Execution result
	 */
	async executeAbility( namespace, name, input = {} ) {
		// First, get the ability metadata to determine the correct HTTP method
		let ability;
		const abilityId = `${ namespace }/${ name }`;

		console.log(
			'[AbilitiesAPI] executeAbility:',
			abilityId,
			'input:',
			input
		);
		console.log(
			'[AbilitiesAPI] Cache has ability:',
			this.abilitiesCache.has( abilityId )
		);

		if ( this.abilitiesCache.has( abilityId ) ) {
			ability = this.abilitiesCache.get( abilityId );
			console.log( '[AbilitiesAPI] Using cached ability:', ability );
		} else {
			try {
				ability = await this.getAbility( namespace, name );
				console.log( '[AbilitiesAPI] Fetched ability:', ability );
			} catch ( err ) {
				console.warn(
					'[AbilitiesAPI] Could not fetch ability metadata, defaulting to POST:',
					err
				);
				ability = null;
			}
		}

		const method = ability ? this.getHttpMethod( ability ) : 'POST';
		const baseEndpoint = `/abilities/${ namespace }/${ name }/run`;
		const hasInput =
			input &&
			typeof input === 'object' &&
			Object.keys( input ).length > 0;

		console.log( '[AbilitiesAPI] Method:', method, 'hasInput:', hasInput );

		if ( method === 'GET' || method === 'DELETE' ) {
			// Use GET/DELETE with input as nested query parameters
			// WordPress REST API expects input[key]=value format for object params
			// DELETE requests use query params because DELETE with body is not always supported
			let endpoint = baseEndpoint;

			if ( hasInput ) {
				endpoint += this.buildInputQueryString( input );
				console.log(
					`[AbilitiesAPI] ${ method } with input:`,
					endpoint
				);
			} else {
				console.log(
					`[AbilitiesAPI] ${ method } without input:`,
					endpoint
				);
			}

			return this.request( endpoint, { method } );
		}
		// Use POST with input in JSON body
		// Always send input as an object - abilities with input_schema expect it
		// even if the schema has no required properties
		const body = { input: input || {} };
		console.log( `[AbilitiesAPI] ${ method } body:`, body );

		return this.request( baseEndpoint, {
			method,
			body: JSON.stringify( body ),
		} );
	}

	/**
	 * Parse ability identifier string into namespace and name
	 *
	 * @param {string} abilityId - Full ability ID (e.g., 'wp-agentic-admin/error-log-read')
	 * @return {Object} Object with namespace and name properties
	 */
	static parseAbilityId( abilityId ) {
		const [ namespace, name ] = abilityId.split( '/' );
		return { namespace, name };
	}

	/**
	 * Execute ability by full ID
	 *
	 * @param {string} abilityId - Full ability ID
	 * @param {Object} input     - Input parameters
	 * @return {Promise<Object>} Execution result
	 */
	async executeAbilityById( abilityId, input = {} ) {
		const { namespace, name } = AbilitiesAPI.parseAbilityId( abilityId );
		return this.executeAbility( namespace, name, input );
	}

	/**
	 * Clear the abilities cache
	 */
	clearCache() {
		this.abilitiesCache.clear();
	}

	/**
	 * Pre-fetch and cache all abilities
	 * Call this on app load for better performance
	 */
	async prefetchAbilities() {
		try {
			await this.listAbilities();
		} catch ( err ) {
			console.warn( 'Failed to prefetch abilities:', err );
		}
	}
}

// Create singleton instance
const abilitiesApi = new AbilitiesAPI();

export { AbilitiesAPI, abilitiesApi };
export default abilitiesApi;
