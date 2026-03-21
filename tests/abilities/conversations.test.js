/**
 * Multi-Turn Conversation Tests
 *
 * Tests realistic conversation flows that mirror browser behavior:
 * tool selection → mock result → follow-up → web search context.
 *
 * Run with: npm run test:conversations -- --file tests/abilities/conversations.test.js
 *
 * @since 0.10.0
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

module.exports = {
	abilities,

	conversations: [
		// ── Security scan → follow-up → web search ──────────────────
		{
			name: 'Security scan with follow-up',
			turns: [
				{
					input: 'do a quick security check on this install',
					expectTool: 'wp-agentic-admin/security-scan',
					mockResult: {
						checks: [
							{
								check: 'Debug mode',
								status: 'fail',
								severity: 'warning',
								message:
									'WP_DEBUG is enabled. Disable in production.',
							},
							{
								check: 'wp-config.php permissions',
								status: 'fail',
								severity: 'critical',
								message:
									'Permissions are 644. Should be 640 or less.',
							},
							{
								check: 'Version in HTML',
								status: 'fail',
								severity: 'info',
								message:
									'WordPress version is exposed in page source.',
							},
						],
						summary: {
							critical: 1,
							warning: 1,
							info: 1,
							passed: 0,
							failed: 3,
						},
					},
				},
				{
					input: 'what is the deal with the WordPress version being exposed?',
					expectTool: null,
					expectAnswer: /version|expos|attack|vulnerabilit|security/i,
				},
			],
		},

		// ── Plugin list → follow-up about specific plugin ───────────
		{
			name: 'Plugin list with follow-up',
			turns: [
				{
					input: 'which plugins are active?',
					expectTool: 'wp-agentic-admin/plugin-list',
					mockResult: {
						plugins: [
							{
								name: 'Akismet Anti-spam',
								slug: 'akismet/akismet.php',
								active: true,
							},
							{
								name: 'WooCommerce',
								slug: 'woocommerce/woocommerce.php',
								active: true,
							},
							{
								name: 'Hello Dolly',
								slug: 'hello.php',
								active: false,
							},
						],
						total: 3,
						active: 2,
					},
				},
				{
					input: 'what does Akismet do?',
					expectTool: null,
					expectAnswer: /spam|comment|anti/i,
				},
			],
		},

		// ── Error log → search for specific error ───────────────────
		{
			name: 'Error log then search',
			turns: [
				{
					input: 'show me the error log',
					expectTool: 'wp-agentic-admin/error-log-read',
					mockResult: {
						lines: [
							'[21-Mar-2026 10:00:00 UTC] PHP Fatal error: Allowed memory size exhausted',
							'[21-Mar-2026 09:55:00 UTC] PHP Warning: file_get_contents failed',
							'[21-Mar-2026 09:50:00 UTC] PHP Notice: Undefined variable $foo',
						],
						total: 3,
					},
				},
				{
					input: 'search the log for memory errors',
					expectTool: 'wp-agentic-admin/error-log-search',
				},
			],
		},

		// ── Site info → follow-up about URL ─────────────────────────
		{
			name: 'Site info follow-up',
			turns: [
				{
					input: 'what is my site URL?',
					expectTool: [
						'core/get-site-url',
						'core/get-site-info',
					],
					mockResult: {
						url: 'https://example.com',
						name: 'My WordPress Site',
					},
				},
				{
					input: 'is it using HTTPS?',
					expectTool: null,
					expectAnswer: /https|ssl|secure|yes/i,
				},
			],
		},

		// ── Web search context in follow-up ────────────────────────
		{
			name: 'Question with web search context',
			turns: [
				{
					input: 'what is the latest WordPress version?',
					expectTool: null,
					webSearchResults: [
						{
							title: 'WordPress 6.9 Release',
							snippet:
								'WordPress 6.9 was released in March 2026 with performance improvements and new block editor features.',
						},
						{
							title: 'Download WordPress',
							snippet:
								'The latest stable version of WordPress is 6.9.4, released March 2026.',
						},
					],
					expectAnswer: /6\.9|latest|2026/i,
				},
			],
		},

		// ── Tool → summarize → different tool ──────────────────────
		{
			name: 'Two different tool calls in sequence',
			turns: [
				{
					input: 'check my site health',
					expectTool: 'wp-agentic-admin/site-health',
					mockResult: {
						status: 'good',
						issues: { critical: 0, recommended: 2 },
					},
				},
				{
					input: 'now optimize the database',
					expectTool: 'wp-agentic-admin/db-optimize',
				},
			],
		},

		// ── Knowledge question → then tool action ──────────────────
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
	],
};
