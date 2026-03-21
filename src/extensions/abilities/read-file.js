/**
 * Read File Ability
 *
 * Reads WordPress files with sensitive data automatically redacted.
 *
 * ABILITY OVERVIEW:
 * =================
 * Reads any file within the WordPress root and returns its contents.
 * Sensitive values (DB credentials, auth keys, salts) are redacted
 * server-side before the content reaches the LLM.
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Read file: wp-config.php",
 *   file_path: "wp-config.php",
 *   content: "<?php\n// ** Database settings ...",
 *   total_lines: 120,
 *   lines_returned: 100,
 *   was_redacted: true
 * }
 *
 * POSSIBLE STATES:
 * 1. success: false, file not found
 * 2. success: false, access denied (outside ABSPATH)
 * 3. success: false, not readable
 * 4. success: true, was_redacted: false — plain file shown
 * 5. success: true, was_redacted: true  — sensitive values hidden
 *
 * DISPLAY STRATEGY:
 * Uses preferSummarize: true so the ReAct agent short-circuits after the
 * tool call and renders summarize() output directly — bypassing the LLM.
 * This avoids truncation (512-token limit) and LLM reformatting of file
 * content. The file is shown instantly in a styled code block.
 *
 * @see includes/abilities/read-file.php for the PHP implementation
 * @see docs/ABILITIES-GUIDE.md#bypassing-the-llm-for-display-prefersummarize
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Known filenames and their language hints for syntax highlighting.
 */
const FILE_LANGUAGE_MAP = {
	'.php': 'php',
	'.js': 'javascript',
	'.json': 'json',
	'.css': 'css',
	'.html': 'html',
	'.htm': 'html',
	'.xml': 'xml',
	'.yml': 'yaml',
	'.yaml': 'yaml',
	'.sh': 'bash',
	'.htaccess': 'apache',
	'.ini': 'ini',
	'.conf': 'apache',
	'.txt': '',
	'.md': '',
	'.log': '',
};

/**
 * Detect syntax highlighting language from file path.
 *
 * @param {string} filePath - File path.
 * @return {string} Language hint for fenced code block.
 */
function detectLanguage( filePath ) {
	const lower = filePath.toLowerCase();

	// Special cases by full filename.
	if ( lower.endsWith( '.htaccess' ) ) {
		return 'apache';
	}
	if ( lower === 'wp-config.php' || lower.endsWith( '/wp-config.php' ) ) {
		return 'php';
	}

	// Match by extension.
	for ( const [ ext, lang ] of Object.entries( FILE_LANGUAGE_MAP ) ) {
		if ( lower.endsWith( ext ) ) {
			return lang;
		}
	}

	return '';
}

/**
 * Extract a file path from natural language user input.
 *
 * Handles patterns like:
 * - "show me wp-config.php"
 * - 'read "wp-content/themes/mytheme/functions.php"'
 * - "open the .htaccess file"
 * - "read wp-content/plugins/myplugin/readme.txt"
 *
 * @param {string} userMessage - Raw user message.
 * @return {string|null} Extracted path or null if not found.
 */
function extractFilePath( userMessage ) {
	// Quoted path (single or double quotes).
	const quotedMatch = userMessage.match( /["']([^"']+\.[a-z0-9]+)["']/i );
	if ( quotedMatch ) {
		return quotedMatch[ 1 ];
	}

	// Well-known standalone filenames.
	const knownFiles = [
		'wp-config.php',
		'.htaccess',
		'functions.php',
		'index.php',
		'readme.txt',
		'readme.html',
		'robots.txt',
		'php.ini',
	];
	const lower = userMessage.toLowerCase();
	for ( const name of knownFiles ) {
		if ( lower.includes( name ) ) {
			return name;
		}
	}

	// Path-like token: contains a slash and a dot extension.
	const pathMatch = userMessage.match(
		/\b((?:[\w.-]+\/)+[\w.-]+\.[a-z0-9]+)\b/i
	);
	if ( pathMatch ) {
		return pathMatch[ 1 ];
	}

	// Bare filename with extension at end of message.
	const bareMatch = userMessage.match( /\b([\w.-]+\.[a-z0-9]{2,5})\s*$/i );
	if ( bareMatch ) {
		return bareMatch[ 1 ];
	}

	return null;
}

