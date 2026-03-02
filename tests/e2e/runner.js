/**
 * E2E Test Runner
 *
 * Main orchestration script for browser-based E2E tests.
 * Designed to be executed by Claude Code using Chrome DevTools MCP tools.
 *
 * Flow:
 * 1. Login to WordPress
 * 2. Navigate to plugin page
 * 3. Load AI model (wait for ready)
 * 4. Inject test mode flag
 * 5. Run all test suites
 * 6. Generate report
 *
 * Usage (via Claude Code):
 *   Read this file, then follow the steps using Chrome DevTools MCP tools.
 *   Each step includes the exact MCP tool calls to make.
 *
 * @since 2.0.0
 */

import { config } from './config.js';
import { runAssertions } from './helpers/assertions.js';

// Import all test suites
import { suite as l2SingleTool } from './suites/l2-single-tool.js';
import { suite as l2MultiTool } from './suites/l2-multi-tool.js';
import { suite as l2ErrorRecovery } from './suites/l2-error-recovery.js';
import { suite as l2Conversational } from './suites/l2-conversational.js';
import { suite as l2JsonReliability } from './suites/l2-json-reliability.js';
import { suite as l3ComplexMultistep } from './suites/l3-complex-multistep.js';
import { suite as l3Conditional } from './suites/l3-conditional.js';
import { suite as l3GoalCompletion } from './suites/l3-goal-completion.js';

/**
 * All test suites in execution order
 */
export const suites = [
	l2SingleTool,
	l2MultiTool,
	l2ErrorRecovery,
	l2Conversational,
	l2JsonReliability,
	l3ComplexMultistep,
	l3Conditional,
	l3GoalCompletion,
];

/**
 * Step 1: Login to WordPress
 *
 * MCP tools to call:
 *   navigate_page → config.urls.login
 *   fill → #user_login with config.credentials.username
 *   fill → #user_pass with config.credentials.password
 *   click → #wp-submit
 *   wait_for → .wrap (admin page loaded)
 */
export const step1_login = {
	description: 'Login to WordPress admin',
	actions: [
		{ tool: 'navigate_page', args: { url: config.urls.login } },
		{ tool: 'fill', args: { selector: config.selectors.loginUsername, value: config.credentials.username } },
		{ tool: 'fill', args: { selector: config.selectors.loginPassword, value: config.credentials.password } },
		{ tool: 'click', args: { selector: config.selectors.loginSubmit } },
		{ tool: 'wait_for', args: { selector: '.wrap', timeout: config.timeouts.login } },
	],
};

/**
 * Step 2: Navigate to plugin page and load model
 *
 * MCP tools to call:
 *   navigate_page → config.urls.plugin
 *   wait_for → config.selectors.root
 *   evaluate_script → select model from dropdown
 *   click → Load Model button
 *   wait_for → status indicator becomes ready (poll with evaluate_script)
 */
export const step2_loadModel = {
	description: 'Navigate to plugin and load AI model',
	actions: [
		{ tool: 'navigate_page', args: { url: config.urls.plugin } },
		{ tool: 'wait_for', args: { selector: config.selectors.root, timeout: config.timeouts.navigation } },
		{
			tool: 'evaluate_script',
			args: {
				expression: `
					const select = document.querySelector('${ config.selectors.modelSelect }');
					if (select) { select.value = '${ config.models.default }'; select.dispatchEvent(new Event('change', { bubbles: true })); }
				`,
			},
		},
		{ tool: 'click', args: { selector: config.selectors.loadModelButton } },
		{
			tool: 'evaluate_script',
			note: 'Poll this until it returns true, with timeout of config.timeouts.modelLoad',
			args: {
				expression: `!!document.querySelector('${ config.selectors.statusReady }')`,
			},
		},
	],
};

/**
 * Step 3: Inject test mode
 *
 * MCP tools to call:
 *   evaluate_script → set window.__wpAgenticTestMode = true
 */
export const step3_injectTestMode = {
	description: 'Inject test mode flag',
	actions: [
		{
			tool: 'evaluate_script',
			args: {
				expression: 'window.__wpAgenticTestMode = true; "test mode enabled"',
			},
		},
	],
};

/**
 * Run a single test case
 *
 * @param {Object} test - Test definition from a suite
 * @return {Object} Test result
 */
