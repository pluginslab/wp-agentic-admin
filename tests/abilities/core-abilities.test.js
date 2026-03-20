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

		// ── Disk usage ────────────────────────────────────────────
		{
			input: 'how much disk space is my site using?',
			expectTool: 'wp-agentic-admin/disk-usage',
		},
		{
			input: 'check storage usage',
			expectTool: 'wp-agentic-admin/disk-usage',
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

		// ── No-tool tests (pure knowledge questions) ───────────────
		{
			input: 'what is a transient in WordPress?',
			expectTool: null,
		},
		{
			input: 'explain the difference between posts and pages',
			expectTool: null,
		},
	],
};
