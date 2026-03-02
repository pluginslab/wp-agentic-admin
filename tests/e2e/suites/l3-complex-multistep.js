/**
 * L3 Complex Multi-Step Reasoning Tests
 *
 * Tests that the agent can perform diagnose-then-fix reasoning:
 * 1. Gather diagnostic information
 * 2. Analyze the results
 * 3. Take corrective action based on findings
 *
 * These require the agent to reason about intermediate results.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L3: Complex Multi-Step',
	category: 'L3',
	tests: [
		{
			name: 'Diagnose and fix slow site',
			input: 'my site is slow, find out why and fix what you can',
			assertions: {
				toolsCalledMinimum: 2,
				toolsCalledMaximum: 5,
				responseNotEmpty: true,
				responseContainsAny: [ 'health', 'database', 'optimiz', 'cache', 'performance' ],
			},
		},
		{
			name: 'Check errors and take action',
			input: 'check the error log and if there are database errors, optimize the database',
			assertions: {
				toolsCalledMinimum: 1,
				toolsCalledMaximum: 3,
				responseNotEmpty: true,
			},
		},
	],
};

export default suite;
