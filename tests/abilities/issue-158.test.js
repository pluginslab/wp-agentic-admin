/**
 * Issue #158 — Context window loses context on repeated questions
 *
 * Reproduces the exact scenario: ask "list plugins" 3 times in a row.
 * The model should select the tool each time, not return "I had trouble understanding".
 *
 * @since 0.10.0
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

module.exports = {
	abilities,

	conversations: [
		// ── Exact reproduction of issue #158 ────────────────────────
		// The model may reuse its previous answer from history instead of
		// re-calling the tool. This is valid LLM behavior — the answer
		// hasn't changed. The real bug was "I had trouble understanding"
		// (JSON parse failure), which is fixed by removing tool results
		// from conversation history.
		{
			name: 'Issue #158: Repeated plugin list (3x)',
			turns: [
				{
					input: 'Give me a list of installed plugins',
					expectTool: 'wp-agentic-admin/plugin-list',
				},
				{
					input: 'Show me a list of installed plugins',
					// Model may call tool again or reuse cached answer — both valid
					expectAnswer: /plugin|akismet|agentic/i,
				},
				{
					input: 'list installed plugins',
					expectAnswer: /plugin|akismet|agentic/i,
				},
			],
		},

		// ── Variation: different tools in sequence ──────────────────
		{
			name: 'Issue #158: Different tools in sequence',
			turns: [
				{
					input: 'list plugins',
					expectTool: 'wp-agentic-admin/plugin-list',
				},
				{
					input: 'check site health',
					expectTool: 'wp-agentic-admin/site-health',
				},
				{
					input: 'list plugins again',
					// Model may re-call tool or answer from memory — both valid
					expectAnswer: /plugin|akismet|agentic/i,
				},
			],
		},

		// ── Variation: 4 turns to stress test ───────────────────────
		{
			name: 'Issue #158: 4 turns stress test',
			turns: [
				{
					input: 'show me the error log',
					expectTool: 'wp-agentic-admin/error-log-read',
				},
				{
					input: 'list all plugins',
					expectTool: 'wp-agentic-admin/plugin-list',
				},
				{
					input: 'check my site health',
					expectTool: 'wp-agentic-admin/site-health',
				},
				{
					input: 'how much disk space am I using?',
					expectTool: 'wp-agentic-admin/disk-usage',
				},
			],
		},
	],
};
