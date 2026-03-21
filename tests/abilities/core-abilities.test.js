/**
 * Core Abilities — Tool Selection Tests
 *
 * Tests that the LLM correctly selects built-in abilities for various user inputs.
 * Abilities are loaded from abilities.json (single source of truth).
 *
 * Run with: npm run test:abilities -- --file tests/abilities/core-abilities.test.js
 *
 * For a minimal template to copy, see example.test.js in this directory.
 *
 * @since 0.5.0
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

module.exports = {
	abilities,

	tests: [
		// ── Plugin management ──────────────────────────────────────
		{
			input: 'list all installed plugins',
			expectTool: 'wp-agentic-admin/plugin-list',
		},
		{
			input: 'activate the WooCommerce plugin',
			expectTool: 'wp-agentic-admin/plugin-activate',
		},
		{
			input: 'deactivate hello dolly',
			expectTool: 'wp-agentic-admin/plugin-deactivate',
		},

		// ── Theme management ──────────────────────────────────────
		{
			input: 'list installed themes',
			expectTool: 'wp-agentic-admin/theme-list',
		},
		{
			input: 'which theme is active on my site?',
			expectTool: 'wp-agentic-admin/theme-list',
		},
		{
			input: 'show me all themes',
			expectTool: 'wp-agentic-admin/theme-list',
		},

		// ── User management ───────────────────────────────────────
		{
			input: 'list all users on this site',
			expectTool: 'wp-agentic-admin/user-list',
		},
		{
			input: 'show me the admin users',
			expectTool: 'wp-agentic-admin/user-list',
		},

		// ── Update management ─────────────────────────────────────
		{
			input: 'are there any updates available?',
			expectTool: 'wp-agentic-admin/update-check',
		},
		{
			input: 'check for outdated plugins',
			expectTool: 'wp-agentic-admin/update-check',
		},

		// ── Error log search ──────────────────────────────────────
		{
			input: 'search the error log for fatal errors',
			expectTool: 'wp-agentic-admin/error-log-search',
		},
		{
			input: 'filter the log for database warnings',
			expectTool: 'wp-agentic-admin/error-log-search',
		},

		// ── Disk usage ────────────────────────────────────────────
		{
			input: 'how much disk space is my site using?',
			expectTool: 'wp-agentic-admin/disk-usage',
		},
		{
			input: 'check storage usage',
			expectTool: 'wp-agentic-admin/disk-usage',
		},

		// ── OPcache status ────────────────────────────────────────
		{
			input: 'what is the opcache status?',
			expectTool: 'wp-agentic-admin/opcode-cache-status',
		},
		{
			input: 'is PHP opcode caching enabled?',
			expectTool: 'wp-agentic-admin/opcode-cache-status',
		},

		// ── Comment stats ─────────────────────────────────────────
		{
			input: 'how many comments does my site have?',
			expectTool: 'wp-agentic-admin/comment-stats',
		},
		{
			input: 'show me the spam comment count',
			expectTool: 'wp-agentic-admin/comment-stats',
		},

		// ── Security ──────────────────────────────────────────────
		{
			input: 'run a security scan on my site',
			expectTool: 'wp-agentic-admin/security-scan',
		},
		{
			input: 'check for security vulnerabilities',
			expectTool: 'wp-agentic-admin/security-scan',
		},

		// ── Post management ───────────────────────────────────────
		{
			input: 'list my recent posts',
			expectTool: 'wp-agentic-admin/post-list',
		},
		{
			input: 'show me all draft posts',
			expectTool: 'wp-agentic-admin/post-list',
		},

		// ── Backup check ──────────────────────────────────────────
		{
			input: 'do I have a backup plugin installed?',
			expectTool: 'wp-agentic-admin/backup-check',
		},
		{
			input: 'check my backup status',
			expectTool: 'wp-agentic-admin/backup-check',
		},

		// ── File writing ──────────────────────────────────────────
		{
			input: 'add a line to my functions.php',
			expectTool: 'wp-agentic-admin/write-file',
		},
		{
			input: 'edit the wp-config.php to enable debug mode',
			expectTool: 'wp-agentic-admin/write-file',
		},

		// ── Database queries ──────────────────────────────────────
		{
			input: 'run a SQL query to check the wp_options table',
			expectTool: 'wp-agentic-admin/query-database',
		},
		{
			input: 'query the database for autoloaded options',
			expectTool: 'wp-agentic-admin/query-database',
		},

		// ── Web search ───────────────────────────────────────────
		{
			input: 'search for how to fix WordPress white screen of death',
			expectTool: 'wp-agentic-admin/web-search',
		},
		{
			input: 'look up WooCommerce REST API documentation',
			expectTool: 'wp-agentic-admin/web-search',
		},

		// ── Diagnostics ────────────────────────────────────────────
		{
			input: 'show me the error log',
			expectTool: 'wp-agentic-admin/error-log-read',
		},
		{
			input: 'is debug mode enabled?',
			// Both error-log-read and site-health return debug mode status — either is valid.
			expectTool: [
				'wp-agentic-admin/error-log-read',
				'wp-agentic-admin/site-health',
			],
		},
		{
			input: 'check my site health',
			expectTool: 'wp-agentic-admin/site-health',
		},
		{
			input: 'what PHP version am I running?',
			// site-health and get-environment-info both return PHP version;
			// get-site-info is a reasonable guess since the model may associate
			// "version" with site info.
			expectTool: [
				'wp-agentic-admin/site-health',
				'core/get-environment-info',
				'core/get-site-info',
			],
		},

		// ── Cache & performance ────────────────────────────────────
		{
			input: 'flush the cache',
			expectTool: 'wp-agentic-admin/cache-flush',
		},
		{
			input: 'optimize the database',
			expectTool: 'wp-agentic-admin/db-optimize',
		},
		{
			input: 'clear all transients',
			expectTool: 'wp-agentic-admin/transient-flush',
		},
		{
			input: 'clean up old post revisions',
			expectTool: 'wp-agentic-admin/revision-cleanup',
		},

		// ── Cron & rewrites ────────────────────────────────────────
		{
			input: 'show me the scheduled cron jobs',
			expectTool: 'wp-agentic-admin/cron-list',
		},
		{
			input: 'list all rewrite rules',
			expectTool: 'wp-agentic-admin/rewrite-list',
		},
		{
			input: 'flush the rewrite rules',
			expectTool: 'wp-agentic-admin/rewrite-flush',
		},

		// ── Core WordPress info ────────────────────────────────────
		{
			input: 'what is the name of my site?',
			expectTool: 'core/get-site-info',
		},
		{
			input: 'what environment is this site running on?',
			expectTool: 'core/get-environment-info',
		},

		// ── Editor blocks ─────────────────────────────────────────
		{
			input: 'what blocks are on this page?',
			expectTool: 'core/get-editor-blocks',
		},
		{
			input: 'list the blocks in the editor',
			expectTool: 'core/get-editor-blocks',
		},

		// ── No-tool tests (pure knowledge questions) ───────────────
		{
			input: 'what is a transient in WordPress?',
			expectTool: null,
		},
		{
			input: 'explain the difference between posts and pages',
			expectTool: null,
		},

		// ══════════════════════════════════════════════════════════════
		// wpbullet regression tests — from GitHub issues
		// These test prompts that previously failed tool selection.
		// ══════════════════════════════════════════════════════════════

		// ── Direct tool invocation (issues #82, #84, #92) ────────────
		// Users typing the exact tool name should still route correctly.
		{
			input: 'core/get-environment-info',
			expectTool: 'core/get-environment-info',
			source: '#82',
		},
		{
			input: 'wp-agentic-admin/cron-list',
			expectTool: 'wp-agentic-admin/cron-list',
			source: '#84',
		},
		{
			input: 'list all cron jobs',
			expectTool: 'wp-agentic-admin/cron-list',
			source: '#84',
		},
		{
			input: 'wp-agentic-admin/error-log-read',
			expectTool: 'wp-agentic-admin/error-log-read',
			source: '#92',
		},

		// ── Plugin activate/deactivate (issues #53, #54) ─────────────
		{
			input: 'Activate Gutenberg',
			expectTool: 'wp-agentic-admin/plugin-activate',
			source: '#53',
		},
		{
			input: 'Activate Gutenberg plugin',
			expectTool: 'wp-agentic-admin/plugin-activate',
			source: '#53',
		},
		{
			input: 'deactivate generateblocks',
			expectTool: 'wp-agentic-admin/plugin-deactivate',
			source: '#54',
		},
		{
			input: 'deactivate generateblocks plugin',
			expectTool: 'wp-agentic-admin/plugin-deactivate',
			source: '#54',
		},

		// ── CMS / site identity (issues #60, #79) ────────────────────
		{
			input: 'which CMS and version am I running?',
			expectTool: [ 'core/get-site-info', 'core/get-environment-info' ],
			source: '#60',
		},
		{
			input: 'what is my address URL',
			expectTool: 'core/get-site-info',
			source: '#79',
		},
		{
			input: 'what is my site URL?',
			expectTool: 'core/get-site-info',
			source: '#79',
		},

		// ── Plugin updates (issue #66) ───────────────────────────────
		{
			input: 'list plugins that need to be updated',
			expectTool: 'wp-agentic-admin/update-check',
			source: '#66',
		},
		{
			input: 'update the plugins that need to be updated',
			expectTool: 'wp-agentic-admin/update-check',
			source: '#66',
		},

		// ── Database optimize with specific tables (issues #69, #73) ──
		{
			input: 'optimize the database table wp_options',
			expectTool: 'wp-agentic-admin/db-optimize',
			source: '#69',
		},
		{
			input: 'optimize the WooCommerce tables',
			expectTool: 'wp-agentic-admin/db-optimize',
			source: '#73',
		},
		{
			input: 'optimize the WooCommerce database tables',
			expectTool: 'wp-agentic-admin/db-optimize',
			source: '#73',
		},

		// ── Revision cleanup (issue #96) ─────────────────────────────
		{
			input: 'how many post revisions are there to clean?',
			expectTool: 'wp-agentic-admin/revision-cleanup',
			source: '#96',
		},
		{
			input: 'wp-agentic-admin/revision-cleanup dry-run',
			expectTool: 'wp-agentic-admin/revision-cleanup',
			source: '#96',
		},

		// ── Error diagnosis / conversational (issue #58) ─────────────
		// User pastes CLI error — no tool needed, LLM should answer directly.
		{
			input: 'when running wp-cli wp plugin list I get this error: "PHP Warning: Constant DB_NAME already defined in wp-config.php on line 24"',
			expectTool: null,
			source: '#58',
		},
	],
};
