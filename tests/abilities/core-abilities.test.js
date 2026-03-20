/**
 * Core Abilities — Tool Selection Tests
 *
 * Tests that the LLM correctly selects tools for various user inputs.
 * Runs in both flat mode (direct tool selection) and instruction mode
 * (load_instruction first, then tool selection).
 *
 * Run with:
 *   npm run test:abilities -- --file tests/abilities/core-abilities.test.js
 *   npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode flat
 *   npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode instruction
 *
 * @since 0.5.0
 */

const { loadAbilities } = require( './load-abilities' );
const { loadInstructions } = require( './load-instructions' );
const abilities = loadAbilities();

/**
 * Instruction definitions — loaded from markdown files in
 * src/extensions/instructions/*.md (single source of truth).
 */
const instructions = loadInstructions();

module.exports = {
	abilities,
	instructions,

	tests: [
		// ── Plugin management ──────────────────────────────────────
		{
			input: 'list all installed plugins',
			expectTool: 'wp-agentic-admin/plugin-list',
			expectInstruction: { id: 'plugins' },
		},
		{
			input: 'activate the WooCommerce plugin',
			expectTool: 'wp-agentic-admin/plugin-activate',
			expectInstruction: { id: 'plugins' },
		},
		{
			input: 'deactivate hello dolly',
			expectTool: 'wp-agentic-admin/plugin-deactivate',
			expectInstruction: { id: 'plugins' },
		},

		// ── Theme management ──────────────────────────────────────
		{
			input: 'list installed themes',
			expectTool: 'wp-agentic-admin/theme-list',
			expectInstruction: { id: 'themes' },
		},
		{
			input: 'which theme is active on my site?',
			expectTool: 'wp-agentic-admin/theme-list',
			expectInstruction: { id: 'themes' },
		},
		{
			input: 'show me all themes',
			expectTool: 'wp-agentic-admin/theme-list',
			expectInstruction: { id: 'themes' },
		},

		// ── User management ───────────────────────────────────────
		{
			input: 'list all users on this site',
			expectTool: 'wp-agentic-admin/user-list',
			expectInstruction: { id: 'users' },
		},
		{
			input: 'show me the admin users',
			expectTool: 'wp-agentic-admin/user-list',
			expectInstruction: { id: 'users' },
		},

		// ── Diagnostics ────────────────────────────────────────────
		{
			input: 'show me the error log',
			expectTool: 'wp-agentic-admin/error-log-read',
			expectInstruction: { id: 'diagnostics' },
		},
		{
			input: 'is debug mode enabled?',
			expectTool: [
				'wp-agentic-admin/error-log-read',
				'wp-agentic-admin/site-health',
			],
			expectInstruction: { id: 'diagnostics' },
		},
		{
			input: 'check my site health',
			expectTool: 'wp-agentic-admin/site-health',
			expectInstruction: { id: 'diagnostics' },
		},
		{
			input: 'what PHP version am I running?',
			expectTool: [
				'wp-agentic-admin/site-health',
				'core/get-environment-info',
				'core/get-site-info',
			],
			expectInstruction: { id: 'diagnostics' },
		},

		// ── Cache & performance ────────────────────────────────────
		{
			input: 'flush the cache',
			expectTool: 'wp-agentic-admin/cache-flush',
			expectInstruction: { id: 'cache' },
		},
		{
			input: 'optimize the database',
			expectTool: 'wp-agentic-admin/db-optimize',
			expectInstruction: { id: 'database' },
		},
		{
			input: 'clear all transients',
			expectTool: 'wp-agentic-admin/transient-flush',
			expectInstruction: { id: 'cache' },
		},
		{
			input: 'clean up old post revisions',
			expectTool: 'wp-agentic-admin/revision-cleanup',
			expectInstruction: { id: 'database' },
		},

		// ── Cron & rewrites ────────────────────────────────────────
		{
			input: 'show me the scheduled cron jobs',
			expectTool: 'wp-agentic-admin/cron-list',
			expectInstruction: { id: 'cron' },
		},
		{
			input: 'list all rewrite rules',
			expectTool: 'wp-agentic-admin/rewrite-list',
			expectInstruction: { id: 'routing' },
		},
		{
			input: 'flush the rewrite rules',
			expectTool: 'wp-agentic-admin/rewrite-flush',
			expectInstruction: { id: 'routing' },
		},

		// ── Core WordPress info ────────────────────────────────────
		{
			input: 'what is the name of my site?',
			expectTool: 'core/get-site-info',
			expectInstruction: { id: 'diagnostics' },
		},
		{
			input: 'what environment is this site running on?',
			expectTool: 'core/get-environment-info',
			expectInstruction: { id: 'diagnostics' },
		},

		// ── No-tool tests (pure knowledge questions) ───────────────
		// These work the same in both modes — no tool or instruction expected
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
