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
 * Register the core/get-site-info ability with the chat system.
 */
export function registerCoreSiteInfo() {
	registerAbility( 'core/get-site-info', {
		label: 'Get site information',

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
			const lowerMessage = message.toLowerCase();
			const fields = [];

			// Check for specific field requests
			if ( lowerMessage.includes( 'version' ) ) {
				fields.push( 'version' );
			}
			if (
				lowerMessage.includes( 'name' ) ||
				lowerMessage.includes( 'title' )
			) {
				fields.push( 'name' );
			}
			if (
				lowerMessage.includes( 'url' ) ||
				lowerMessage.includes( 'address' )
			) {
				fields.push( 'url' );
			}
			if (
				lowerMessage.includes( 'tagline' ) ||
				lowerMessage.includes( 'description' )
			) {
				fields.push( 'description' );
			}
			if ( lowerMessage.includes( 'email' ) ) {
				fields.push( 'admin_email' );
			}
			if (
				lowerMessage.includes( 'language' ) ||
				lowerMessage.includes( 'locale' )
			) {
				fields.push( 'language' );
			}

			// Return empty fields to get all info if no specific request
			return fields.length > 0 ? { fields } : {};
		},

		// Read-only operation - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerCoreSiteInfo;
