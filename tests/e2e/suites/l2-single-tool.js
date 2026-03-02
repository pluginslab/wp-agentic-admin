/**
 * L2 Single Tool Selection Tests
 *
 * Tests that the agent correctly selects a single tool for straightforward requests.
 * These are the most basic agentic tests — one intent, one tool.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L2: Single Tool Selection',
	category: 'L2',
	tests: [
		{
			name: 'List plugins',
			input: 'list my plugins',
			assertions: {
				toolsCalled: [ 'wp-agentic-admin/plugin-list' ],
				toolsCalledExactly: 1,
				responseContainsAny: [ 'plugin', 'installed', 'active' ],
				responseNotEmpty: true,
			},
		},
		{
			name: 'Check site health',
			input: 'check my site health',
			assertions: {
				toolsCalled: [ 'wp-agentic-admin/site-health' ],
				toolsCalledExactly: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'View error log',
			input: 'show me the error log',
			assertions: {
				toolsCalled: [ 'wp-agentic-admin/error-log-read' ],
				toolsCalledExactly: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Flush cache',
			input: 'flush the cache',
			assertions: {
				toolsCalledExactly: 1,
				responseContainsAny: [ 'cache', 'flushed', 'cleared' ],
				responseNotEmpty: true,
			},
		},
		{
			name: 'Optimize database',
			input: 'optimize the database',
			assertions: {
				toolsCalled: [ 'wp-agentic-admin/db-optimize' ],
				toolsCalledExactly: 1,
				responseContainsAny: [ 'database', 'optimiz' ],
				responseNotEmpty: true,
			},
		},
	],
};

export default suite;
