/**
 * E2E Test Configuration
 *
 * URLs, timeouts, CSS selectors, and model IDs for browser-based E2E tests.
 * These tests run via Claude Code using Chrome DevTools MCP tools.
 *
 * @since 2.0.0
 */

export const config = {
	// WordPress URLs
	urls: {
		login: 'https://agentic-admin.local/wp-login.php',
		admin: 'https://agentic-admin.local/wp-admin/',
		plugin: 'https://agentic-admin.local/wp-admin/admin.php?page=agentic-admin',
	},

	// WordPress credentials
	credentials: {
		username: 'marcel',
		password: 'marcel',
	},

	// Model configuration
	models: {
		default: 'Qwen3-1.7B-q4f16_1-MLC',
		defaultF32: 'Qwen3-1.7B-q4f32_1-MLC',
	},

	// CSS selectors for interacting with the plugin UI
	selectors: {
		// Login page
		loginUsername: '#user_login',
		loginPassword: '#user_pass',
		loginSubmit: '#wp-submit',

		// Plugin page
		root: '#agentic-admin-root',
		modelSelect: '.agentic-admin-model-select',
		loadModelButton: '.agentic-admin-load-model',
		statusReady: '.agentic-admin-status__indicator--ready',
		chatInput: '.agentic-admin-chat-input textarea',
		chatSendButton: '.agentic-admin-chat-input button',
		messageList: '.agentic-admin-message-list',
		lastMessage:
			'.agentic-admin-message-list .agentic-message:last-child',
	},

	// Timeouts (in milliseconds)
	timeouts: {
		navigation: 10000,
		login: 5000,
		modelLoad: 300000, // 5 minutes for first model load
		modelLoadCached: 60000, // 1 minute for cached model
		messageProcessing: 120000, // 2 minutes per message
		pollInterval: 2000, // Poll every 2 seconds
		betweenTests: 3000, // Wait between tests for model stability
	},

	// Test execution settings
	execution: {
		maxRetries: 3, // Best-of-3 for flaky LLM tests
		passThreshold: 0.7, // 70% pass rate per category
		screenshotOnFailure: true,
		screenshotOnSuccess: false,
	},
};

export default config;
