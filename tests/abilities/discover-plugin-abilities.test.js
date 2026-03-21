/**
 * Discover Abilities — Tool Selection Tests
 *
 * Tests that the LLM correctly selects the discover/execute abilities.
 *
 * Run with: npm run test:abilities -- --file tests/abilities/discover-plugin-abilities.test.js
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

module.exports = {
	abilities,

	tests: [
		{
			input: 'discover what abilities other plugins have registered',
			expectTool: 'wp-agentic-admin/discover-plugin-abilities',
		},
		{
			input: 'what external tools are available on this site?',
			expectTool: 'wp-agentic-admin/discover-plugin-abilities',
		},
	],
};
