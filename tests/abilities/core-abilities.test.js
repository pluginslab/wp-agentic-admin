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
			expectTool: 'agentic-admin/plugin-list',
		},
		{
			input: 'activate the WooCommerce plugin',
			expectTool: 'agentic-admin/plugin-activate',
		},
		{
			input: 'deactivate hello dolly',
			expectTool: 'agentic-admin/plugin-deactivate',
		},

		// ── Theme management ──────────────────────────────────────
		{
			input: 'list installed themes',
			expectTool: 'agentic-admin/theme-list',
		},
		{
			input: 'which theme is active on my site?',
			expectTool: 'agentic-admin/theme-list',
		},
		{
			input: 'show me all themes',
			expectTool: 'agentic-admin/theme-list',
		},

		// ── Current user role ─────────────────────────────────────
		{
			input: 'what user role is my current user?',
			expectTool: 'agentic-admin/current-user-role',
		},
		{
			input: 'who am I logged in as?',
			expectTool: 'agentic-admin/current-user-role',
		},
		{
			input: 'am I an administrator?',
			expectTool: 'agentic-admin/current-user-role',
		},

		// ── User management ───────────────────────────────────────
		{
			input: 'list all users on this site',
			expectTool: 'agentic-admin/user-list',
		},
		{
			input: 'show me the admin users',
			expectTool: 'agentic-admin/user-list',
		},

		// ── Update management ─────────────────────────────────────
		{
			input: 'are there any updates available?',
			expectTool: 'agentic-admin/update-check',
		},
		{
			input: 'check for outdated plugins',
			expectTool: [
				'agentic-admin/update-check',
				'agentic-admin/plugin-list',
			],
		},

		// ── Error log search ──────────────────────────────────────
		{
			input: 'search the error log for fatal errors',
			expectTool: 'agentic-admin/error-log-search',
		},
		{
			input: 'filter the log for database warnings',
			expectTool: 'agentic-admin/error-log-search',
		},

		// ── Comment stats ─────────────────────────────────────────
		{
			input: 'how many comments does my site have?',
			expectTool: 'agentic-admin/comment-stats',
		},
		{
			input: 'show me the spam comment count',
			expectTool: 'agentic-admin/comment-stats',
		},

		// ── Security ──────────────────────────────────────────────
		{
			input: 'run a security scan on my site',
			expectTool: 'agentic-admin/security-scan',
		},
		{
			input: 'check for security vulnerabilities',
			expectTool: 'agentic-admin/security-scan',
		},

		// ── Post management ───────────────────────────────────────
		{
			input: 'list my recent posts',
			expectTool: 'agentic-admin/post-list',
		},
		{
			input: 'show me all draft posts',
			expectTool: 'agentic-admin/post-list',
		},

		// ── Web search ───────────────────────────────────────────
		{
			input: 'search for how to fix WordPress white screen of death',
			expectTool: 'agentic-admin/web-search',
		},
		{
			input: 'look up WooCommerce REST API documentation',
			expectTool: 'agentic-admin/web-search',
		},

		// ── Diagnostics ────────────────────────────────────────────
		{
			input: 'show me the error log',
			expectTool: 'agentic-admin/error-log-read',
		},
		{
			input: 'is debug mode enabled?',
			// Both error-log-read and site-health return debug mode status — either is valid.
			expectTool: [
				'agentic-admin/error-log-read',
				'agentic-admin/site-health',
			],
		},
		{
			input: 'check my site health',
			expectTool: 'agentic-admin/site-health',
		},
		{
			input: 'what PHP version am I running?',
			// site-health and get-environment-info both return PHP version;
			// get-site-info is a reasonable guess since the model may associate
			// "version" with site info.
			expectTool: [
				'agentic-admin/site-health',
				'core/get-environment-info',
				'core/get-site-info',
			],
		},

		// ── WP-Config constants ────────────────────────────────────
		{
			input: 'list all of the wp-config.php constants',
			expectTool: 'agentic-admin/wp-config-list',
		},
		{
			input: 'what constants are defined in wp-config?',
			expectTool: 'agentic-admin/wp-config-list',
		},
		{
			input: 'show me the wp-config settings',
			// Both are valid: wp-config-list lists parsed constants, read-file shows raw file.
			expectTool: [
				'agentic-admin/wp-config-list',
				'agentic-admin/read-file',
			],
		},

		// ── File reading ───────────────────────────────────────────
		{
			input: 'show me my wp-config.php',
			expectTool: 'agentic-admin/read-file',
		},
		{
			input: 'read the .htaccess file',
			expectTool: 'agentic-admin/read-file',
		},
		{
			input: "what's in my theme's functions.php",
			expectTool: 'agentic-admin/read-file',
		},
		{
			input: 'open wp-content/plugins/myplugin/readme.txt',
			expectTool: 'agentic-admin/read-file',
		},

		// ── Cache & performance ────────────────────────────────────
		{
			input: 'flush the cache',
			expectTool: 'agentic-admin/cache-flush',
		},
		{
			input: 'optimize the database',
			expectTool: 'agentic-admin/db-optimize',
		},
		{
			input: 'clear all transients',
			expectTool: 'agentic-admin/transient-flush',
		},
		{
			input: 'clean up old post revisions',
			expectTool: 'agentic-admin/revision-cleanup',
		},

		// ── Cron & rewrites ────────────────────────────────────────
		{
			input: 'show me the scheduled cron jobs',
			expectTool: 'agentic-admin/cron-list',
		},
		{
			input: 'list all rewrite rules',
			expectTool: 'agentic-admin/rewrite-list',
		},
		{
			input: 'flush the rewrite rules',
			expectTool: 'agentic-admin/rewrite-flush',
		},

		// ── Core WordPress info ────────────────────────────────────
		{
			input: 'what is the name of my site?',
			expectTool: 'core/get-site-info',
		},
		{
			input: 'what is my site URL?',
			expectTool: 'core/get-site-info',
		},
		{
			input: 'what is my address URL',
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

		// ── Plugin ability discovery ─────────────────────────────
		{
			input: 'discover what abilities other plugins have registered',
			expectTool: 'agentic-admin/discover-plugin-abilities',
		},
		{
			input: 'what external tools are available on this site?',
			expectTool: 'agentic-admin/discover-plugin-abilities',
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
			input: 'agentic-admin/cron-list',
			expectTool: 'agentic-admin/cron-list',
			source: '#84',
		},
		{
			input: 'list all cron jobs',
			expectTool: 'agentic-admin/cron-list',
			source: '#84',
		},
		{
			input: 'agentic-admin/error-log-read',
			expectTool: 'agentic-admin/error-log-read',
			source: '#92',
		},

		// ── Plugin activate/deactivate (issues #53, #54) ─────────────
		{
			input: 'Activate Gutenberg',
			expectTool: 'agentic-admin/plugin-activate',
			source: '#53',
		},
		{
			input: 'Activate Gutenberg plugin',
			expectTool: 'agentic-admin/plugin-activate',
			source: '#53',
		},
		{
			input: 'deactivate generateblocks',
			expectTool: 'agentic-admin/plugin-deactivate',
			source: '#54',
		},
		{
			input: 'deactivate generateblocks plugin',
			expectTool: 'agentic-admin/plugin-deactivate',
			source: '#54',
		},

		// ── CMS / site identity (issues #60, #79) ────────────────────
		{
			input: 'which CMS and version am I running?',
			expectTool: [
				'core/get-site-info',
				'core/get-environment-info',
				'agentic-admin/site-health',
			],
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
			expectTool: [
				'agentic-admin/update-check',
				'agentic-admin/plugin-list',
			],
			source: '#66',
		},
		{
			input: 'update the plugins that need to be updated',
			expectTool: 'agentic-admin/update-check',
			source: '#66',
		},

		// ── Database optimize with specific tables (issues #69, #73) ──
		{
			input: 'optimize the database table wp_options',
			expectTool: 'agentic-admin/db-optimize',
			source: '#69',
		},
		{
			input: 'optimize the WooCommerce tables',
			expectTool: 'agentic-admin/db-optimize',
			source: '#73',
		},
		{
			input: 'optimize the WooCommerce database tables',
			expectTool: 'agentic-admin/db-optimize',
			source: '#73',
		},

		// ── Revision cleanup (issue #96) ─────────────────────────────
		{
			input: 'how many post revisions are there to clean?',
			expectTool: 'agentic-admin/revision-cleanup',
			source: '#96',
		},
		{
			input: 'agentic-admin/revision-cleanup dry-run',
			expectTool: 'agentic-admin/revision-cleanup',
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
