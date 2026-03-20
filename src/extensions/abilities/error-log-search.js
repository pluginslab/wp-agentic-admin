/**
 * Error Log Search Ability
 *
 * Filters debug.log by keyword and severity.
 *
 * @see includes/abilities/error-log-search.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the error-log-search ability with the chat system.
 */
export function registerErrorLogSearch() {
	registerAbility( 'wp-agentic-admin/error-log-search', {
		label: 'Search and filter error log',
		description:
			'Search debug.log by keyword or severity level (fatal, warning, notice, deprecated). Use when users want to filter or search error logs.',

		keywords: [ 'search', 'filter', 'error', 'fatal', 'warning', 'log' ],

		initialMessage: "I'll search the error log...",

		parseIntent: ( message ) => {
			const lower = message.toLowerCase();
			const params = {};

			// Detect severity level.
			if ( lower.includes( 'fatal' ) ) {
				params.level = 'fatal';
			} else if ( lower.includes( 'warning' ) ) {
				params.level = 'warning';
			} else if ( lower.includes( 'notice' ) ) {
				params.level = 'notice';
			} else if ( lower.includes( 'deprecated' ) ) {
				params.level = 'deprecated';
			}

			// Extract keyword — look for quoted strings or "for X" pattern.
			const quoted = message.match( /['"]([^'"]+)['"]/ );
			if ( quoted ) {
				params.keyword = quoted[ 1 ];
			} else {
				const forMatch = lower.match(
					/(?:search|filter|find|look)\s+(?:for|errors?)\s+(.+?)(?:\s+in|\s+error|$)/i
				);
				if ( forMatch ) {
					params.keyword = forMatch[ 1 ].trim();
				}
			}

			return params;
		},

		summarize: ( result ) => {
			const { matches, total, scanned } = result;

			if ( result.message ) {
				return result.message;
			}

			if ( total === 0 ) {
				return `No matches found in the last ${ scanned } log lines.`;
			}

			let summary = `Found **${ total }** matching entries (scanned ${ scanned } lines):\n\n`;
			summary += '```\n';
			matches.slice( -20 ).forEach( ( line ) => {
				summary += line + '\n';
			} );
			summary += '```';

			if ( total > 20 ) {
				summary += `\n\n_Showing last 20 of ${ total } matches._`;
			}

			return summary;
		},

		interpretResult: ( result ) => {
			if ( result.message ) {
				return result.message;
			}
			const { matches, total, scanned } = result;
			if ( ! matches || total === 0 ) {
				return `No matches found in ${ scanned } log lines scanned.`;
			}
			// Include actual entries so the LLM can present them.
			const shown = matches.slice( -10 );
			let text = `Found ${ total } matching entries (scanned ${ scanned } lines):\n`;
			shown.forEach( ( line ) => {
				text += `${ line }\n`;
			} );
			if ( total > 10 ) {
				text += `(${ total - 10 } more entries not shown)`;
			}
			return text;
		},

		execute: async ( params ) => {
			// ReAct agent passes { userMessage, ...llmArgs }.
			// Small LLMs often send empty args, so fall back to parseIntent.
			let keyword = params.keyword;
			let level = params.level;

			if ( ! keyword && ! level && params.userMessage ) {
				const lower = params.userMessage.toLowerCase();
				if ( lower.includes( 'fatal' ) ) {
					level = 'fatal';
				} else if ( lower.includes( 'warning' ) ) {
					level = 'warning';
				} else if ( lower.includes( 'notice' ) ) {
					level = 'notice';
				} else if ( lower.includes( 'deprecated' ) ) {
					level = 'deprecated';
				}
				const quoted = params.userMessage.match( /['"]([^'"]+)['"]/ );
				if ( quoted ) {
					keyword = quoted[ 1 ];
				}
			}

			const input = {};
			if ( keyword ) {
				input.keyword = keyword;
			}
			if ( level ) {
				input.level = level;
			}
			return executeAbility( 'wp-agentic-admin/error-log-search', input );
		},

		requiresConfirmation: false,
	} );
}

export default registerErrorLogSearch;
