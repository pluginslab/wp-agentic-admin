/**
 * Security Scan Ability
 *
 * Runs basic WordPress security checks.
 *
 * @see includes/abilities/security-scan.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the security-scan ability with the chat system.
 */
export function registerSecurityScan() {
	registerAbility( 'wp-agentic-admin/security-scan', {
		label: 'Run basic security scan',
		description:
			'Run basic WordPress security checks including debug mode, file permissions, salts, and version exposure. Use for security audits.',

		keywords: [
			'security',
			'secure',
			'scan',
			'vulnerability',
			'hardening',
			'permissions',
		],

		initialMessage: "I'll run a basic security scan...",

		summarize: ( result ) => {
			const { checks, summary } = result;

			let text = `**Security Scan Results:** ${ summary.passed } passed, ${ summary.failed } failed\n\n`;

			const failed = checks.filter( ( c ) => c.status === 'fail' );
			const passed = checks.filter( ( c ) => c.status === 'pass' );

			// Group failures by severity.
			const severities = [ 'critical', 'warning', 'info' ];
			severities.forEach( ( sev ) => {
				const items = failed.filter( ( c ) => c.severity === sev );
				if ( items.length === 0 ) {
					return;
				}
				const label = sev.charAt( 0 ).toUpperCase() + sev.slice( 1 );
				text += `**${ label }:**\n`;
				items.forEach( ( c ) => {
					text += `- ${ c.check }: ${ c.message }\n`;
				} );
				text += '\n';
			} );

			if ( passed.length > 0 ) {
				text += '**Passed:**\n';
				passed.forEach( ( c ) => {
					text += `- ${ c.check }: ${ c.message }\n`;
				} );
			}

			return text;
		},

		interpretResult: ( result ) => {
			const { checks, summary } = result;
			if ( summary.failed === 0 ) {
				return 'All security checks passed. No issues found.';
			}
			const parts = [];
			if ( summary.critical > 0 ) {
				parts.push( `${ summary.critical } critical` );
			}
			if ( summary.warning > 0 ) {
				parts.push( `${ summary.warning } warning(s)` );
			}
			if ( summary.info > 0 ) {
				parts.push( `${ summary.info } info` );
			}
			let text = `${ summary.failed } security issues: ${ parts.join(
				', '
			) }. `;
			checks
				.filter( ( c ) => c.status === 'fail' )
				.forEach( ( c ) => {
					text += `${ c.check } (${ c.severity }): ${ c.message } `;
				} );
			return text.trim();
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/security-scan', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerSecurityScan;
