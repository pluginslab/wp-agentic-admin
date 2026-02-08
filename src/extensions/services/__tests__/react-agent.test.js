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

		// Skip capability detection by setting the flag directly
		reactAgent.useFunctionCalling = false;
		reactAgent.hasTestedCapabilities = true;
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'JSON Parsing', () => {
		it( 'should handle clean JSON output', async () => {
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "You have 1 plugin installed."}',
							},
						},
					],
				} );

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
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {"reason": "List\nplugins"}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Done"}',
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
		} );

		it( 'should fix single quotes in JSON', async () => {
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									"{'action': 'tool_call', 'tool': 'wp-agentic-admin/plugin-list', 'args': {}}",
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									"{'action': 'final_answer', 'content': 'Done'}",
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
		} );

		it( 'should fix missing quotes after property names', async () => {
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args:{}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Done"}',
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
		} );

		it( 'should extract first JSON object when multiple are output', async () => {
			// Model tries to output TWO actions at once
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}{"action": "final_answer", "content": "Done"}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Done"}',
							},
						},
					],
				} );

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
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "You have 1 plugin installed."}',
							},
						},
					],
				} );

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
			mockEngine.chat.completions.create
				// First: Call site-health
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/site-health", "args": {}}',
							},
						},
					],
				} )
				// Second: Call plugin-list
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
							},
						},
					],
				} )
				// Third: Provide final answer
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Site is healthy and you have 1 plugin."}',
							},
						},
					],
				} );

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
			mockEngine.chat.completions.create
				// First: Call plugin-list
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
							},
						},
					],
				} )
				// Second: Call plugin-list AGAIN (repeated)
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
							},
						},
					],
				} );

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
				return Promise.resolve( {
					choices: [
						{
							message: {
								content: `{"action": "tool_call", "tool": "${ tool }", "args": {}}`,
							},
						},
					],
				} );
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

			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/broken-tool", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Tool failed, but I handled it."}',
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'run broken tool', [] );

			// Should handle error gracefully and continue
			expect( result.success ).toBe( true );
			expect( result.observations[ 0 ].result.error ).toBe(
				'Tool failed'
			);
		} );

		it( 'should handle tool not found', async () => {
			mockToolRegistry.get.mockReturnValue( null );

			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/nonexistent", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Tool not found."}',
							},
						},
					],
				} );

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

			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-deactivate", "args": {"plugin": "test"}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Plugin deactivated."}',
							},
						},
					],
				} );

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

			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-deactivate", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Action cancelled."}',
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'deactivate plugin', [] );

			expect( result.success ).toBe( true );
			expect( confirmTool.execute ).not.toHaveBeenCalled();
			expect( result.observations[ 0 ].result.cancelled ).toBe( true );
		} );
	} );

	describe( 'Conversational Mode (No Tools)', () => {
		it( 'should handle responses without tool calls', async () => {
			mockEngine.chat.completions.create.mockResolvedValueOnce( {
				choices: [
					{
						message: {
							content:
								'{"action": "final_answer", "content": "A transient is temporary cached data in WordPress."}',
						},
					},
				],
			} );

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
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "You have 1 plugin installed: Test Plugin (active)."}',
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'list plugins', [] );

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toEqual( [
				'wp-agentic-admin/plugin-list',
			] );
		} );

		it( 'should handle "my site is slow" with multi-tool chain', async () => {
			mockEngine.chat.completions.create
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "tool_call", "tool": "wp-agentic-admin/site-health", "args": {}}',
							},
						},
					],
				} )
				.mockResolvedValueOnce( {
					choices: [
						{
							message: {
								content:
									'{"action": "final_answer", "content": "Your site is running WordPress 6.9 on PHP 8.3.29."}',
							},
						},
					],
				} );

			const result = await reactAgent.execute( 'my site is slow', [] );

			expect( result.success ).toBe( true );
			expect( result.toolsUsed ).toContain(
				'wp-agentic-admin/site-health'
			);
		} );
	} );
} );
