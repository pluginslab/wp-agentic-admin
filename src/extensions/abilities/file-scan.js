/**
 * File Scan Ability
 *
 * Scans PHP files in themes and plugins for common malware patterns:
 * obfuscation, shell execution, backdoors, and injected code.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Scanned 1234 PHP files...",
 *   files_scanned: 1234,
 *   total_hits: 3,
 *   filtered_out: 12,
 *   risk_threshold: 6.0,
 *   findings: [
 *     {
 *       file: "plugins/bad-plugin/evil.php",
 *       patterns: [{ id: "eval_base64", label: "eval(base64_decode(...))", risk_score: 9.5, line: 42 }],
 *       risk_score: 9.5
 *     }
 *   ]
 * }
 *
 * @see includes/abilities/security/file-scan.php
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the file-scan ability with the chat system.
 */
export function registerFileScan() {
	registerAbility( 'wp-agentic-admin/file-scan', {
		label: 'Scan theme and plugin files for malware patterns',
		description:
			'Scan PHP files in themes and plugins for obfuscation (eval+base64, gzinflate, str_rot13), shell execution, backdoors, and injected code.',

		keywords: [
			'file scan',
			'malware scan',
			'scan files',
			'obfuscated',
			'backdoor',
			'shell',
			'infected files',
			'scan themes',
			'scan plugins',
			'php malware',
		],

		initialMessage: 'Scanning PHP files for malware patterns...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to complete file scan.';
			}

			const lines = [ result.message, '' ];

			// Show what was scanned.
			if ( result.plugins_scanned?.length > 0 ) {
				const names = result.plugins_scanned
					.map( ( p ) => p.name )
					.join( ', ' );
				lines.push(
					`**Plugins scanned** (${ result.plugins_scanned.length }): ${ names }`
				);
			}
			if ( result.themes_scanned?.length > 0 ) {
				const names = result.themes_scanned
					.map( ( t ) => t.name )
					.join( ', ' );
				lines.push(
					`**Themes scanned** (${ result.themes_scanned.length }): ${ names }`
				);
			}
			if ( result.mu_plugins_scanned?.length > 0 ) {
				lines.push(
					`**MU-Plugins scanned** (${
						result.mu_plugins_scanned.length
					}): ${ result.mu_plugins_scanned.join( ', ' ) }`
				);
			} else {
				lines.push( '**MU-Plugins scanned:** none found' );
			}

			// Show findings as a table.
			if ( result.findings && result.findings.length > 0 ) {
				lines.push( '' );
				lines.push( '| File | Pattern | Line | Risk |' );
				lines.push( '|---|---|---|---|' );

				for ( const finding of result.findings ) {
					for ( const p of finding.patterns ) {
						lines.push(
							`| \`${ finding.file }\` | ${ p.label } | ${ p.line } | ${ p.risk_score }/10 |`
						);
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
				return 'File scan could not be completed.';
			}

			if ( result.total_hits === 0 ) {
				return `Scanned ${ result.files_scanned } PHP files in themes and plugins. No high-risk malware patterns detected.`;
			}

			const files = result.findings
				.map(
					( f ) =>
						`${ f.file } (${ f.patterns
							.map( ( p ) => p.label )
							.join( ', ' ) })`
				)
				.join( '; ' );

			return `Scanned ${ result.files_scanned } PHP files. Found ${ result.total_hits } file(s) with suspicious patterns: ${ files }.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The result from the PHP ability.
		 */
		execute: async ( params ) => {
			const input = {};

			if ( typeof params.scan_plugins === 'boolean' ) {
				input.scan_plugins = params.scan_plugins;
			}
			if ( typeof params.scan_themes === 'boolean' ) {
				input.scan_themes = params.scan_themes;
			}

			return executeAbility( 'wp-agentic-admin/file-scan', input );
		},

		// Read-only — no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerFileScan;
