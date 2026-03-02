/**
 * L3 Conditional Tool Selection Tests
 *
 * Tests that the agent makes conditional decisions based on tool results.
 * Example: "If site health shows issues, then run the appropriate fix tool."
 *
 * This is more advanced than multi-step — the second tool depends on
 * what the first tool returned.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L3: Conditional Logic',
	category: 'L3',
	tests: [
		{
			name: 'Conditional optimization based on health',
			input: 'check site health and if the database needs attention, optimize it',
			assertions: {
				toolsCalledMinimum: 1,
				toolsCalledMaximum: 3,
				responseNotEmpty: true,
				conditionalAssertions: [
					{
						ifTool: 'wp-agentic-admin/site-health',
						ifContains: 'database',
						thenExpectTool: 'wp-agentic-admin/db-optimize',
					},
				],
			},
		},
	],
};

export default suite;
