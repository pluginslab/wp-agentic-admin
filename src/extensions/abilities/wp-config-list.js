/**
 * WP-Config Constants List Ability
 *
 * ABILITY OVERVIEW:
 * =================
 * Lists and categorizes all PHP constants defined in wp-config.php.
 *
 * Delegates file reading to the read-file ability so that all path
 * resolution, ABSPATH security checks, and sensitive-value redaction
 * (DB_PASSWORD, auth keys, salts) are handled by the existing PHP backend.
 * The JS layer then parses define() calls from the already-redacted content
 * and groups them by purpose.
 *
 * EXECUTE RETURNS:
 * {
 *   success: true,
 *   constants: [{ name, value, category }],
 *   total: 23,
 *   was_redacted: true
 * }
 *
 * DISPLAY STRATEGY:
 * Uses preferSummarize: true — summarize() renders a grouped markdown list
 * directly, bypassing the LLM to avoid truncation of long constant tables.
 *
 * @see includes/abilities/read-file.php  — file reading and redaction backend
 * @see docs/ABILITIES-GUIDE.md           — registration API reference
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/** Constants in the Database category. */
const DB_CONSTANTS = new Set( [
	'DB_NAME',
	'DB_USER',
	'DB_PASSWORD',
	'DB_HOST',
	'DB_CHARSET',
	'DB_COLLATE',
] );

/** Constants in the Debug category. */
const DEBUG_CONSTANTS = new Set( [
	'WP_DEBUG',
	'WP_DEBUG_LOG',
	'WP_DEBUG_DISPLAY',
	'SCRIPT_DEBUG',
	'SAVEQUERIES',
	'WP_LOCAL_DEV',
] );

/** Constants in the Performance category. */
const PERFORMANCE_CONSTANTS = new Set( [
	'WP_CACHE',
	'COMPRESS_CSS',
	'COMPRESS_SCRIPTS',
	'ENFORCE_GZIP',
	'CONCATENATE_SCRIPTS',
	'WP_MEMORY_LIMIT',
	'WP_MAX_MEMORY_LIMIT',
] );

/** Constants in the Security category. */
const SECURITY_CONSTANTS = new Set( [
	'DISALLOW_FILE_EDIT',
	'DISALLOW_FILE_MODS',
	'FORCE_SSL_ADMIN',
	'FORCE_SSL_LOGIN',
	'WP_HTTP_BLOCK_EXTERNAL',
	'ALLOW_UNFILTERED_UPLOADS',
] );

/** Constants in the URLs & Paths category. */
const URL_CONSTANTS = new Set( [
	'WP_HOME',
	'WP_SITEURL',
	'WP_CONTENT_DIR',
	'WP_CONTENT_URL',
	'WP_PLUGIN_DIR',
	'WP_PLUGIN_URL',
	'UPLOADS',
] );

/** Constants in the Multisite category. */
const MULTISITE_CONSTANTS = new Set( [
	'WP_ALLOW_MULTISITE',
	'MULTISITE',
	'SUBDOMAIN_INSTALL',
	'DOMAIN_CURRENT_SITE',
	'PATH_CURRENT_SITE',
	'SITE_ID_CURRENT_SITE',
	'BLOG_ID_CURRENT_SITE',
	'SUNRISE',
] );

/** Category display order and headings. */
const CATEGORY_ORDER = [
	{ key: 'database', heading: 'Database' },
	{ key: 'debug', heading: 'Debug' },
	{ key: 'security', heading: 'Security' },
	{ key: 'performance', heading: 'Performance' },
	{ key: 'urls', heading: 'URLs & Paths' },
	{ key: 'keys_salts', heading: 'Auth Keys & Salts' },
	{ key: 'multisite', heading: 'Multisite' },
	{ key: 'custom', heading: 'Custom' },
];

/**
 * Determine the display category for a constant name.
 *
 * @param {string} name - Constant name (uppercase).
 * @return {string} Category key.
 */
function getCategory( name ) {
	if ( DB_CONSTANTS.has( name ) ) {
		return 'database';
	}
	if ( /(_KEY|_SALT)$/.test( name ) ) {
		return 'keys_salts';
	}
	if ( DEBUG_CONSTANTS.has( name ) ) {
		return 'debug';
	}
	if ( PERFORMANCE_CONSTANTS.has( name ) ) {
		return 'performance';
	}
	if ( SECURITY_CONSTANTS.has( name ) ) {
		return 'security';
	}
	if ( URL_CONSTANTS.has( name ) ) {
		return 'urls';
	}
	if ( MULTISITE_CONSTANTS.has( name ) ) {
		return 'multisite';
	}
	return 'custom';
}

/**
 * Parse define() constants from PHP file content.
 *
 * Handles boolean, integer, float, null, and string (single- or double-quoted)
 * values. Strings may contain [REDACTED] after server-side redaction.
 *
 * @param {string} content - PHP file content (already redacted server-side).
 * @return {Array<{name: string, value: string, category: string}>} Parsed constants.
 */
function parseDefineConstants( content ) {
	const constants = [];
	const defineRe =
		/define\s*\(\s*['"]([A-Z][A-Z0-9_]*)["']\s*,\s*(true|false|null|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")\s*\)/gi;
	let match;
	while ( ( match = defineRe.exec( content ) ) !== null ) {
		const name = match[ 1 ];
		let value = match[ 2 ];
		// Strip surrounding quotes from string values.
		if (
			( value.startsWith( "'" ) && value.endsWith( "'" ) ) ||
			( value.startsWith( '"' ) && value.endsWith( '"' ) )
		) {
			value = value.slice( 1, -1 );
		}
		constants.push( { name, value, category: getCategory( name ) } );
	}
	return constants;
}

/**
 * Format parsed constants as markdown grouped by category.
 *
 * @param {Array<{name: string, value: string, category: string}>} constants   - Parsed constants.
 * @param {boolean}                                                wasRedacted - Whether any values were redacted.
 * @return {string} Markdown formatted output.
 */
function formatConstants( constants, wasRedacted ) {
	// Group by category.
	const byCategory = {};
	for ( const constant of constants ) {
		const { category } = constant;
		if ( ! byCategory[ category ] ) {
			byCategory[ category ] = [];
		}
		byCategory[ category ].push( constant );
	}

	const sections = [];
	for ( const { key, heading } of CATEGORY_ORDER ) {
		const items = byCategory[ key ];
		if ( ! items || items.length === 0 ) {
			continue;
		}
		const lines = items.map(
			( { name, value } ) => `- \`${ name }\` = \`${ value }\``
		);
		sections.push(
			`**${ heading }** (${ items.length })\n${ lines.join( '\n' ) }`
		);
	}

	const redactedNote = wasRedacted
		? '\n> Sensitive values (credentials, keys, salts) are redacted.'
		: '';
	const count = constants.length;

	return (
		`**wp-config.php** — ${ count } constant${
			count !== 1 ? 's' : ''
		} defined${ redactedNote }\n\n` + sections.join( '\n\n' )
	);
}

/**
 * Register the wp-config-list ability with the chat system.
 */
export function registerWpConfigList() {
	registerAbility( 'wp-agentic-admin/wp-config-list', {
		label: 'List wp-config constants',
		description:
			'List and categorize all PHP constants defined in wp-config.php, grouped by purpose (database, debug, security, performance, etc.). Sensitive values are automatically redacted. Use this to check any specific constant value (e.g. is WP_DEBUG enabled? what is WP_MEMORY_LIMIT?) or to list all wp-config constants.',

		keywords: [
			'constants',
			'defined',
			'define',
			'wp-config',
			'configuration',
			'WP_DEBUG',
			'config constants',
			'wp-config constants',
		],

		initialMessage: "I'll list the wp-config.php constants...",

		/**
		 * Read wp-config.php via the read-file ability and parse its constants.
		 *
		 * Delegates to read-file so that path resolution, ABSPATH validation,
		 * and sensitive-value redaction are handled by the existing PHP backend.
		 *
		 * @return {Promise<Object>} Structured result with parsed constants.
		 */
		execute: async () => {
			const fileResult = await executeAbility(
				'wp-agentic-admin/read-file',
				{ file_path: 'wp-config.php', lines: 500 }
			);

			if ( ! fileResult.success ) {
				return {
					success: false,
					message:
						fileResult.message || 'Could not read wp-config.php.',
				};
			}

			const constants = parseDefineConstants( fileResult.content || '' );

			return {
				success: true,
				constants,
				total: constants.length,
				was_redacted: fileResult.was_redacted || false,
			};
		},

		/**
		 * Format constants grouped by category for display in chat.
		 *
		 * @param {Object} result - Result from execute().
		 * @return {string} Markdown summary.
		 */
		summarize: ( result ) => {
			if ( ! result.success ) {
				return `**Could not list constants:** ${ result.message }`;
			}

			if ( result.total === 0 ) {
				return '**wp-config.php** — No `define()` constants found.';
			}

			return formatConstants( result.constants, result.was_redacted );
		},

		/**
		 * Plain-English interpretation for the LLM when used in a ReAct chain.
		 *
		 * @param {Object} result - Result from execute().
		 * @return {string} Interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result.success ) {
				return `Failed to list wp-config constants: ${ result.message }`;
			}
			const lines = result.constants.map(
				( { name, value } ) => `${ name }=${ value }`
			);
			return `wp-config.php constants (${ result.total }):\n${ lines.join(
				'\n'
			) }`;
		},

		// Read-only — no confirmation needed.
		requiresConfirmation: false,

		// Use summarize() directly — bypass LLM to avoid truncation of the constant list.
		preferSummarize: true,
	} );
}

export default registerWpConfigList;