/**
 * Register the read-file ability with the chat system.
 */
export function registerReadFile() {
	registerAbility( 'wp-agentic-admin/read-file', {
		label: 'Read file',
		description:
			'Read and display any WordPress file including wp-config.php. Always use this tool for file reading requests — sensitive values (DB credentials, auth keys, salts) are automatically redacted server-side.',

		keywords: [
			'read',
			'show',
			'view',
			'open',
			'display',
			'cat',
			'file',
			'config',
			'htaccess',
			'functions.php',
			'wp-config',
			'wp-config.php',
			'contents',
			'source',
		],

		initialMessage: "I'll read that file for you...",

		/**
		 * Extract file path from user message and call the PHP ability.
		 *
		 * @param {Object} options             - Execution options.
		 * @param {string} options.userMessage - Raw user message.
		 * @return {Promise<Object>} Result from PHP.
		 */
		execute: async ( { userMessage } ) => {
			const filePath = extractFilePath( userMessage );

			if ( ! filePath ) {
				return {
					error: 'I couldn\'t determine which file to read. Please specify a path, e.g. "read wp-config.php" or "show me wp-content/themes/mytheme/functions.php".',
				};
			}

			return executeAbility( 'wp-agentic-admin/read-file', {
				file_path: filePath,
			} );
		},

		/**
		 * Format the result for display in chat.
		 *
		 * @param {Object} result - Result from PHP.
		 * @return {string} Markdown summary.
		 */
		summarize: ( result ) => {
			if ( ! result.success ) {
				return `**Could not read file:** ${ result.message }`;
			}

			const lang = detectLanguage( result.file_path );
			const fence = '```';
			const redactedNote = result.was_redacted
				? '\n\n> **Note:** Sensitive values (credentials, keys, salts) have been redacted.'
				: '';
			const rangeNote =
				result.total_lines > result.lines_returned
					? ` (showing ${ result.lines_returned } of ${ result.total_lines } lines)`
					: '';

			return (
				`**\`${ result.file_path }\`**${ rangeNote }\n\n` +
				`${ fence }${ lang }\n${ result.content }\n${ fence }` +
				redactedNote
			);
		},

		/**
		 * Plain-English interpretation for the LLM.
		 *
		 * @param {Object} result      - Result from PHP.
		 * @param {string} userMessage - Original user message.
		 * @return {string} Interpretation.
		 */
		interpretResult: ( result, userMessage ) => {
			if ( ! result.success ) {
				return `Failed to read file: ${ result.message }`;
			}

			const redactedNote = result.was_redacted
				? ' Sensitive values have been replaced with [REDACTED].'
				: '';

			// interpretResult is only used when read-file is part of a multi-tool
			// ReAct chain. For single-tool requests, summarize() handles display.
			// Provide the content as plain text so the LLM can answer specific questions.
			const MAX_CONTENT = 1000;
			const content = result.content || '';
			const preview =
				content.length > MAX_CONTENT
					? content.substring( 0, MAX_CONTENT ) + ' ...[truncated]'
					: content;

			const readVerbs =
				/\b(read|show|view|open|display|cat|contents?|source)\b/i;
			const isViewRequest = readVerbs.test( userMessage || '' );
			const instruction = isViewRequest
				? 'The file content is shown to the user separately. Confirm what was read.'
				: "Answer the user's specific question using the file content below. Quote only the relevant lines.";

			return `File \`${ result.file_path }\`.${ redactedNote } ${ instruction }\n\n${ preview }`;
		},

		// Read-only — no confirmation needed.
		requiresConfirmation: false,

		// Use summarize() directly instead of asking the LLM to re-render file content.
		// The LLM's newline-stripping and "be concise" instruction both mangle output.
		preferSummarize: true,
	} );
}

export default registerReadFile;
