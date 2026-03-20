/**
 * ReAct Agent Tests
 *
 * Tests the ReAct (Reasoning + Acting) loop with mocked LLM responses.
 * Covers all edge cases found during manual testing:
 * - JSON parsing issues (control characters, syntax errors)
 * - Over-eager tool calling
 * - Error recovery
 * - Repeated call detection
 * - Context window overflow
 * - Confirmation handling
 */

import { ReactAgent } from '../react-agent';

// Mock dependencies
jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

/**
 * Create a mock async iterable stream from a content string.
 * Simulates WebLLM streaming by yielding one chunk with the full content.
 *
 * @param {string} content - The LLM response content
 * @return {Object} Mock stream implementing async iterator protocol
 */
function mockStream( content ) {
	return {
		async *[ Symbol.asyncIterator ]() {
			yield {
				choices: [ { delta: { content } } ],
			};
			// Final chunk with usage stats
			yield {
				choices: [ { delta: { content: '' } } ],
				usage: {
					prompt_tokens: 100,
					completion_tokens: 50,
					total_tokens: 150,
				},
			};
		},
	};
}

/**
 * Helper to create a mock that returns streams for chained mockResolvedValueOnce calls.
 * Usage: mockStreamOnce( mockEngine, content1, content2, ... )
 *
 * @param {Object}    engine      - Mock engine object
 * @param {...string} contentArgs - Content strings for each LLM call
 */
function mockStreamOnce( engine, ...contentArgs ) {
	let mock = engine.chat.completions.create;
	for ( const content of contentArgs ) {
		mock = mock.mockResolvedValueOnce( mockStream( content ) );
	}
}

