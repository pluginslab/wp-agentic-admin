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

			const lines = [ '## Security Integrity Check\n' ];
			let allClear = true;

			// Core checksums results.
			lines.push( '### WordPress Core Files' );
			if ( coreResult?.success && coreResult.result ) {
				const core = coreResult.result;

				if ( core.success ) {
					lines.push(
						`All ${ core.total_files } core files verified for WordPress ${ core.wordpress_version }.`
					);
				} else {
					allClear = false;
					lines.push( core.message );

					if ( core.failed_files ) {
						for ( const file of core.failed_files ) {
							if ( file.status === 'modified' ) {
								lines.push(
									`- **Modified:** \`${ file.file }\``
								);
								if ( file.diff ) {
									lines.push( '```diff' );
									const diffLines =
										file.diff.split( '\n' );
									if ( diffLines.length > 20 ) {
										lines.push(
											diffLines
												.slice( 0, 20 )
												.join( '\n' )
										);
										lines.push(
											`... (${ diffLines.length - 20 } more lines)`
										);
									} else {
										lines.push( file.diff );
									}
									lines.push( '```' );
								}
							} else if ( file.status === 'missing' ) {
								lines.push(
									`- **Missing:** \`${ file.file }\``
								);
							} else if ( file.status === 'extra' ) {
								lines.push(
									`- **Extra (suspicious):** \`${ file.file }\``
								);
							}
						}
					}
				}
			} else {
				lines.push(
					'Could not verify core checksums. Check your internet connection.'
				);
			}

			lines.push( '' );

			// Plugin checksums results.
			lines.push( '### Plugins' );
			if ( pluginResult?.success && pluginResult.result ) {
				const plugins = pluginResult.result;
				lines.push( plugins.message );

				if ( plugins.results ) {
					for ( const plugin of plugins.results ) {
						if ( plugin.status === 'failed' ) {
							allClear = false;
							const issues = plugin.issues || [];
							const modified = issues.filter(
								( i ) => i.status === 'modified'
							).length;
							const missing = issues.filter(
								( i ) => i.status === 'missing'
							).length;
							const extra = issues.filter(
								( i ) => i.status === 'extra'
							).length;

							const parts = [];
							if ( modified > 0 ) {
								parts.push( `${ modified } modified` );
							}
							if ( missing > 0 ) {
								parts.push( `${ missing } missing` );
							}
							if ( extra > 0 ) {
								parts.push( `${ extra } extra` );
							}

							lines.push(
								`- **${ plugin.plugin }** — FAILED (${ parts.join( ', ' ) })`
							);

							for ( const issue of issues ) {
								lines.push(
									`  - \`${ issue.file }\` (${ issue.status })`
								);
								if ( issue.diff ) {
									lines.push( '```diff' );
									const diffLines =
										issue.diff.split( '\n' );
									if ( diffLines.length > 20 ) {
										lines.push(
											diffLines
												.slice( 0, 20 )
												.join( '\n' )
										);
										lines.push(
											`... (${ diffLines.length - 20 } more lines)`
										);
									} else {
										lines.push( issue.diff );
									}
									lines.push( '```' );
								}
							}
						}
					}
				}
			} else {
				lines.push(
					'Could not verify plugin checksums. Check your internet connection.'
				);
			}

			lines.push( '' );

			// Overall verdict.
			if ( allClear ) {
				lines.push(
					'### Result\nNo signs of tampering detected. All verifiable files match their official checksums.'
				);
			} else {
				lines.push(
					'### Result\n**Potential tampering detected.** Review the modified and extra files above. If unexpected, your site may be compromised.'
				);
			}

			return lines.join( '\n' );
		},
	} );
}

export default registerCheckIfHackedWorkflow;
