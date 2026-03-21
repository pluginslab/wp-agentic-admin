/**
 * Verify Plugin Checksums Ability
 *
 * Verifies installed plugin file checksums against the WordPress.org API.
 * Plugins not hosted on WordPress.org are counted and skipped.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true/false,
 *   message: "Checked 12 plugins: ...",
 *   total_plugins: 12,
 *   verified_count: 8,
 *   failed_count: 1,
 *   skipped_count: 3,
 *   results: [
 *     { plugin: "Akismet", slug: "akismet", status: "verified", detail: "..." },
 *     { plugin: "My Premium Plugin", slug: "premium", status: "skipped", detail: "..." },
 *     { plugin: "WooCommerce", slug: "woocommerce", status: "failed", issues: [...] }
 *   ]
 * }
 *
 * @see includes/abilities/security/verify-plugin-checksums.php
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the verify-plugin-checksums ability with the chat system.
 */
export function registerVerifyPluginChecksums() {
	registerAbility( 'wp-agentic-admin/verify-plugin-checksums', {
		label: 'Verify plugin file checksums',
		description:
			'Verify installed plugin file integrity by comparing checksums against the WordPress.org API. Detects modified, missing, and extra files in plugin directories.',

		keywords: [
			'plugin checksum',
			'verify plugin',
			'plugin integrity',
			'plugin hacked',
			'plugin modified',
			'plugin security',
			'plugin malware',
			'plugin tampered',
		],

		initialMessage: 'Verifying plugin file checksums...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to verify plugin checksums.';
			}

			const lines = [ result.message, '' ];

			if ( result.results ) {
				for ( const plugin of result.results ) {
					if ( plugin.status === 'verified' ) {
						lines.push( `**${ plugin.plugin }** — verified` );
					} else if ( plugin.status === 'skipped' ) {
						lines.push(
							`**${ plugin.plugin }** — skipped (no checksums)`
						);
					} else if ( plugin.status === 'failed' ) {
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
							`**${ plugin.plugin }** — FAILED (${ parts.join(
								', '
							) })`
						);

						for ( const issue of issues ) {
							lines.push(
								`  - \`${ issue.file }\` (${ issue.status })`
							);
							if ( issue.diff ) {
								lines.push( '```diff' );
								const diffLines = issue.diff.split( '\n' );
								if ( diffLines.length > 30 ) {
									lines.push(
										diffLines.slice( 0, 30 ).join( '\n' )
									);
									lines.push(
										`... (${
											diffLines.length - 30
										} more lines)`
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
				return 'Plugin checksum verification could not be completed.';
			}

			const parts = [];
			parts.push(
				`Checked ${ result.total_plugins } plugins: ${ result.verified_count } verified, ${ result.failed_count } failed, ${ result.skipped_count } skipped`
			);

			if ( result.results ) {
				const failedPlugins = result.results.filter(
					( r ) => r.status === 'failed'
				);
				for ( const plugin of failedPlugins ) {
					const files = ( plugin.issues || [] )
						.map( ( i ) => `${ i.file } (${ i.status })` )
						.join( ', ' );
					parts.push(
						`${ plugin.plugin } (${ plugin.slug }): ${ files }`
					);
				}
			}

			return parts.join( '. ' ) + '.';
		},

		/**
		 * Execute the ability.
		 *
		 * @param  params
		 * @return {Promise<Object>} The result from the PHP ability.
		 */
		execute: async ( params ) => {
			const input = {};

			if ( typeof params.include_diffs === 'boolean' ) {
				input.include_diffs = params.include_diffs;
			}

			return executeAbility(
				'wp-agentic-admin/verify-plugin-checksums',
				input
			);
		},

		// Read-only - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerVerifyPluginChecksums;
