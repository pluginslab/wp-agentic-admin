/**
 * Update Check Ability
 *
 * Checks for available WordPress core, plugin, and theme updates.
 *
 * @see includes/abilities/update-check.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the update-check ability with the chat system.
 */
export function registerUpdateCheck() {
	registerAbility( 'wp-agentic-admin/update-check', {
		label: 'Check for available updates',
		description:
			'Check for available WordPress core, plugin, and theme updates. Use when users ask about outdated software or available upgrades.',

		keywords: [ 'update', 'updates', 'outdated', 'upgrade', 'version' ],

		initialMessage: "I'll check for available updates...",

		summarize: ( result ) => {
			const { core, plugins, themes, total } = result;

			if ( total === 0 ) {
				return 'Everything is up to date! No updates available for core, plugins, or themes.';
			}

			let summary = `Found **${ total } update${
				total !== 1 ? 's' : ''
			}** available.\n\n`;

			if ( core.available ) {
				summary += `**WordPress core:** ${ core.current } → ${ core.new_version }\n\n`;
			}

			if ( plugins.length > 0 ) {
				summary += `**Plugins (${ plugins.length }):**\n`;
				plugins.forEach( ( p ) => {
					summary += `- ${ p.name }: ${ p.current } → ${ p.new_version }\n`;
				} );
				summary += '\n';
			}

			if ( themes.length > 0 ) {
				summary += `**Themes (${ themes.length }):**\n`;
				themes.forEach( ( t ) => {
					summary += `- ${ t.name }: ${ t.current } → ${ t.new_version }\n`;
				} );
			}

			return summary;
		},

		interpretResult: ( result ) => {
			const { core, plugins, themes, total } = result;
			if ( total === 0 ) {
				return 'All software is up to date. No updates available.';
			}
			let text = `${ total } updates available.`;
			if ( core.available ) {
				text += ` Core: ${ core.current } to ${ core.new_version }.`;
			}
			if ( plugins.length > 0 ) {
				text += ` ${ plugins.length } plugin updates.`;
			}
			if ( themes.length > 0 ) {
				text += ` ${ themes.length } theme updates.`;
			}
			return text;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/update-check', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerUpdateCheck;
