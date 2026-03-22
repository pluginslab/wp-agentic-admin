/**
 * Core Site Info Ability
 *
 * Wraps WordPress core ability: core/get-site-info
 * Returns site information like name, URL, version, etc.
 *
 * ABILITY OVERVIEW:
 * =================
 * This is a WordPress 6.9+ core ability that we provide a chat interface for.
 * No PHP registration needed - WordPress registers this automatically.
 * Demonstrates:
 * - Wrapping a core WordPress ability
 * - Handling optional field filtering
 * - Formatting site info for human readability
 *
 * PHP BACKEND RETURNS (WordPress Core):
 * {
 *   name: "My WordPress Site",
 *   description: "Just another WordPress site",
 *   url: "https://example.com",
 *   wpurl: "https://example.com",
 *   admin_email: "admin@example.com",
 *   charset: "UTF-8",
 *   language: "en_US",
 *   version: "6.9.0"
 * }
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.1.0
 * @see WordPress core: wp-includes/abilities.php
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Map of data fields to the keywords that indicate a user is asking about them.
 */
const FIELD_KEYWORDS = {
	name: [ 'name', 'title' ],
	url: [ 'url', 'address' ],
	description: [ 'tagline', 'description' ],
	version: [ 'version' ],
	admin_email: [ 'email' ],
	language: [ 'language', 'locale' ],
	charset: [ 'charset', 'encoding' ],
};

/**
 * Detect which site-info fields a user message is asking about.
 *
 * @param {string} message - The user's message.
 * @return {string[]} Array of field names, empty if no specific fields detected.
 */
function detectRequestedFields( message ) {
	const lower = message.toLowerCase();
	const fields = [];
	for ( const [ field, keywords ] of Object.entries( FIELD_KEYWORDS ) ) {
		if ( keywords.some( ( kw ) => lower.includes( kw ) ) ) {
			fields.push( field );
		}
	}
	return fields;
}

/**
 * Register the core/get-site-info ability with the chat system.
 */
export function registerCoreSiteInfo() {
	registerAbility( 'core/get-site-info', {
		label: 'Get site information',
		description:
			'Get WordPress site details: site name, tagline, URL, admin email, language, charset, and WordPress version. Use for questions about the site identity or configuration.',

		keywords: [
			'site name',
			'site title',
			'tagline',
			'site tagline',
			'what site is this',
			'which site is this',
			'admin email',
			'site charset',
			'site language',
			'bloginfo',
		],

		initialMessage: 'Fetching site information...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from WordPress core.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to retrieve site information.';
			}

			const lines = [];

			if ( result.name ) {
				lines.push( ` * * Site Name: * * ${ result.name }` );
			}
			if ( result.description ) {
				lines.push( ` * * Tagline: * * ${ result.description }` );
			}
			if ( result.url ) {
				lines.push( ` * * Site URL: * * ${ result.url }` );
			}
			if ( result.version ) {
				lines.push( ` * * WordPress Version: * * ${ result.version }` );
			}
			if ( result.language ) {
				lines.push( ` * * Language: * * ${ result.language }` );
			}
			if ( result.admin_email ) {
				lines.push( ` * * Admin Email: * * ${ result.admin_email }` );
			}
			if ( result.charset ) {
				lines.push( ` * * Charset: * * ${ result.charset }` );
			}

			if ( lines.length === 0 ) {
				return 'Site information retrieved but no data available.';
			}

			return lines.join( '\n' );
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * Filters output to only the fields the user asked about,
		 * so small models return focused answers instead of dumping everything.
		 *
		 * @param {Object} result        - The result from WordPress core.
		 * @param {string} [userMessage] - The user's original message.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result, userMessage ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to retrieve site information.';
			}

			const fieldBuilders = {
				name: () => result.name && `site name is "${ result.name }"`,
				description: () =>
					result.description &&
					`tagline is "${ result.description }"`,
				url: () => result.url && `URL is ${ result.url }`,
				version: () =>
					result.version && `WordPress ${ result.version }`,
				language: () =>
					result.language && `language: ${ result.language }`,
				admin_email: () =>
					result.admin_email &&
					`admin email: ${ result.admin_email }`,
				charset: () => result.charset && `charset: ${ result.charset }`,
			};

			const requested = userMessage
				? detectRequestedFields( userMessage )
				: [];

			const fieldsToInclude =
				requested.length > 0 ? requested : Object.keys( fieldBuilders );

			const parts = fieldsToInclude
				.map( ( f ) => fieldBuilders[ f ]?.() )
				.filter( Boolean );

			if ( parts.length === 0 ) {
				return 'Site information was retrieved but contained no data.';
			}
			return `Site info: ${ parts.join( ', ' ) }.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The result from WordPress core.
		 */
		execute: async ( params ) => {
			// core/get-site-info accepts optional 'fields' array
			const input = {};

			if ( params.fields && Array.isArray( params.fields ) ) {
				input.fields = params.fields;
			}

			return executeAbility( 'core/get-site-info', input );
		},

		/**
		 * Parse user intent to extract parameters.
		 *
		 * @param {string} message - The user's message.
		 * @return {Object} Extracted parameters.
		 */
		parseIntent: ( message ) => {
			const fields = detectRequestedFields( message );
			return fields.length > 0 ? { fields } : {};
		},

		// Read-only operation - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerCoreSiteInfo;
