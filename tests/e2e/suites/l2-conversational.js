/**
 * L2 Conversational Tests
 *
 * Tests that the agent correctly identifies informational questions
 * and responds conversationally WITHOUT calling any tools.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L2: Conversational (No Tools)',
	category: 'L2',
	tests: [
		{
			name: 'Explain transients',
			input: 'what is a transient in WordPress?',
			assertions: {
				noToolsCalled: true,
				responseNotEmpty: true,
				responseContainsAny: [ 'transient', 'cache', 'temporary', 'stored' ],
			},
		},
		{
			name: 'Explain cron',
			input: 'how does WordPress cron work?',
			assertions: {
				noToolsCalled: true,
				responseNotEmpty: true,
				responseContainsAny: [ 'cron', 'schedule', 'event', 'hook' ],
			},
		},
		{
			name: 'General WordPress question',
			input: 'explain the difference between posts and pages',
			assertions: {
				noToolsCalled: true,
				responseNotEmpty: true,
				responseContainsAny: [ 'post', 'page' ],
			},
		},
	],
};

export default suite;
