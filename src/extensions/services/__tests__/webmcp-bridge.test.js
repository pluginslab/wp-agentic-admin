/**
 * WebMCP Bridge Tests
 *
 * Tests the WebMCP bridge that exposes abilities as
 * navigator.modelContext tools for external AI agents.
 */

const { WebMCPBridge } = require( '../webmcp-bridge' );

// Mock logger to suppress console output
jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	} ),
} ) );

// Mock tool registry
jest.mock( '../tool-registry', () => ( {
	getAll: jest.fn( () => [] ),
} ) );

// Mock abilities API
jest.mock( '../abilities-api', () => ( {
	executeAbilityById: jest.fn(),
} ) );

const toolRegistry = require( '../tool-registry' );
const abilitiesApi = require( '../abilities-api' );

describe( 'WebMCPBridge', () => {
	let bridge;

	beforeEach( () => {
		bridge = new WebMCPBridge();

		// Clean up globals
		delete global.navigator;
		global.window = global.window || {};
		global.window.wpAgenticAdmin = {
			nonce: 'test-nonce-123',
			abilities: {},
		};
		global.window.addEventListener = jest.fn();
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	// ========================================================================
	// Feature detection
	// ========================================================================

	describe( 'isSupported()', () => {
		it( 'should return false when navigator is undefined', () => {
			delete global.navigator;
			expect( bridge.isSupported() ).toBe( false );
		} );

		it( 'should return false when modelContext is missing', () => {
			global.navigator = {};
			expect( bridge.isSupported() ).toBe( false );
		} );

		it( 'should return false when registerTool is not a function', () => {
			global.navigator = { modelContext: {} };
			expect( bridge.isSupported() ).toBe( false );
		} );

		it( 'should return true when registerTool is available', () => {
			global.navigator = {
				modelContext: { registerTool: jest.fn() },
			};
			expect( bridge.isSupported() ).toBe( true );
		} );
	} );

	// ========================================================================
	// Initialization
	// ========================================================================

	describe( 'initialize()', () => {
		it( 'should skip when WebMCP is not supported', () => {
			global.navigator = {};
			bridge.initialize();
			expect( bridge._initialized ).toBe( false );
		} );

		it( 'should skip when no auth nonce', () => {
			global.navigator = {
				modelContext: { registerTool: jest.fn() },
			};
			global.window.wpAgenticAdmin = {};
			bridge.initialize();
			expect( bridge._initialized ).toBe( false );
		} );

		it( 'should register tools from the registry', () => {
			const mockRegisterTool = jest.fn( () => ( {} ) );
			global.navigator = {
				modelContext: { registerTool: mockRegisterTool },
			};
			toolRegistry.getAll.mockReturnValue( [
				{
					id: 'wp-agentic-admin/plugin-list',
					description: 'List plugins',
					keywords: [ 'plugins' ],
				},
				{
					id: 'wp-agentic-admin/cache-flush',
					description: 'Flush cache',
					keywords: [ 'cache' ],
					requiresConfirmation: true,
				},
			] );

			bridge.initialize();

			expect( bridge._initialized ).toBe( true );
			expect( mockRegisterTool ).toHaveBeenCalledTimes( 2 );
			expect( bridge.registeredTools.size ).toBe( 2 );
		} );

		it( 'should not initialize twice', () => {
			const mockRegisterTool = jest.fn( () => ( {} ) );
			global.navigator = {
				modelContext: { registerTool: mockRegisterTool },
			};
			toolRegistry.getAll.mockReturnValue( [] );

			bridge.initialize();
			bridge.initialize();

			expect( mockRegisterTool ).toHaveBeenCalledTimes( 0 );
		} );

		it( 'should continue registering when one tool fails', () => {
			let callCount = 0;
			const mockRegisterTool = jest.fn( () => {
				callCount++;
				if ( callCount === 1 ) {
					throw new Error( 'Registration failed' );
				}
				return {};
			} );
			global.navigator = {
				modelContext: { registerTool: mockRegisterTool },
			};
			toolRegistry.getAll.mockReturnValue( [
				{
					id: 'wp-agentic-admin/fail-tool',
					description: 'Will fail',
					keywords: [ 'fail' ],
				},
				{
					id: 'wp-agentic-admin/success-tool',
					description: 'Will succeed',
					keywords: [ 'success' ],
				},
			] );

			bridge.initialize();

			expect( bridge._initialized ).toBe( true );
			expect( bridge.registeredTools.size ).toBe( 1 );
		} );
	} );

	// ========================================================================
	// Tool name conversion
	// ========================================================================

	describe( 'toToolName()', () => {
		it( 'should convert ability ID to snake_case with double underscore', () => {
			expect( bridge.toToolName( 'wp-agentic-admin/cache-flush' ) ).toBe(
				'wp_agentic_admin__cache_flush'
			);
		} );

		it( 'should handle core abilities', () => {
			expect( bridge.toToolName( 'core/get-site-info' ) ).toBe(
				'core__get_site_info'
			);
		} );
	} );

	describe( 'fromToolName()', () => {
		it( 'should convert snake_case tool name back to ability ID', () => {
			expect(
				bridge.fromToolName( 'wp_agentic_admin__cache_flush' )
			).toBe( 'wp-agentic-admin/cache-flush' );
		} );

		it( 'should handle core abilities', () => {
			expect( bridge.fromToolName( 'core__get_site_info' ) ).toBe(
				'core/get-site-info'
			);
		} );

		it( 'should roundtrip correctly', () => {
			const id = 'wp-agentic-admin/plugin-deactivate';
			expect( bridge.fromToolName( bridge.toToolName( id ) ) ).toBe( id );
		} );
	} );

	// ========================================================================
	// Schema building
	// ========================================================================

	describe( 'buildInputSchema()', () => {
		it( 'should return empty object schema when no PHP schema exists', () => {
			const tool = { id: 'wp-agentic-admin/test', keywords: [] };
			const schema = bridge.buildInputSchema(
				'wp-agentic-admin/test',
				tool
			);

			expect( schema.type ).toBe( 'object' );
			expect( schema.properties ).toEqual( {} );
		} );

		it( 'should use PHP schema when available', () => {
			global.window.wpAgenticAdmin.abilities[ 'wp-agentic-admin/test' ] =
				{
					inputSchema: {
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'Search query',
							},
						},
					},
				};
			const tool = { id: 'wp-agentic-admin/test', keywords: [] };
			const schema = bridge.buildInputSchema(
				'wp-agentic-admin/test',
				tool
			);

			expect( schema.properties.query ).toEqual( {
				type: 'string',
				description: 'Search query',
			} );
		} );

		it( 'should inject confirmed property for destructive tools', () => {
			const tool = {
				id: 'wp-agentic-admin/cache-flush',
				keywords: [],
				requiresConfirmation: true,
			};
			const schema = bridge.buildInputSchema(
				'wp-agentic-admin/cache-flush',
				tool
			);

			expect( schema.properties.confirmed ).toEqual( {
				type: 'boolean',
				description:
					'Set to true to confirm this destructive operation.',
			} );
		} );

		it( 'should inject confirmed for tools with destructive annotation', () => {
			const tool = {
				id: 'wp-agentic-admin/db-optimize',
				keywords: [],
				annotations: { destructive: true },
			};
			const schema = bridge.buildInputSchema(
				'wp-agentic-admin/db-optimize',
				tool
			);

			expect( schema.properties.confirmed ).toBeDefined();
		} );

		it( 'should not inject confirmed for non-destructive tools', () => {
			const tool = {
				id: 'wp-agentic-admin/plugin-list',
				keywords: [],
				requiresConfirmation: false,
			};
			const schema = bridge.buildInputSchema(
				'wp-agentic-admin/plugin-list',
				tool
			);

			expect( schema.properties.confirmed ).toBeUndefined();
		} );

		it( 'should not mutate the original PHP schema', () => {
			const original = {
				type: 'object',
				properties: { query: { type: 'string' } },
			};
			global.window.wpAgenticAdmin.abilities[ 'wp-agentic-admin/test' ] =
				{
					inputSchema: original,
				};
			const tool = {
				id: 'wp-agentic-admin/test',
				keywords: [],
				requiresConfirmation: true,
			};

			bridge.buildInputSchema( 'wp-agentic-admin/test', tool );

			expect( original.properties.confirmed ).toBeUndefined();
		} );
	} );

	// ========================================================================
	// Handler creation
	// ========================================================================

	describe( 'createHandler()', () => {
		it( 'should reject destructive tools without confirmed param', async () => {
			const handler = bridge.createHandler( {
				id: 'wp-agentic-admin/cache-flush',
				requiresConfirmation: true,
			} );

			const result = await handler( {} );
			const parsed = JSON.parse( result.content[ 0 ].text );

			expect( parsed.error ).toBe( 'confirmation_required' );
			expect( parsed.tool ).toBe( 'wp-agentic-admin/cache-flush' );
		} );

		it( 'should execute destructive tools with confirmed: true', async () => {
			abilitiesApi.executeAbilityById.mockResolvedValue( {
				success: true,
				message: 'Cache flushed',
			} );

			const handler = bridge.createHandler( {
				id: 'wp-agentic-admin/cache-flush',
				requiresConfirmation: true,
			} );

			const result = await handler( { confirmed: true } );
			const parsed = JSON.parse( result.content[ 0 ].text );

			expect( parsed.success ).toBe( true );
			expect( abilitiesApi.executeAbilityById ).toHaveBeenCalledWith(
				'wp-agentic-admin/cache-flush',
				{ confirmed: true }
			);
		} );

		it( 'should execute non-destructive tools immediately', async () => {
			abilitiesApi.executeAbilityById.mockResolvedValue( {
				success: true,
				data: [ { name: 'Akismet' } ],
			} );

			const handler = bridge.createHandler( {
				id: 'wp-agentic-admin/plugin-list',
				requiresConfirmation: false,
			} );

			const result = await handler( { status: 'active' } );
			const parsed = JSON.parse( result.content[ 0 ].text );

			expect( parsed.success ).toBe( true );
			expect( abilitiesApi.executeAbilityById ).toHaveBeenCalledWith(
				'wp-agentic-admin/plugin-list',
				{ status: 'active' }
			);
		} );

		it( 'should handle execution errors gracefully', async () => {
			abilitiesApi.executeAbilityById.mockRejectedValue(
				new Error( 'Network error' )
			);

			const handler = bridge.createHandler( {
				id: 'wp-agentic-admin/plugin-list',
				requiresConfirmation: false,
			} );

			const result = await handler( {} );
			const parsed = JSON.parse( result.content[ 0 ].text );

			expect( parsed.error ).toBe( 'execution_failed' );
			expect( parsed.message ).toBe( 'Network error' );
		} );

		it( 'should detect destructive via annotations', async () => {
			const handler = bridge.createHandler( {
				id: 'wp-agentic-admin/db-optimize',
				requiresConfirmation: false,
				annotations: { destructive: true },
			} );

			const result = await handler( {} );
			const parsed = JSON.parse( result.content[ 0 ].text );

			expect( parsed.error ).toBe( 'confirmation_required' );
		} );
	} );

	// ========================================================================
	// Cleanup
	// ========================================================================

	describe( 'cleanup()', () => {
		it( 'should do nothing when not initialized', () => {
			bridge.cleanup();
			expect( bridge._initialized ).toBe( false );
		} );

		it( 'should call unregisterTool when available', () => {
			const mockUnregister = jest.fn();
			global.navigator = {
				modelContext: {
					registerTool: jest.fn( () => ( {} ) ),
					unregisterTool: mockUnregister,
				},
			};
			toolRegistry.getAll.mockReturnValue( [
				{
					id: 'wp-agentic-admin/plugin-list',
					description: 'List plugins',
					keywords: [ 'plugins' ],
				},
			] );

			bridge.initialize();
			bridge.cleanup();

			expect( mockUnregister ).toHaveBeenCalledWith(
				'wp_agentic_admin__plugin_list'
			);
			expect( bridge.registeredTools.size ).toBe( 0 );
			expect( bridge._initialized ).toBe( false );
		} );

		it( 'should call registration.unregister() as fallback', () => {
			const mockUnregisterHandle = jest.fn();
			global.navigator = {
				modelContext: {
					registerTool: jest.fn( () => ( {
						unregister: mockUnregisterHandle,
					} ) ),
				},
			};
			toolRegistry.getAll.mockReturnValue( [
				{
					id: 'wp-agentic-admin/cache-flush',
					description: 'Flush cache',
					keywords: [ 'cache' ],
				},
			] );

			bridge.initialize();

			// Remove unregisterTool to test fallback
			delete global.navigator.modelContext.unregisterTool;
			bridge.cleanup();

			expect( mockUnregisterHandle ).toHaveBeenCalled();
			expect( bridge.registeredTools.size ).toBe( 0 );
		} );
	} );
} );
