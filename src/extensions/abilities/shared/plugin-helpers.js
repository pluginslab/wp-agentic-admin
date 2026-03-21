/**
 * Shared Plugin Helper Functions
 *
 * Common functionality used across plugin-related abilities to avoid code duplication.
 */

/**
 * Common plugin name mappings.
 *
 * Maps plugin file paths to common names users might say.
 * The API expects the plugin file path like "akismet/akismet.php" or "hello.php".
 */
export const pluginMappings = {
	'hello.php': [ 'hello dolly', 'hello-dolly', 'hellodolly' ],
	'akismet/akismet.php': [ 'akismet', 'akismet anti-spam', 'anti-spam' ],
	'jetpack/jetpack.php': [ 'jetpack' ],
	'woocommerce/woocommerce.php': [ 'woocommerce', 'woo commerce', 'woo' ],
	'contact-form-7/wp-contact-form-7.php': [
		'contact form 7',
		'contact form',
		'cf7',
	],
	'wordpress-seo/wp-seo.php': [ 'yoast', 'yoast seo' ],
	'elementor/elementor.php': [ 'elementor' ],
	'classic-editor/classic-editor.php': [ 'classic editor' ],
	'wordfence/wordfence.php': [ 'wordfence' ],
	'wp-super-cache/wp-cache.php': [ 'wp super cache', 'super cache' ],
	'w3-total-cache/w3-total-cache.php': [ 'w3 total cache', 'total cache' ],
};

/**
 * Extract plugin parameters from user message.
 *
 * This function intelligently maps natural language to the actual plugin
 * file path required by WordPress. It works by:
 * 1. Checking against known plugin mappings
 * 2. Getting the list of all plugins from the already-loaded plugin-list ability
 * 3. Matching the user's message against plugin names (substring matching)
 * 4. Falling back to guessing the plugin path format
 *
 * @param {string}   userMessage    - The user's original message like "activate akismet"
 * @param {string[]} actionKeywords - Keywords that trigger the action (e.g., ['activate', 'enable'])
 * @return {Object|null} Object with { plugin: "path/file.php" } or null if not found
 */
export function extractPluginParams( userMessage, actionKeywords = [] ) {
	const messageLower = userMessage.toLowerCase();

	// First, try to match a known plugin from our static mappings.
	for ( const [ pluginPath, names ] of Object.entries( pluginMappings ) ) {
		if ( names.some( ( name ) => messageLower.includes( name ) ) ) {
			return { plugin: pluginPath };
		}
	}

	// Second, try to use the dynamically loaded plugin list from plugin-list ability.
	if ( window.wpAgenticAdmin?.pluginsList ) {
		const plugins = window.wpAgenticAdmin.pluginsList;

		// Try to find the plugin by matching against name or slug.
		for ( const [ pluginFile, pluginData ] of Object.entries( plugins ) ) {
			const pluginName = pluginData.Name.toLowerCase();
			const pluginSlug = pluginFile.split( '/' )[ 0 ].toLowerCase();

			// Simple fuzzy match: check if the plugin name or slug appears in the message.
			if (
				messageLower.includes( pluginName ) ||
				messageLower.includes( pluginSlug )
			) {
				return { plugin: pluginFile };
			}
		}

		// Also try extracting quoted plugin names like 'activate "hello dolly"'
		const quotedMatch = userMessage.match( /["']([^"']+)["']/ );
		if ( quotedMatch ) {
			const quoted = quotedMatch[ 1 ].toLowerCase();
			for ( const [ pluginFile, pluginData ] of Object.entries(
				plugins
			) ) {
				const pluginName = pluginData.Name.toLowerCase();
				if (
					pluginName.includes( quoted ) ||
					quoted.includes( pluginName )
				) {
					return { plugin: pluginFile };
				}
			}
		}
	}

	// Third, try to extract the plugin name from the message and pass it
	// directly to PHP for fuzzy resolution (PHP has the full plugin list).
	if ( actionKeywords.length > 0 ) {
		const keywordPattern = actionKeywords.join( '|' );
		const pattern = new RegExp(
			`(?:${ keywordPattern })\\s+(?:the\\s+)?(?:plugin\\s+)?["']?([a-z0-9][a-z0-9-_ ]+[a-z0-9])["']?`,
			'i'
		);

		const match = userMessage.match( pattern );
		if ( match && match[ 1 ] ) {
			// Strip trailing "plugin" (e.g. "blocks plugin" → "blocks").
			const name = match[ 1 ].trim().replace( /\s+plugin$/i, '' );
			if ( name ) {
				return { plugin: name };
			}
		}
	}

	// Could not extract plugin name from the message.
	return null;
}

/**
 * Format plugin action result for display.
 *
 * @param {Object} result                - The result from PHP ability.
 * @param {string} defaultSuccessMessage - Default message if result.message is missing.
 * @return {string} Formatted message.
 */
export function formatPluginActionResult(
	result,
	defaultSuccessMessage = 'Action completed successfully.'
) {
	if ( result.error ) {
		return `Failed: ${ result.error }`;
	}
	return result.message || defaultSuccessMessage;
}