describe( 'ReactAgent', () => {
	let reactAgent;
	let mockModelLoader;
	let mockToolRegistry;
	let mockEngine;
	let mockCallbacks;

	beforeEach( () => {
		// Mock LLM engine
		mockEngine = {
			chat: {
				completions: {
					create: jest.fn(),
				},
			},
		};

		// Mock model loader
		mockModelLoader = {
			getEngine: jest.fn().mockReturnValue( mockEngine ),
			updateUsageStats: jest.fn(),
		};

		// Mock tool registry
		mockToolRegistry = {
			getAll: jest.fn().mockReturnValue( [
				{
					id: 'wp-agentic-admin/plugin-list',
					label: 'List Plugins',
					description: 'List all installed plugins',
					execute: jest.fn().mockResolvedValue( {
						plugins: [ { name: 'Test Plugin', active: true } ],
						total: 1,
					} ),
				},
				{
					id: 'wp-agentic-admin/site-health',
					label: 'Site Health',
					description: 'Check site health',
					execute: jest.fn().mockResolvedValue( {
						wordpress_version: '6.9',
						php_version: '8.3.29',
					} ),
				},
			] ),
			get: jest.fn( ( toolId ) => {
				const tools = mockToolRegistry.getAll();
				return tools.find( ( t ) => t.id === toolId );
			} ),
		};

		// Mock callbacks
		mockCallbacks = {
			onToolStart: jest.fn(),
			onToolEnd: jest.fn(),
			onConfirmationRequired: jest.fn().mockResolvedValue( true ),
		};

		// Create agent
		reactAgent = new ReactAgent( mockModelLoader, mockToolRegistry );
		reactAgent.setCallbacks( mockCallbacks );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'JSON Parsing', () => {
		it( 'should handle clean JSON output', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "final_answer", "content": "You have 1 plugin installed."}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
			expect( result.finalAnswer ).toContain( 'You have 1 plugin' );
			expect( result.iterations ).toBe( 2 );
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/plugin-list',
			] );
		} );

		it( 'should sanitize control characters in JSON', async () => {
			// Model outputs JSON with unescaped newline
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {"reason": "List\nplugins"}}',
				'{"action": "final_answer", "content": "Done"}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
		} );

		it( 'should fix single quotes in JSON', async () => {
			mockStreamOnce(
				mockEngine,
				"{'action': 'tool_call', 'tool': 'wp-agentic-admin/plugin-list', 'args': {}}",
				"{'action': 'final_answer', 'content': 'Done'}"
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
		} );

		it( 'should fix missing quotes after property names', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args:{}}',
				'{"action": "final_answer", "content": "Done"}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
		} );

		it( 'should extract first JSON object when multiple are output', async () => {
			// Model tries to output TWO actions at once
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}{"action": "final_answer", "content": "Done"}',
				'{"action": "final_answer", "content": "Done"}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
			// Should only process the first tool call
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/plugin-list',
			] );
		} );
	} );

	describe( 'Tool Execution', () => {
		it( 'should execute single tool call', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "final_answer", "content": "You have 1 plugin installed."}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/plugin-list',
			] );
			expect( mockCallbacks.onToolStart ).toHaveBeenCalledWith(
				'wp-agentic-admin/plugin-list'
			);
			expect( mockCallbacks.onToolEnd ).toHaveBeenCalled();
		} );

		it( 'should chain multiple tools', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/site-health", "args": {}}',
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "final_answer", "content": "Site is healthy and you have 1 plugin."}'
			);

			const result = await reactAgent.execute( 'check my site', [] );

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/site-health',
				'wp-agentic-admin/plugin-list',
			] );
			expect( result.iterations ).toBe( 3 );
		} );
	} );

	describe( 'Repeated Call Detection', () => {
		it( 'should stop when same tool is called twice in a row', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			// Should stop and provide summary
			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/plugin-list',
			] );
			expect( result.error ).toBe(
				'Repeated tool call detected (handled gracefully)'
			);
			expect( result.finalAnswer ).toContain( '1 plugin' ); // Should have summary
		} );
	} );

	describe( 'Max Iterations Safety', () => {
		it( 'should stop after 10 iterations', async () => {
			// Mock infinite loop: model alternates between two tools to avoid repeated call detection
			let callCount = 0;
			mockEngine.chat.completions.create.mockImplementation( () => {
				callCount++;
				const tool =
					callCount % 2 === 0
						? 'wp-agentic-admin/plugin-list'
						: 'wp-agentic-admin/site-health';
				return Promise.resolve(
					mockStream(
						`{"action": "tool_call", "tool": "${ tool }", "args": {}}`
					)
				);
			} );

			const result = await reactAgent.execute( 'do something', [] );

			expect( result.success ).toBe( false );
			expect( result.iterations ).toBe( 10 );
			expect( result.error ).toBe( 'Max iterations exceeded' );
			expect( result.finalAnswer ).toContain( 'maximum number of steps' );
		} );
	} );

	describe( 'Error Handling', () => {
		it( 'should handle tool execution errors', async () => {
			// Make tool throw an error
			const errorTool = {
				id: 'wp-agentic-admin/broken-tool',
				execute: jest
					.fn()
					.mockRejectedValue( new Error( 'Tool failed' ) ),
			};
			mockToolRegistry.get.mockReturnValue( errorTool );

			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/broken-tool", "args": {}}',
				'{"action": "final_answer", "content": "Tool failed, but I handled it."}'
			);

			const result = await reactAgent.execute( 'run broken tool', [] );

			// Should handle error gracefully and continue
			expect( result.success ).toBe( true );
			expect( result.observations[ 0 ].result.error ).toBe(
				'Tool failed'
			);
		} );

		it( 'should handle tool not found', async () => {
			mockToolRegistry.get.mockReturnValue( null );

			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/nonexistent", "args": {}}',
				'{"action": "final_answer", "content": "Tool not found."}'
			);

			const result = await reactAgent.execute( 'run fake tool', [] );

			expect( result.success ).toBe( true );
			expect( result.observations[ 0 ].result.error ).toBe(
				'Tool "wp-agentic-admin/nonexistent" not found'
			);
		} );

		it( 'should handle context window exceeded', async () => {
			mockEngine.chat.completions.create.mockRejectedValue(
				new Error( 'ContextWindowSizeExceededError: context too large' )
			);

			const result = await reactAgent.execute( 'test', [] );

			expect( result.success ).toBe( true ); // Still returns success with summary
			expect( result.error ).toContain( 'Context window exceeded' );
		} );
	} );

	describe( 'Confirmation Handling', () => {
		it( 'should request confirmation for tools that require it', async () => {
			// Add a tool that requires confirmation
			const confirmTool = {
				id: 'wp-agentic-admin/plugin-deactivate',
				label: 'Deactivate Plugin',
				requiresConfirmation: true,
				execute: jest.fn().mockResolvedValue( { success: true } ),
			};
			mockToolRegistry.get.mockReturnValue( confirmTool );

			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-deactivate", "args": {"plugin": "test"}}',
				'{"action": "final_answer", "content": "Plugin deactivated."}'
			);

			const result = await reactAgent.execute( 'deactivate plugin', [] );

			expect( result.success ).toBe( true );
			expect( mockCallbacks.onConfirmationRequired ).toHaveBeenCalledWith(
				confirmTool,
				{ plugin: 'test' }
			);
		} );

		it( 'should cancel execution if user rejects confirmation', async () => {
			mockCallbacks.onConfirmationRequired.mockResolvedValue( false );

			const confirmTool = {
				id: 'wp-agentic-admin/plugin-deactivate',
				requiresConfirmation: true,
				execute: jest.fn(),
			};
			mockToolRegistry.get.mockReturnValue( confirmTool );

			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-deactivate", "args": {}}',
				'{"action": "final_answer", "content": "Action cancelled."}'
			);

			const result = await reactAgent.execute( 'deactivate plugin', [] );

			expect( result.success ).toBe( true );
			expect( confirmTool.execute ).not.toHaveBeenCalled();
			expect( result.observations[ 0 ].result.cancelled ).toBe( true );
		} );
	} );

	describe( 'Conversational Mode (No Tools)', () => {
		it( 'should handle responses without tool calls', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "final_answer", "content": "A transient is temporary cached data in WordPress."}'
			);

			const result = await reactAgent.execute(
				'what is a transient?',
				[]
			);

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toEqual( [] );
			expect( result.iterations ).toBe( 1 );
			expect( result.finalAnswer ).toContain( 'transient' );
		} );
	} );

	describe( 'Real-World Test Cases from Manual Testing', () => {
		it( 'should handle "list plugins" correctly', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "final_answer", "content": "You have 1 plugin installed: Test Plugin (active)."}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/plugin-list',
			] );
		} );

		it( 'should handle "my site is slow" with multi-tool chain', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "wp-agentic-admin/site-health", "args": {}}',
				'{"action": "final_answer", "content": "Your site is running WordPress 6.9 on PHP 8.3.29."}'
			);

			const result = await reactAgent.execute( 'my site is slow', [] );

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toContain(
				'wp-agentic-admin/site-health'
			);
		} );
	} );

	describe( 'Instruction Loading', () => {
		let mockInstructionRegistry;

		beforeEach( () => {
			mockInstructionRegistry = {
				getAll: jest.fn().mockReturnValue( [
					{
						id: 'plugins',
						label: 'Plugin Management',
						description: 'List, activate, and deactivate plugins',
						keywords: [ 'plugin', 'plugins' ],
						abilityIds: [
							'wp-agentic-admin/plugin-list',
							'wp-agentic-admin/plugin-activate',
						],
					},
					{
						id: 'cache',
						label: 'Cache & Transients',
						description: 'Flush object cache and transients',
						keywords: [ 'cache', 'transient' ],
						abilityIds: [ 'wp-agentic-admin/cache-flush' ],
					},
				] ),
				get: jest.fn( ( id ) => {
					const instructions = mockInstructionRegistry.getAll();
					return instructions.find( ( i ) => i.id === id );
				} ),
				has: jest.fn( ( id ) => !! mockInstructionRegistry.get( id ) ),
			};

			// Add getByIds and getUngrouped to mockToolRegistry
			mockToolRegistry.getByIds = jest.fn( ( ids ) => {
				const tools = mockToolRegistry.getAll();
				return ids
					.map( ( id ) => tools.find( ( t ) => t.id === id ) )
					.filter( Boolean );
			} );
			mockToolRegistry.getUngrouped = jest.fn( () => [] );

			reactAgent = new ReactAgent(
				mockModelLoader,
				mockToolRegistry,
				{},
				mockInstructionRegistry
			);
			reactAgent.setCallbacks( mockCallbacks );
		} );

		it( 'should handle load_instruction tool call', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "load_instruction", "args": {"instruction": "plugins"}}',
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "final_answer", "content": "You have 1 plugin."}'
			);

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
			expect( reactAgent.activeInstructions.has( 'plugins' ) ).toBe(
				true
			);
			expect( result.toolsUsed ).toContain(
				'wp-agentic-admin/plugin-list'
			);
		} );

		it( 'should handle unload_instruction tool call', async () => {
			reactAgent.activeInstructions.add( 'plugins' );

			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "unload_instruction", "args": {"instruction": "plugins"}}',
				'{"action": "final_answer", "content": "Done."}'
			);

			const result = await reactAgent.execute( 'done with plugins', [] );

			expect( result.success ).toBe( true );
			expect( reactAgent.activeInstructions.has( 'plugins' ) ).toBe(
				false
			);
		} );

		it( 'should handle invalid instruction ID in load_instruction', async () => {
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "load_instruction", "args": {"instruction": "nonexistent"}}',
				'{"action": "final_answer", "content": "Could not find that instruction."}'
			);

			const result = await reactAgent.execute( 'load something', [] );

			expect( result.success ).toBe( true );
			expect( reactAgent.activeInstructions.has( 'nonexistent' ) ).toBe(
				false
			);
		} );

		it( 'should persist activeInstructions across execute calls', async () => {
			// First call loads plugins
			mockStreamOnce(
				mockEngine,
				'{"action": "tool_call", "tool": "load_instruction", "args": {"instruction": "plugins"}}',
				'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
				'{"action": "final_answer", "content": "You have 1 plugin."}'
			);
			await reactAgent.execute( 'list plugins', [] );

			expect( reactAgent.activeInstructions.has( 'plugins' ) ).toBe(
				true
			);

			// Second call — plugins should still be active
			mockStreamOnce(
				mockEngine,
				'{"action": "final_answer", "content": "Plugins are still loaded."}'
			);
			await reactAgent.execute( 'anything else?', [] );

			expect( reactAgent.activeInstructions.has( 'plugins' ) ).toBe(
				true
			);
		} );

		it( 'should reset activeInstructions on resetSession()', () => {
			reactAgent.activeInstructions.add( 'plugins' );
			reactAgent.activeInstructions.add( 'cache' );

			reactAgent.resetSession();

			expect( reactAgent.activeInstructions.size ).toBe( 0 );
		} );

		it( 'should include instruction index in system prompt', () => {
			const prompt = reactAgent.buildSystemPromptPromptBased();

			expect( prompt ).toContain( 'load_instruction' );
			expect( prompt ).toContain( 'unload_instruction' );
			expect( prompt ).toContain( 'AVAILABLE INSTRUCTIONS' );
			expect( prompt ).toContain(
				'plugins: List, activate, and deactivate plugins'
			);
			expect( prompt ).toContain(
				'cache: Flush object cache and transients'
			);
		} );

		it( 'should show active instructions in system prompt', () => {
			reactAgent.activeInstructions.add( 'plugins' );

			const prompt = reactAgent.buildSystemPromptPromptBased();

			expect( prompt ).toContain( 'ACTIVE INSTRUCTIONS: plugins' );
			// Plugins should not be in AVAILABLE section
			expect( prompt ).not.toContain(
				'AVAILABLE INSTRUCTIONS' + '\\n- plugins'
			);
			// Cache should still be in AVAILABLE section
			expect( prompt ).toContain(
				'cache: Flush object cache and transients'
			);
		} );
	} );
} );
