/**
 * Backup Check Ability
 *
 * Checks backup plugin status and last backup time.
 *
 * @see includes/abilities/backup-check.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the backup-check ability with the chat system.
 */
export function registerBackupCheck() {
	registerAbility( 'wp-agentic-admin/backup-check', {
		label: 'Check backup plugin status',
		description:
			'Check if a backup plugin is installed and when the last backup ran. Use when users ask about backups or data safety.',

		keywords: [ 'backup', 'backups', 'restore', 'recovery' ],

		initialMessage: "I'll check your backup status...",

		summarize: ( result ) => {
			if ( ! result.has_backup_plugin ) {
				return result.message || 'No backup plugin detected.';
			}

			const { detected } = result;
			let summary = `**Backup plugin detected:** ${ result.plugin }\n`;
			summary += `**Last backup:** ${ result.last_backup }\n`;

			if ( detected && detected.length > 1 ) {
				summary += `\n_${ detected.length } backup plugins found:_\n`;
				detected.forEach( ( d ) => {
					summary += `- ${ d.name } (last: ${ d.last_backup })\n`;
				} );
			}

			return summary;
		},

		interpretResult: ( result ) => {
			if ( ! result.has_backup_plugin ) {
				return 'No backup plugin detected. The site has no automated backup solution.';
			}
			return `Backup plugin: ${ result.plugin }. Last backup: ${ result.last_backup }.`;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/backup-check', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerBackupCheck;
