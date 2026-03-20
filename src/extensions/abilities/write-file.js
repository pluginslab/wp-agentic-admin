/**
 * Write File Ability
 *
 * Edits WordPress files with backup and confirmation.
 *
 * @see includes/abilities/write-file.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the write-file ability with the chat system.
 */
export function registerWriteFile() {
	registerAbility( 'wp-agentic-admin/write-file', {
		label: 'Write or edit a WordPress file with backup',
		description:
			'Write or edit WordPress files with automatic backup. Use when users ask to add code, edit a file, enable debug, or change config. Args: file_path, content, mode (append/prepend/replace). Default mode is append for adding code.',

		keywords: [
			'write',
			'edit',
			'modify',
			'change',
			'fix',
			'add line',
			'add code',
			'enable debug',
			'update file',
			'functions.php',
			'wp-config',
			'.htaccess',
		],

		initialMessage: "I'll edit that file...",

		summarize: ( result ) => {
			if ( ! result.success ) {
				return `Failed: ${ result.message }`;
			}

			let summary = `${ result.message }`;
			if ( result.backup ) {
				summary += `\n\nBackup saved to: \`${ result.backup }\``;
			}

			return summary;
		},

		interpretResult: ( result ) => {
			if ( ! result.success ) {
				return `File edit failed: ${ result.message }`;
			}
			return `File edited successfully. ${
				result.backup ? 'Backup created at ' + result.backup + '.' : ''
			}`;
		},

		execute: async ( params ) => {
			if ( ! params.file_path || ! params.content ) {
				return {
					success: false,
					message: 'File path and content are required.',
				};
			}

			// Determine mode from userMessage — always check, even if LLM sent a mode,
			// because small models default to "replace" which destroys file content.
			let mode = 'append'; // Safe default: append preserves existing content.
			if ( params.userMessage ) {
				const lower = params.userMessage.toLowerCase();
				if (
					lower.includes( 'replace' ) ||
					lower.includes( 'overwrite' ) ||
					lower.includes( 'rewrite' )
				) {
					mode = 'replace';
				} else if (
					lower.includes( 'prepend' ) ||
					lower.includes( 'add to the top' ) ||
					lower.includes( 'insert at the beginning' ) ||
					lower.includes( 'before' )
				) {
					mode = 'prepend';
				}
			} else if (
				params.mode === 'replace' ||
				params.mode === 'prepend'
			) {
				// Only trust explicit mode when there's no userMessage (e.g. Abilities tab).
				mode = params.mode;
			}

			return executeAbility( 'wp-agentic-admin/write-file', {
				file_path: params.file_path,
				content: params.content,
				mode,
			} );
		},

		requiresConfirmation: true,

		getConfirmationMessage: ( params ) => {
			const file = params.file_path || 'unknown file';
			const mode = params.mode || 'replace';
			const isWpConfig = file.includes( 'wp-config' );
			let msg = `This will **${ mode }** the file \`${ file }\`. A backup will be created.`;
			if ( isWpConfig ) {
				msg +=
					'\n\n**Warning:** This is a critical configuration file. Proceed with caution.';
			}
			return msg + '\n\nProceed?';
		},
	} );
}

export default registerWriteFile;
