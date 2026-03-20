/**
 * Theme List Ability
 *
 * Lists all installed WordPress themes with their status.
 *
 * @see includes/abilities/theme-list.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the theme-list ability with the chat system.
 */
export function registerThemeList() {
	registerAbility( 'wp-agentic-admin/theme-list', {
		label: 'List installed themes',
		description:
			'List all installed WordPress themes with their active/inactive status and version. Use for questions about installed themes or which theme is active.',

		keywords: [ 'theme', 'themes', 'template', 'templates', 'appearance' ],

		initialMessage: "I'll check your installed themes...",

		summarize: ( result ) => {
			const { themes, total } = result;

			const activeTheme = themes.find( ( t ) => t.active );
			const inactiveThemes = themes
				.filter( ( t ) => ! t.active )
				.map( ( t ) => t.name );

			let summary = `I found ${ total } theme${
				total !== 1 ? 's' : ''
			} installed.\n\n`;

			if ( activeTheme ) {
				summary += `**Active theme:** ${ activeTheme.name } (v${ activeTheme.version })`;
				if ( activeTheme.parent ) {
					summary += ` — child of ${ activeTheme.parent }`;
				}
				summary += '\n\n';
			}

			if ( inactiveThemes.length > 0 ) {
				summary += `**Inactive themes:** ${ inactiveThemes.join(
					', '
				) }`;
			}

			return summary;
		},

		interpretResult: ( result ) => {
			const { themes, total } = result;
			if ( ! themes || themes.length === 0 ) {
				return 'No themes are installed on this site.';
			}
			const activeTheme = themes.find( ( t ) => t.active );
			const inactiveNames = themes
				.filter( ( t ) => ! t.active )
				.map( ( t ) => t.name );
			let text = `Found ${ total } theme${
				total !== 1 ? 's' : ''
			} installed.`;
			if ( activeTheme ) {
				text += ` Active: ${ activeTheme.name } (v${ activeTheme.version }).`;
			}
			if ( inactiveNames.length > 0 ) {
				text += ` Inactive: ${ inactiveNames.join( ', ' ) }.`;
			}
			return text;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/theme-list', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerThemeList;
