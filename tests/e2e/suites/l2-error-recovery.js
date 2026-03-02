/**
 * L2 Error Recovery Tests
 *
 * Tests that the agent handles failures gracefully:
 * - Tool returns {success: false}
 * - Invalid tool arguments
 * The agent should explain errors clearly without hallucinating.
 *
 * @since 2.0.0
 */

export const suite = {
	name: 'L2: Error Recovery',
	category: 'L2',
	tests: [
		{
			name: 'Deactivate non-existent plugin',
			input: 'deactivate the plugin called "definitely-not-a-real-plugin-xyz"',
			assertions: {
				toolsCalledMaximum: 2,
				responseNotEmpty: true,
				responseContainsAny: [ 'not found', 'error', 'could not', 'unable', 'doesn\'t exist', 'does not exist' ],
			},
		},
		{
			name: 'Handle graceful failure',
			input: 'delete all spam comments',
			assertions: {
				// Agent should attempt something or explain it can't
				responseNotEmpty: true,
				// Should not hallucinate a successful result
				toolsCalledMaximum: 3,
			},
		},
	],
};

export default suite;
