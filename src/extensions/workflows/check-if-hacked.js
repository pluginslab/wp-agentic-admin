/**
 * Check If Hacked Workflow
 *
 * A read-only security workflow that verifies the integrity of WordPress
 * core files and plugin files by checking their checksums against the
 * official WordPress.org API.
 *
 * Steps:
 * 1. Verify core checksums — checks wp-admin/, wp-includes/, and root wp-* files
 * 2. Verify plugin checksums — checks all installed plugins against WordPress.org
 *
 * @since 0.9.6
 */

/**
 * @typedef {import('../services/workflow-registry').StepResult} StepResult
 */

import { registerWorkflow } from '../services/agentic-abilities-api';

/**
 * Register the "Check If Hacked" workflow.
 */
export function registerCheckIfHackedWorkflow() {
	registerWorkflow( 'wp-agentic-admin/check-if-hacked', {
		label: 'Check If Hacked',
		description:
			'Verifies WordPress core and plugin file integrity by checking checksums against the official WordPress.org API. Detects modified, missing, and extra files.',
		keywords: [
			'hacked',
			'hack',
			'compromised',
			'malware',
			'infected',
			'backdoor',
			'security check',
			'integrity check',
			'verify files',
			'tampered',
			'is my site hacked',
			'website hacked',
			'security scan',
			'file integrity',
		],
		steps: [
			{
				abilityId: 'wp-agentic-admin/verify-core-checksums',
				label: 'Verify WordPress core file checksums',
			},
			{
				abilityId: 'wp-agentic-admin/verify-plugin-checksums',
				label: 'Verify plugin file checksums',
			},
			{
				abilityId: 'wp-agentic-admin/database-check',
				label: 'Scan database for indicators of compromise',
			},
			{
				abilityId: 'wp-agentic-admin/file-scan',
				label: 'Scan theme and plugin PHP files for malware patterns',
			},
			{
				abilityId: 'wp-agentic-admin/role-capabilities-check',
				label: 'Check role capabilities for privilege escalation',
			},
		],

		// Read-only — no confirmation needed.
		requiresConfirmation: false,

		/**
		 * Generate a combined security summary.
		 *
		 * @param {StepResult[]} results - Completed step results.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( results ) => {
			const coreResult = results.find(
				( r ) =>
					r.abilityId === 'wp-agentic-admin/verify-core-checksums'
			);
			const pluginResult = results.find(
				( r ) =>
					r.abilityId ===
					'wp-agentic-admin/verify-plugin-checksums'
			);
			const dbResult = results.find(
				( r ) =>
					r.abilityId === 'wp-agentic-admin/database-check'
			);
			const fileScanResult = results.find(
				( r ) =>
					r.abilityId === 'wp-agentic-admin/file-scan'
			);

			const lines = [];
			let allClear = true;

			// --- Core checksums table ---
			lines.push( '**WordPress Core Files**' );

			if ( coreResult?.success && coreResult.result ) {
				const core = coreResult.result;

				if ( core.success ) {
					lines.push(
						`All ${ core.total_files } files verified for WordPress ${ core.wordpress_version }.`
					);
				} else {
					allClear = false;
					lines.push( '' );
					lines.push( '| File | Status |' );
					lines.push( '|---|---|' );

					for ( const file of core.failed_files || [] ) {
						lines.push(
							`| \`${ file.file }\` | **${ file.status }** |`
						);
					}
				}
			} else {
				lines.push( 'Could not verify. Check internet connection.' );
			}

			lines.push( '' );

			// --- Plugin checksums table ---
			lines.push( '**Plugin Checksums**' );

			if ( pluginResult?.success && pluginResult.result ) {
				const plugins = pluginResult.result;
				const hasIssues = plugins.results?.some(
					( p ) => p.status === 'failed'
				);

				if ( ! hasIssues ) {
					lines.push( plugins.message );
				} else {
					allClear = false;
					lines.push( '' );
					lines.push( '| Plugin | File | Status |' );
					lines.push( '|---|---|---|' );

					for ( const plugin of plugins.results || [] ) {
						if ( plugin.status === 'verified' ) {
							lines.push(
								`| ${ plugin.plugin } | — | Verified |`
							);
						} else if ( plugin.status === 'skipped' ) {
							lines.push(
								`| ${ plugin.plugin } | — | Skipped (no checksums) |`
							);
						} else if ( plugin.status === 'failed' ) {
							const issues = plugin.issues || [];
							for ( const issue of issues.slice(
								0,
								10
							) ) {
								lines.push(
									`| ${ plugin.plugin } | \`${ issue.file }\` | **${ issue.status }** |`
								);
							}
							if ( issues.length > 10 ) {
								lines.push(
									`| ${ plugin.plugin } | ...and ${ issues.length - 10 } more | |`
								);
							}
						}
					}
				}
			} else {
				lines.push( 'Could not verify. Check internet connection.' );
			}

			lines.push( '' );

			// --- Database check table ---
			lines.push( '**Database Scan**' );

			if ( dbResult?.success && dbResult.result ) {
				const db = dbResult.result;

				if ( db.total_issues === 0 ) {
					lines.push( 'No high-risk findings in the database.' );
				} else {
					allClear = false;
					lines.push( '' );
					lines.push( '| Check | Finding | Risk |' );
					lines.push( '|---|---|---|' );

					for ( const check of db.checks || [] ) {
						for ( const f of check.findings.slice( 0, 5 ) ) {
							const detail = formatDbFinding( f );
							const score = f.risk_score
								? `${ f.risk_score }/10`
								: '—';
							lines.push(
								`| ${ check.name } | ${ detail } | ${ score } |`
							);
						}
						if ( check.findings.length > 5 ) {
							lines.push(
								`| ${ check.name } | ...and ${ check.findings.length - 5 } more | — |`
							);
						}
					}
				}
			} else {
				lines.push( 'Could not complete database scan.' );
			}

			lines.push( '' );

			// --- File scan table ---
			lines.push( '**Theme & Plugin File Scan**' );

			if ( fileScanResult?.success && fileScanResult.result ) {
				const fs = fileScanResult.result;

				// Show what was scanned.
				if ( fs.plugins_scanned?.length > 0 ) {
					const names = fs.plugins_scanned
						.map( ( p ) => p.name )
						.join( ', ' );
					lines.push(
						`Plugins (${ fs.plugins_scanned.length }): ${ names }`
					);
				}
				if ( fs.themes_scanned?.length > 0 ) {
					const names = fs.themes_scanned
						.map( ( t ) => t.name )
						.join( ', ' );
					lines.push(
						`Themes (${ fs.themes_scanned.length }): ${ names }`
					);
				}
				if ( fs.mu_plugins_scanned?.length > 0 ) {
					lines.push(
						`MU-Plugins (${ fs.mu_plugins_scanned.length }): ${ fs.mu_plugins_scanned.join( ', ' ) }`
					);
				} else {
					lines.push( 'MU-Plugins: none found' );
				}

				if ( fs.total_hits === 0 ) {
					lines.push(
						`Scanned ${ fs.files_scanned } PHP files. No high-risk patterns detected.`
					);
				} else {
					allClear = false;
					lines.push( '' );
					lines.push( '| File | Pattern | Line | Risk |' );
					lines.push( '|---|---|---|---|' );

					for ( const finding of fs.findings.slice( 0, 15 ) ) {
						for ( const p of finding.patterns ) {
							lines.push(
								`| \`${ finding.file }\` | ${ p.label } | ${ p.line } | ${ p.risk_score }/10 |`
							);
						}
					}
					if ( fs.findings.length > 15 ) {
						lines.push(
							`| ...and ${ fs.findings.length - 15 } more files | | | |`
						);
					}
				}
			} else {
				lines.push( 'Could not complete file scan.' );
			}

			lines.push( '' );

			// --- Role capabilities table ---
			const roleResult = results.find(
				( r ) =>
					r.abilityId ===
					'wp-agentic-admin/role-capabilities-check'
			);

			lines.push( '**Role Capabilities**' );

			if ( roleResult?.success && roleResult.result ) {
				const rc = roleResult.result;

				if (
					rc.total_issues === 0 &&
					( ! rc.extra_roles || rc.extra_roles.length === 0 )
				) {
					lines.push(
						'All default roles match expected capabilities.'
					);
				} else {
					const modified = ( rc.roles || [] ).filter(
						( r ) => r.status === 'modified'
					);

					if ( modified.length > 0 ) {
						allClear = false;
						lines.push( '' );
						lines.push(
							'| Role | Added Capabilities | Removed | Risk |'
						);
						lines.push( '|---|---|---|---|' );

						for ( const role of modified ) {
							const added =
								role.added?.length > 0
									? role.added.join( ', ' )
									: '—';
							const removed =
								role.removed?.length > 0
									? role.removed.join( ', ' )
									: '—';
							lines.push(
								`| ${ role.role_name } | ${ added } | ${ removed } | ${ role.risk_score }/10 |`
							);
						}
					}

					if ( rc.extra_roles?.length > 0 ) {
						const dangerous = rc.extra_roles.filter(
							( r ) => r.has_admin
						);
						if ( dangerous.length > 0 ) {
							allClear = false;
							lines.push( '' );
							lines.push(
								`Non-default roles with admin access: ${ dangerous.map( ( r ) => `**${ r.role_name }**` ).join( ', ' ) }`
							);
						}
					}
				}
			} else {
				lines.push( 'Could not check role capabilities.' );
			}

			lines.push( '' );

			// --- Verdict ---
			if ( allClear ) {
				lines.push(
					'**Result:** No signs of tampering detected. Checksums verified, database clean, no malware patterns in files, roles intact.'
				);
			} else {
				lines.push(
					'**Result: Potential tampering detected.** Review the findings above. If unexpected, your site may be compromised.'
				);
			}

			return lines.join( '\n' );
		},
	} );
}

/**
 * Format a single database finding for display.
 *
 * @param {Object} f - A finding object.
 * @return {string} Formatted string.
 */
function formatDbFinding( f ) {
	if ( f.option_name ) {
		const preview = f.preview
			? ': ' + ( f.preview.length > 80 ? f.preview.substring( 0, 80 ) + '...' : f.preview )
			: '';
		return `\`${ f.option_name }\`${ preview }`;
	}
	if ( f.post_id && f.title ) {
		return `Post #${ f.post_id } "${ f.title }" (${ f.post_type || 'post' }${ f.status ? ', ' + f.status : '' })`;
	}
	if ( f.user_id && f.meta_key ) {
		return `User #${ f.user_id } meta \`${ f.meta_key }\``;
	}
	if ( f.login ) {
		return `${ f.login } (${ f.email }) — registered ${ f.registered }`;
	}
	if ( f.hook ) {
		return `\`${ f.hook }\` next run: ${ f.next_run }`;
	}
	if ( f.comment_id ) {
		return `Comment #${ f.comment_id } on post #${ f.post_id } by "${ f.author }"`;
	}
	if ( f.issue ) {
		return f.issue;
	}
	return JSON.stringify( f );
}

export default registerCheckIfHackedWorkflow;