export async function runSingleTest( test ) {
	// The actual execution is done via MCP tools by Claude Code.
	// This function documents the steps for each test:
	//
	// 1. evaluate_script: window.__wpAgenticTestHook.clearChat()
	// 2. evaluate_script: window.__wpAgenticTestHook.sendMessage(test.input)
	// 3. Poll: evaluate_script → !window.__wpAgenticTestHook.isProcessing()
	// 4. evaluate_script: get toolsUsed, observations, lastMessage
	// 5. Run assertions
	// 6. take_screenshot if configured

	return {
		name: test.name,
		input: test.input,
		assertions: test.assertions,
		// These will be filled in by the runner:
		actual: null,
		result: null,
	};
}

/**
 * Run a complete suite with best-of-N retries
 *
 * @param {Object} suite - Suite definition
 * @return {Object} Suite results
 */
export function runSuite( suite ) {
	const results = [];

	for ( const test of suite.tests ) {
		let bestResult = null;

		for ( let attempt = 1; attempt <= config.execution.maxRetries; attempt++ ) {
			// Execute test (via MCP tools)
			// const actual = await executeTestViaMCP(test);
			// const assertionResult = runAssertions(test.assertions, actual);

			// For now, return the test structure
			bestResult = {
				name: test.name,
				attempt,
				// passed: assertionResult.passed,
				// assertionResult,
			};

			// If passed, no need for more attempts
			// if (assertionResult.passed) break;
		}

		results.push( bestResult );
	}

	return {
		suite: suite.name,
		category: suite.category,
		results,
		// passRate: results.filter(r => r.passed).length / results.length,
	};
}

/**
 * Generate test report
 *
 * @param {Array} suiteResults - Results from all suites
 * @return {Object} Report with summary and per-category breakdown
 */
export function generateReport( suiteResults ) {
	const report = {
		timestamp: new Date().toISOString(),
		model: config.models.default,
		suites: suiteResults,
		summary: {
			totalTests: 0,
			totalPassed: 0,
			totalFailed: 0,
			passRate: 0,
			categories: {},
		},
	};

	for ( const suite of suiteResults ) {
		const passed = ( suite.results || [] ).filter( ( r ) => r.passed ).length;
		const total = ( suite.results || [] ).length;

		report.summary.totalTests += total;
		report.summary.totalPassed += passed;
		report.summary.totalFailed += total - passed;

		report.summary.categories[ suite.category ] = {
			suite: suite.suite,
			passed,
			total,
			passRate: total > 0 ? passed / total : 0,
			meetsThreshold: total > 0 ? passed / total >= config.execution.passThreshold : false,
		};
	}

	report.summary.passRate =
		report.summary.totalTests > 0
			? report.summary.totalPassed / report.summary.totalTests
			: 0;

	return report;
}

/**
 * Format report as markdown
 *
 * @param {Object} report - Generated report
 * @return {string} Markdown-formatted report
 */
export function formatReportMarkdown( report ) {
	let md = `# E2E Test Report\n\n`;
	md += `**Model:** ${ report.model }\n`;
	md += `**Date:** ${ report.timestamp }\n`;
	md += `**Overall:** ${ report.summary.totalPassed }/${ report.summary.totalTests } passed (${ ( report.summary.passRate * 100 ).toFixed( 1 ) }%)\n\n`;

	md += `## Results by Category\n\n`;
	md += `| Category | Suite | Passed | Total | Rate | Threshold |\n`;
	md += `|----------|-------|--------|-------|------|-----------|\n`;

	for ( const [ cat, data ] of Object.entries( report.summary.categories ) ) {
		const icon = data.meetsThreshold ? '✅' : '❌';
		md += `| ${ cat } | ${ data.suite } | ${ data.passed } | ${ data.total } | ${ ( data.passRate * 100 ).toFixed( 0 ) }% | ${ icon } |\n`;
	}

	md += `\n## Detailed Results\n\n`;

	for ( const suite of report.suites ) {
		md += `### ${ suite.suite }\n\n`;
		for ( const result of suite.results || [] ) {
			const icon = result.passed ? '✅' : '❌';
			md += `- ${ icon } **${ result.name }**`;
			if ( result.attempt > 1 ) {
				md += ` (passed on attempt ${ result.attempt })`;
			}
			md += `\n`;
		}
		md += `\n`;
	}

	return md;
}

export default {
	suites,
	config,
	runAssertions,
	runSuite,
	generateReport,
	formatReportMarkdown,
	step1_login,
	step2_loadModel,
	step3_injectTestMode,
};
