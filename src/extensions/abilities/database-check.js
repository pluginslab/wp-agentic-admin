/**
 * Database Security Check Ability
 *
 * Scans the WordPress database for indicators of compromise:
 * injected scripts, base64 payloads, eval() calls, rogue cron jobs,
 * suspicious admin accounts, SEO spam, and more.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Database scan complete. Found 3 suspicious findings...",
 *   total_issues: 3,
 *   checks: [
 *     { name: "Options: base64_decode", description: "...", count: 1, findings: [...] },
 *     { name: "Posts: injected scripts", description: "...", count: 0, findings: [] },
 *     ...
 *   ]
 * }
 *
 * @see includes/abilities/security/database-check.php
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the database-check ability with the chat system.
 */
export function registerDatabaseCheck() {
	registerAbility( 'wp-agentic-admin/database-check', {
		label: 'Database security scan',
		description:
			'Scan the WordPress database for indicators of compromise: injected scripts, base64 payloads, eval() calls, rogue cron jobs, suspicious admin accounts, and SEO spam.',

		keywords: [
			'database check',
			'db security',
			'scan database',
			'malware database',
			'injected code',
			'base64',
			'eval',
			'spam pages',
			'rogue cron',
			'suspicious users',
			'database malware',
			'sql injection',
		],

		initialMessage: 'Scanning the database for indicators of compromise...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to complete database security scan.';
			}

			const lines = [ result.message, '' ];

			if ( result.checks ) {
				for ( const check of result.checks ) {
					if ( check.count === 0 ) {
						lines.push( `**${ check.name }** — clean` );
						continue;
					}

					lines.push(
						`**${ check.name }** — ${ check.count } finding(s)`
					);
					lines.push( `*${ check.description }*` );

					for ( const finding of check.findings.slice( 0, 5 ) ) {
						const detail = formatFinding( finding );
						const score = finding.risk_score
							? ` [risk: ${ finding.risk_score }/10]`
							: '';
						lines.push( `  - ${ detail }${ score }` );
					}

					if ( check.findings.length > 5 ) {
						lines.push(
							`  - ...and ${ check.findings.length - 5 } more`
						);
					}

					lines.push( '' );
				}
			}

			return lines.join( '\n' );
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Database security scan could not be completed.';
			}

			if ( result.total_issues === 0 ) {
				return 'Database security scan found no suspicious findings across all checks.';
			}

			const issues = ( result.checks || [] )
				.filter( ( c ) => c.count > 0 )
				.map( ( c ) => `${ c.name }: ${ c.count } finding(s)` );

			return `Database scan found ${
				result.total_issues
			} suspicious finding(s): ${ issues.join( '; ' ) }.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @return {Promise<Object>} The result from the PHP ability.
		 */
		execute: async () => {
			return executeAbility( 'wp-agentic-admin/database-check', {} );
		},

		// Read-only — no confirmation needed.
		requiresConfirmation: false,
	} );
}

/**
 * Format a single finding for display.
 *
 * @param {Object} finding - A finding object from the check results.
 * @return {string} Formatted string.
 */
function formatFinding( finding ) {
	// Options-based findings.
	if ( finding.option_name ) {
		return `\`${ finding.option_name }\`${
			finding.preview ? ': ' + truncate( finding.preview, 80 ) : ''
		}`;
	}

	// Post-based findings.
	if ( finding.post_id ) {
		return `Post #${ finding.post_id } "${ finding.title }" (${
			finding.post_type
		}${ finding.status ? ', ' + finding.status : '' })`;
	}

	// User meta findings.
	if ( finding.user_id && finding.meta_key ) {
		return `User #${ finding.user_id } meta \`${ finding.meta_key }\``;
	}

	// Admin account findings.
	if ( finding.login ) {
		const flags = ( finding.flags || [] ).join( ', ' );
		return `${ finding.login } (${ finding.email }) — ${ flags }`;
	}

	// Cron findings.
	if ( finding.hook ) {
		const flags = ( finding.flags || [] ).join( ', ' );
		return `\`${ finding.hook }\` next run: ${ finding.next_run } — ${ flags }`;
	}

	// Comment findings.
	if ( finding.comment_id ) {
		return `Comment #${ finding.comment_id } on post #${ finding.post_id } by "${ finding.author }"`;
	}

	// Site URL findings.
	if ( finding.issue ) {
		return finding.issue;
	}

	return JSON.stringify( finding );
}

/**
 * Truncate a string to a maximum length.
 *
 * @param {string} str    - The string to truncate.
 * @param {number} maxLen - Maximum length.
 * @return {string} Truncated string.
 */
function truncate( str, maxLen ) {
	if ( ! str || str.length <= maxLen ) {
		return str || '';
	}
	return str.substring( 0, maxLen ) + '...';
}

export default registerDatabaseCheck;
