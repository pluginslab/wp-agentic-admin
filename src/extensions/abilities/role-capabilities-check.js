/**
 * Role Capabilities Check Ability
 *
 * Compares site role capabilities against WordPress defaults
 * to detect privilege escalation or tampering.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Role capabilities check: ...",
 *   total_issues: 1,
 *   roles: [
 *     { role: "subscriber", role_name: "Subscriber", status: "modified", added: ["manage_options"], removed: [], risk_score: 9.0 },
 *     { role: "editor", role_name: "Editor", status: "default", added: [], removed: [] }
 *   ],
 *   extra_roles: [
 *     { role: "shop_manager", role_name: "Shop Manager", capabilities: [...], cap_count: 42, has_admin: false, risk_score: 3.0 }
 *   ]
 * }
 *
 * @see includes/abilities/security/role-capabilities-check.php
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the role-capabilities-check ability with the chat system.
 */
export function registerRoleCapabilitiesCheck() {
	registerAbility( 'wp-agentic-admin/role-capabilities-check', {
		label: 'Check role capabilities against WordPress defaults',
		description:
			'Compare site role capabilities against WordPress defaults to detect privilege escalation, modified roles, or suspicious non-default roles.',

		keywords: [
			'role',
			'roles',
			'capabilities',
			'permissions',
			'privilege',
			'escalation',
			'user role',
			'subscriber',
			'editor',
			'admin capabilities',
		],

		initialMessage:
			'Comparing role capabilities against WordPress defaults...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result || typeof result !== 'object' ) {
				return 'Unable to check role capabilities.';
			}

			const lines = [ result.message, '' ];

			// Default roles table.
			if ( result.roles?.length > 0 ) {
				lines.push( '**Default Roles**' );
				lines.push( '' );
				lines.push( '| Role | Status | Added | Removed | Risk |' );
				lines.push( '|---|---|---|---|---|' );

				for ( const role of result.roles ) {
					const added =
						role.added?.length > 0 ? role.added.join( ', ' ) : '—';
					const removed =
						role.removed?.length > 0
							? role.removed.join( ', ' )
							: '—';
					const risk = role.risk_score
						? `${ role.risk_score }/10`
						: '—';
					const status =
						role.status === 'default'
							? 'Default'
							: `**${ role.status }**`;

					lines.push(
						`| ${ role.role_name } | ${ status } | ${ added } | ${ removed } | ${ risk } |`
					);
				}
			}

			// Extra roles table.
			if ( result.extra_roles?.length > 0 ) {
				lines.push( '' );
				lines.push( '**Non-Default Roles**' );
				lines.push( '' );
				lines.push( '| Role | Capabilities | Admin Access | Risk |' );
				lines.push( '|---|---|---|---|' );

				for ( const role of result.extra_roles ) {
					const admin = role.has_admin ? '**Yes**' : 'No';
					const risk = role.risk_score
						? `${ role.risk_score }/10`
						: '—';

					lines.push(
						`| ${ role.role_name } | ${ role.cap_count } | ${ admin } | ${ risk } |`
					);
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
				return 'Role capabilities check could not be completed.';
			}

			const parts = [ result.message ];

			const modified = ( result.roles || [] ).filter(
				( r ) => r.status === 'modified'
			);
			for ( const role of modified ) {
				if ( role.added?.length > 0 ) {
					parts.push(
						`${ role.role_name } gained: ${ role.added.join(
							', '
						) }`
					);
				}
				if ( role.removed?.length > 0 ) {
					parts.push(
						`${ role.role_name } lost: ${ role.removed.join(
							', '
						) }`
					);
				}
			}

			const dangerousExtras = ( result.extra_roles || [] ).filter(
				( r ) => r.has_admin
			);
			if ( dangerousExtras.length > 0 ) {
				parts.push(
					`Non-default roles with admin access: ${ dangerousExtras
						.map( ( r ) => r.role_name )
						.join( ', ' ) }`
				);
			}

			return parts.join( '. ' ) + '.';
		},

		/**
		 * Execute the ability.
		 *
		 * @return {Promise<Object>} The result from the PHP ability.
		 */
		execute: async () => {
			return executeAbility(
				'wp-agentic-admin/role-capabilities-check',
				{}
			);
		},

		// Read-only — no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerRoleCapabilitiesCheck;
