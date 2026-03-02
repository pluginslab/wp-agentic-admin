/**
 * L2 JSON Reliability Tests
 *
 * Tests that diverse requests all produce valid tool calls with proper JSON output.
 * This is the core reliability suite — 10 varied requests that should all succeed.
 * With 7B models, we expect significantly better JSON generation than 3B.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L2: JSON Reliability',
	category: 'L2',
	tests: [
		{
			name: 'Plugin list (basic)',
			input: 'show plugins',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Error log (basic)',
			input: 'show errors',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Site health (basic)',
			input: 'site health check',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Cache flush (imperative)',
			input: 'flush cache now',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Database optimize (polite)',
			input: 'could you please optimize my database?',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Plugin list (natural language)',
			input: 'what plugins do I have installed on my site?',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Error log (informal)',
			input: 'any errors lately?',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Clear transients',
			input: 'clear expired transients',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'Health check (casual)',
			input: 'is my site healthy?',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
		{
			name: 'DB optimization (shorthand)',
			input: 'optimize db',
			assertions: {
				toolsCalledMinimum: 1,
				responseNotEmpty: true,
			},
		},
	],
};

export default suite;
