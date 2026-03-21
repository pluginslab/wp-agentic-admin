/**
 * Current User Role Ability
 *
 * Returns the current logged-in user's role and account info.
 *
 * @see includes/abilities/current-user-role.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the current-user-role ability with the chat system.
 */
export function registerCurrentUserRole() {
	registerAbility( 'wp-agentic-admin/current-user-role', {
		label: 'Get current user role',
		description:
			'Check the role, username, email, and permissions of the current logged-in user. Use when users ask about their own role, who they are logged in as, or whether they are an administrator.',

		keywords: [
			'role',
			'my role',
			'user role',
			'current user',
			'who am i',
			'my account',
			'my permissions',
			'logged in',
			'admin',
			'administrator',
		],

		initialMessage: 'Checking your user account...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result.success ) {
				return result.message || 'Could not retrieve user info.';
			}
			const roles = result.roles?.join( ', ' ) || 'none';
			return `${ result.display_name } (${ result.username }) — Role: ${ roles }`;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result.success ) {
				return `Could not retrieve user info: ${
					result.message || 'unknown error'
				}.`;
			}
			const roles = result.roles?.join( ', ' ) || 'none';
			return `You are logged in as ${ result.display_name } (username: ${ result.username }, email: ${ result.email }) with the ${ roles } role(s). You have ${ result.capabilities_count } capabilities.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @return {Promise<Object>} The result from PHP.
		 */
		execute: async () => {
			return executeAbility( 'wp-agentic-admin/current-user-role', {} );
		},

		// Read-only operation — no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerCurrentUserRole;
