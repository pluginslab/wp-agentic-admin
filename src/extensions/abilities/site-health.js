/**
 * Site Health Ability
 *
 * Gets comprehensive site health information including PHP, WordPress,
 * database versions, and server configuration.
 *
 * ABILITY OVERVIEW:
 * =================
 * This ability demonstrates:
 * - Context-aware summarization (responds differently based on what user asked)
 * - Rich data extraction from a complex result object
 * - Handling optional/missing data gracefully
 *
 * PHP BACKEND RETURNS:
 * {
 *   wordpress_version: "6.9",
 *   php_version: "8.2.10",
 *   mysql_version: "8.0.32",
 *   site_url: "https://example.com",
 *   home_url: "https://example.com",
 *   is_multisite: false,
 *   active_theme: { name: "Twenty Twenty-Four", version: "1.0" },
 *   debug_mode: false,
 *   memory_limit: "256M",
 *   max_upload_size: "64 MB",
 *   server_software: "nginx/1.24.0"
 * }
 *
 * @see includes/abilities/site-health.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the site-health ability with the chat system.
 */
export function registerSiteHealth() {
	registerAbility( 'wp-agentic-admin/site-health', {
		// Descriptive label helps the LLM understand when to use this ability.
		// Including examples in parentheses helps with keyword matching.
		label: 'Check site health (PHP version, WordPress version, server info)',

		// Broad keyword coverage since users ask about health in many ways.
		keywords: [
			'health',
			'version',
			'php',
			'mysql',
			'info',
			'status',
			'server',
			'wordpress version',
			'wp version',
			'memory',
			'memory limit',
			'theme',
			'url',
			'site url',
			'home url',
		],

		initialMessage: 'Let me check that for you...',

		/**
		 * Generate context-aware summary from the result.
		 *
		 * CONTEXT-AWARE RESPONSES:
		 * This summarize function demonstrates checking what the user asked about
		 * and tailoring the response accordingly. If the user asks "what PHP version",
		 * they get just the PHP version - not a full health dump.
		 *
		 * @param {Object} result      - The health data from PHP.
		 * @param {string} userMessage - The user's original message (for context).
		 * @return {string} Markdown-formatted summary tailored to the question.
		 */
		summarize: ( result, userMessage = '' ) => {
			const msg = userMessage.toLowerCase();

			// Check if user asked about something specific and respond accordingly.
			// This creates a more natural conversational experience.

			if ( msg.includes( 'php' ) ) {
				return `Your PHP version is * * ${
					result.php_version || 'Unknown'
				} * * .`;
			}

			if ( msg.includes( 'wordpress' ) || msg.includes( 'wp version' ) ) {
				return `You're running * * WordPress ${
					result.wordpress_version || 'Unknown'
				} * * .`;
			}

			if (
				msg.includes( 'mysql' ) ||
				msg.includes( 'database' ) ||
				msg.includes( 'db version' )
			) {
				return `Your database is * * MySQL ${
					result.mysql_version || 'Unknown'
				} * * .`;
			}

			if (
				msg.includes( 'server' ) ||
				msg.includes( 'nginx' ) ||
				msg.includes( 'apache' )
			) {
				return `Your server is * * ${
					result.server_software || 'Unknown'
				} * * .`;
			}

			if ( msg.includes( 'theme' ) ) {
				// Handle nested object safely with optional chaining.
				return `Your active theme is * * ${
					result.active_theme?.name || 'Unknown'
				} * * (version ${ result.active_theme?.version || '?' }).`;
			}

			if ( msg.includes( 'memory' ) ) {
				return `Your PHP memory limit is * * ${
					result.memory_limit || 'Unknown'
				} * * .`;
			}

			if (
				msg.includes( 'url' ) ||
				msg.includes( 'site address' ) ||
				msg.includes( 'home' )
			) {
				return `Your site URL is * * ${
					result.site_url || result.home_url || 'Unknown'
				} * * .`;
			}

			// No specific question detected - return full health summary.
			// This is the default when user asks something general like "site health".
			return (
				`Here's your site health information:\n\n` +
				` * * WordPress: * * ${
					result.wordpress_version || 'Unknown'
				}\n` +
				` * * PHP: * * ${ result.php_version || 'Unknown' }\n` +
				` * * Database: * * MySQL ${
					result.mysql_version || 'Unknown'
				}\n` +
				` * * Server: * * ${ result.server_software || 'Unknown' }\n` +
				` * * Theme: * * ${ result.active_theme?.name || 'Unknown' } (${
					result.active_theme?.version || '?'
				})\n` +
				` * * Memory Limit: * * ${ result.memory_limit || 'Unknown' }`
			);
		},

		/**
		 * Execute the ability.
		 *
		 * @return {Promise<Object>} Health data from the PHP ability.
		 */
		execute: async () => {
			// No input parameters needed for this ability.
			return executeAbility( 'wp-agentic-admin/site-health', {} );
		},

		// Read-only - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerSiteHealth;
