/**
 * Disk Usage Ability
 *
 * Checks wp-content disk usage breakdown.
 *
 * @see includes/abilities/disk-usage.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the disk-usage ability with the chat system.
 */
export function registerDiskUsage() {
	registerAbility( 'wp-agentic-admin/disk-usage', {
		label: 'Check wp-content disk usage',
		description:
			'Check disk usage for uploads, plugins, themes, and cache directories. Use when users ask about storage or disk space.',

		keywords: [ 'disk', 'storage', 'space', 'size', 'usage' ],

		initialMessage: "I'll check your disk usage...",

		summarize: ( result ) => {
			const { directories, total } = result;

			let summary = `**Total wp-content size:** ${ total }\n\n`;

			directories.forEach( ( dir ) => {
				summary += `- **${ dir.name }:** ${ dir.size }\n`;
			} );

			return summary;
		},

		interpretResult: ( result ) => {
			const { directories, total } = result;
			if ( ! directories || directories.length === 0 ) {
				return 'Could not determine disk usage.';
			}
			const parts = directories.map(
				( d ) => `${ d.name }: ${ d.size }`
			);
			return `Total wp-content: ${ total }. Breakdown: ${ parts.join(
				', '
			) }.`;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/disk-usage', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerDiskUsage;
