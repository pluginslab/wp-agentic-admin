/**
 * Content Abilities — Tool Selection Tests
 *
 * Tests that the LLM correctly selects content-generate.
 *
 * Run with: npm run test:abilities -- --file tests/abilities/content-abilities.test.js
 *
 * @since 0.11.0
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

module.exports = {
	abilities,

	tests: [
		{
			input: 'generate content about dog training',
			expectTool: 'wp-agentic-admin/content-generate',
		},
		{
			input: 'fill this page with content about cooking tips',
			expectTool: 'wp-agentic-admin/content-generate',
		},
	],
};
