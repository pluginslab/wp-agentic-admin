/**
 * Verify Checksums Ability
 *
 * Verifies WordPress core file checksums against the official API,
 * reports modified, missing, and extra files with optional diffs.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true/false,
 *   message: "Checksum verification found ...",
 *   wordpress_version: "6.9",
 *   total_files: 1234,
 *   failed_count: 2,
 *   missing_count: 0,
 *   extra_count: 1,
 *   failed_files: [
 *     { file: "wp-includes/version.php", status: "modified", expected_md5: "...", actual_md5: "...", diff: "..." },
 *     { file: "wp-includes/backdoor.php", status: "extra", detail: "..." },
 *     { file: "wp-admin/maint/repair.php", status: "missing", detail: "..." }
 *   ]
 * }
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @see includes/abilities/security/verify-checksum.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the verify-core-checksums ability with the chat system.
 */
export function registerVerifyCoreChecksums() {
	registerAbility( 'wp-agentic-admin/verify-core-checksums', {
		label: 'Verify core file checksums',
		description:
			'Verify WordPress core file integrity by comparing checksums against the official WordPress.org API. Detects modified, missing, and extra files in core directories.',

		keywords: [
			'checksum',
			'verify',
			'integrity',
			'hacked',
			'compromised',
			'modified',
			'core',
			'security',
			'malware',
			'tampered',
			'changed files',
			'hack',
			'infected',
			'backdoor',
		],

		initialMessage: 'Verifying WordPress core file checksums...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to verify checksums.';
			}

			if ( ! result.success && result.failed_count === 0 ) {
				return result.message || 'Checksum verification failed.';
			}

			const lines = [];
			lines.push( result.message );

			if ( result.failed_files && result.failed_files.length > 0 ) {
				lines.push( '' );

				for ( const file of result.failed_files ) {
					if ( file.status === 'modified' ) {
						lines.push( `**Modified:** \`${ file.file }\`` );
						if ( file.diff ) {
							lines.push( '```diff' );
							// Truncate long diffs for readability.
							const diffLines = file.diff.split( '\n' );
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
								lines.push( file.diff );
							}
							lines.push( '```' );
						}
					} else if ( file.status === 'missing' ) {
						lines.push( `**Missing:** \`${ file.file }\`` );
					} else if ( file.status === 'extra' ) {
						lines.push( `**Extra (unknown):** \`${ file.file }\`` );
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
				return 'Checksum verification could not be completed.';
			}

			if ( result.success ) {
				return `All ${ result.total_files } WordPress core files passed checksum verification for WordPress ${ result.wordpress_version }. No modified, missing, or extra files detected.`;
			}

			const parts = [];
			const modified =
				result.failed_count -
				result.missing_count -
				( result.extra_count || 0 );

			if ( modified > 0 ) {
				const modifiedFiles = result.failed_files
					.filter( ( f ) => f.status === 'modified' )
					.map( ( f ) => f.file );
				parts.push(
					`${ modified } modified file(s): ${ modifiedFiles.join(
						', '
					) }`
				);
			}

			if ( result.missing_count > 0 ) {
				const missingFiles = result.failed_files
					.filter( ( f ) => f.status === 'missing' )
					.map( ( f ) => f.file );
				parts.push(
					`${
						result.missing_count
					} missing file(s): ${ missingFiles.join( ', ' ) }`
				);
			}

			if ( result.extra_count > 0 ) {
				const extraFiles = result.failed_files
					.filter( ( f ) => f.status === 'extra' )
					.map( ( f ) => f.file );
				parts.push(
					`${
						result.extra_count
					} extra unknown file(s): ${ extraFiles.join( ', ' ) }`
				);
			}

			return `Checksum verification for WordPress ${
				result.wordpress_version
			} found issues: ${ parts.join( '; ' ) }.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters from the chat system.
		 * @return {Promise<Object>} The result from the PHP ability.
		 */
		execute: async ( params ) => {
			const input = {};

			if ( typeof params.include_diffs === 'boolean' ) {
				input.include_diffs = params.include_diffs;
			}

			return executeAbility(
				'wp-agentic-admin/verify-core-checksums',
				input
			);
		},

		// Read-only - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerVerifyCoreChecksums;
