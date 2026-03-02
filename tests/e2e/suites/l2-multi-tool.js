/**
 * L2 Multi-Tool Chain Tests
 *
 * Tests that the agent correctly chains multiple tools for complex requests.
 * The agent should use 2+ tools in sequence, with each informing the next.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L2: Multi-Tool Chains',
	category: 'L2',
	tests: [
		{
			name: 'Check health then optimize',
			input: 'check my site health and optimize the database if needed',
			assertions: {
				toolsCalledMinimum: 2,
				toolsCalledMaximum: 3,
				responseNotEmpty: true,
				responseContainsAny: [ 'health', 'database', 'optimiz' ],
			},
		},
		{
			name: 'List plugins and check errors',
			input: 'show me my plugins and any recent errors',
			assertions: {
				toolsCalledMinimum: 2,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Full site diagnosis',
			input: 'do a full diagnosis of my site - check health, errors, and plugins',
			assertions: {
				toolsCalledMinimum: 2,
				toolsCalledMaximum: 4,
				responseNotEmpty: true,
			},
		},
	],
};

export default suite;
