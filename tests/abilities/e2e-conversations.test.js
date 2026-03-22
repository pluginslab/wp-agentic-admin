/**
 * E2E Conversation Tests
 *
 * Multi-turn conversations with real WP REST API tool execution.
 * Each turn runs the full ReAct loop or conversational path,
 * mirroring the exact browser flow.
 *
 * Run with: npm run test:e2e -- --file tests/abilities/e2e-conversations.test.js
 *
 * @since 0.10.0
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

module.exports = {
	abilities,

	conversations: [
		// ── Security scan → follow-up ───────────────────────────────
		{
			name: 'Security scan with follow-up',
			turns: [
				{
					input: 'do a quick security check on this install',
					expectTool: 'wp-agentic-admin/security-scan',
				},
				{
					input: 'what is the deal with the WordPress version being exposed?',
					expectTool: null,
					expectAnswer: /version|expos|attack|vulnerabilit|security/i,
				},
			],
		},

		// ── Plugin list → follow-up ─────────────────────────────────
		{
			name: 'Plugin list with follow-up',
			turns: [
				{
					input: 'which plugins are installed?',
					expectTool: 'wp-agentic-admin/plugin-list',
				},
				{
					input: 'how many are active?',
					expectTool: null,
					expectAnswer: /active|plugin/i,
				},
			],
		},

		// ── Error log → search ──────────────────────────────────────
		{
			name: 'Error log then search',
			turns: [
				{
					input: 'show me the error log',
					expectTool: 'wp-agentic-admin/error-log-read',
				},
				{
					input: 'search the log for fatal errors',
					expectTool: 'wp-agentic-admin/error-log-search',
				},
			],
		},

		// ── Site health → database optimize ─────────────────────────
		{
			name: 'Site health then optimize',
			turns: [
				{
					input: 'check my site health',
					expectTool: 'wp-agentic-admin/site-health',
				},
				{
					input: 'now optimize the database',
					expectTool: 'wp-agentic-admin/db-optimize',
				},
			],
		},

		// ── Knowledge → action ──────────────────────────────────────
		{
			name: 'Knowledge then action',
			turns: [
				{
					input: 'what is a transient in WordPress?',
					expectTool: null,
					expectAnswer: /transient|cache|temporary|expir/i,
				},
				{
					input: 'clear all transients',
					expectTool: 'wp-agentic-admin/transient-flush',
				},
			],
		},

		// ── Site URL → HTTPS follow-up ──────────────────────────────
		{
			name: 'Site URL follow-up',
			turns: [
				{
					input: 'what is my site URL?',
					expectTool: [ 'core/get-site-url', 'core/get-site-info' ],
				},
				{
					input: 'is it using HTTPS?',
					expectTool: null,
					expectAnswer: /https|ssl|secure|yes/i,
				},
			],
		},

		// ── Disk usage (single turn) ────────────────────────────────
		{
			name: 'Disk usage check',
			turns: [
				{
					input: 'how much disk space is my site using?',
					expectTool: 'wp-agentic-admin/disk-usage',
					expectAnswer: /MB|GB|size|upload|total/i,
				},
			],
		},
	],
};
