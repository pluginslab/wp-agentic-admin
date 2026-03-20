/**
 * User List Ability
 *
 * Lists all WordPress users with their roles.
 *
 * @see includes/abilities/user-list.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the user-list ability with the chat system.
 */
export function registerUserList() {
	registerAbility( 'wp-agentic-admin/user-list', {
		label: 'List WordPress users',
		description:
			'List all WordPress users with their roles, registration dates, and masked emails. Use for questions about site users or user counts.',

		keywords: [
			'user',
			'users',
			'members',
			'accounts',
			'admins',
			'authors',
		],

		initialMessage: "I'll check your WordPress users...",

		summarize: ( result ) => {
			const { users, total } = result;

			const byRole = {};
			users.forEach( ( u ) => {
				const role = u.role || 'none';
				byRole[ role ] = ( byRole[ role ] || 0 ) + 1;
			} );

			let summary = `I found ${ total } user${
				total !== 1 ? 's' : ''
			} on your site.\n\n`;

			const roleList = Object.entries( byRole )
				.map( ( [ role, count ] ) => `${ role }: ${ count }` )
				.join( ', ' );
			summary += `**By role:** ${ roleList }\n\n`;

			users.forEach( ( u ) => {
				summary += `- **${ u.display_name }** (${ u.username }) — ${ u.role }\n`;
			} );

			return summary;
		},

		interpretResult: ( result ) => {
			const { users, total } = result;
			if ( ! users || users.length === 0 ) {
				return 'No users found on this site.';
			}
			const names = users.map(
				( u ) => `${ u.display_name } (${ u.role })`
			);
			return `Found ${ total } users: ${ names.join( ', ' ) }.`;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/user-list', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerUserList;
