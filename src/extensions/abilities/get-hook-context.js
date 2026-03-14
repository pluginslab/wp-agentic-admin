/**
 * Get Hook Context Ability
 *
 * Retrieves detailed information about a specific WordPress hook using the WASM dev docs database.
 * Requires @pluginslab/wp-devdocs-wasm to be installed.
 *
 * ABILITY OVERVIEW:
 * =================
 * This ability looks up a specific WordPress hook by name and returns its type,
 * file location, parameters, and documentation.
 * The database is provided by the optional @pluginslab/wp-devdocs-wasm package.
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @since 0.10.0
 */

import { registerAbility } from '../services/agentic-abilities-api';

/**
 * Register the get-hook-context ability with the chat system.
 */
export function registerGetHookContext() {
	registerAbility( 'wp-agentic-admin/get-hook-context', {
		label: 'Get hook details',
		description:
			'Get detailed information about a single, specific WordPress hook by its exact name. Returns type (action/filter), file location, parameters, and documentation. Only use when the user names one specific hook.',

		keywords: [
			'hook details',
			'hook info',
			'hook parameters',
			'hook documentation',
			'hook arguments',
			'hook signature',
			'what does hook do',
		],

		initialMessage: 'Looking up hook details...',

		/**
		 * Parse user intent to extract the hook name.
		 *
		 * @param {string} message - The user's message.
		 * @return {Object} Extracted parameters.
		 */
		parseIntent: ( message ) => {
			// Look for hook names (word characters, possibly with slashes or hyphens)
			const hookPatterns = [
				// Explicit hook name in quotes
				/['"`]([a-z_][\w/.-]*)['"` ]/i,
				// Common hook name patterns (snake_case with optional prefix)
				/\b((?:wp_|woocommerce_|admin_|pre_|post_|the_|get_|save_|delete_|init|shutdown|plugins_loaded|template_redirect|wp_head|wp_footer|wp_enqueue_scripts|after_setup_theme|widgets_init)[\w]*)\b/i,
				// Any snake_case identifier that looks like a hook
				/\b([a-z]+_[a-z_]+(?:_[a-z_]+)*)\b/i,
			];

			for ( const pattern of hookPatterns ) {
				const match = message.match( pattern );
				if ( match ) {
					return { hook: match[ 1 ] };
				}
			}

			// Fallback: clean the message to use as hook name
			const cleaned = message
				.toLowerCase()
				.replace(
					/^(tell me about|what is|show me|get|describe|explain)\s+(the\s+)?(hook\s+)?/i,
					''
				)
				.replace( /\s+(hook|action|filter)$/i, '' )
				.replace( /\?$/, '' )
				.trim();

			return { hook: cleaned };
		},

		/**
		 * Generate human-readable summary from the result.
		 *
		 * @param {Object} result - The hook context result.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( result ) => {
			if ( ! result || ! result.success ) {
				return result?.message || 'Unable to retrieve hook details.';
			}

			const { hook } = result;
			if ( ! hook ) {
				return 'Hook not found.';
			}

			const lines = [];
			lines.push( `**${ hook.name }** (${ hook.type })` );
			if ( hook.file ) {
				lines.push( `**File:** ${ hook.file }` );
			}
			if ( hook.description ) {
				lines.push( `**Description:** ${ hook.description }` );
			}
			if ( hook.params && hook.params.length > 0 ) {
				lines.push(
					`**Parameters:** ${ hook.params
						.map( ( p ) => p.name )
						.join( ', ' ) }`
				);
			}
			return lines.join( '\n' );
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The hook context result.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result || ! result.success ) {
				return result?.message || 'Unable to retrieve hook details.';
			}

			const { hook } = result;
			if ( ! hook ) {
				return 'Hook not found.';
			}

			const parts = [ `Hook "${ hook.name }" is a ${ hook.type }` ];
			if ( hook.file ) {
				parts.push( `in file ${ hook.file }` );
			}
			if ( hook.params && hook.params.length > 0 ) {
				parts.push(
					`params: ${ hook.params
						.map( ( p ) => p.name )
						.join( ', ' ) }`
				);
			}
			if ( hook.description ) {
				parts.push( `description: ${ hook.description }` );
			}
			return parts.join( ', ' ) + '.';
		},

		/**
		 * Execute the ability via dynamic import of the WASM package.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The hook details or an error.
		 */
		execute: async ( params ) => {
			try {
				/* eslint-disable import/no-unresolved */
				const { getHookContext } = await import(
					'@pluginslab/wp-devdocs-wasm'
				);
				/* eslint-enable import/no-unresolved */
				const result = await getHookContext( params.hook );
				return { success: true, ...result };
			} catch ( err ) {
				return {
					success: false,
					message:
						'WordPress dev docs WASM module is not available. Install @pluginslab/wp-devdocs-wasm to enable this feature.',
				};
			}
		},

		requiresConfirmation: false,
	} );
}

export default registerGetHookContext;
