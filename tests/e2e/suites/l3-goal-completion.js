/**
 * L3 Goal Completion Tests
 *
 * Tests that the agent knows when to stop after achieving its goal.
 * The agent should not keep calling tools after the task is done.
 * It should provide a clear summary and stop.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L3: Goal Completion',
	category: 'L3',
	tests: [
		{
			name: 'Stop after listing plugins',
			input: 'list all installed plugins',
			assertions: {
				toolsCalled: [ 'wp-agentic-admin/plugin-list' ],
				toolsCalledExactly: 1,
				responseNotEmpty: true,
				responseContainsAny: [ 'plugin', 'installed' ],
			},
		},
		{
			name: 'Stop after cache flush',
			input: 'flush the object cache',
			assertions: {
				toolsCalledMaximum: 1,
				responseNotEmpty: true,
				responseContainsAny: [ 'cache', 'flush', 'cleared' ],
			},
		},
		{
			name: 'Stop after database optimization',
			input: 'run database optimization',
			assertions: {
				toolsCalled: [ 'wp-agentic-admin/db-optimize' ],
				toolsCalledExactly: 1,
				responseNotEmpty: true,
				responseContainsAny: [ 'database', 'optimiz' ],
			},
		},
	],
};

export default suite;
