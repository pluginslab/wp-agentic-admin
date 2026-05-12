/**
 * Knowledge Base Tests
 *
 * Covers the singleton state model introduced in PR #187:
 * - Initial state of the public getters
 * - subscribe / unsubscribe and listener isolation
 * - buildIndex deduplication when called concurrently
 * - buildIndex success path: notifies, persists status, transitions _building
 * - buildIndex error path: surfaces error via getError(), resets _building
 * - clearIndex resets state and notifies
 */

/* eslint-disable no-undef */

describe( 'knowledge-base', () => {
	let kb;
	let mockExecuteAbility;
	let mockVectorStore;
	let workerInstances;
	let workerAutoComplete;

	/**
	 * Fake Worker that records construction and (optionally) auto-emits
	 * a 'complete' message on postMessage so buildIndex resolves without
	 * needing a real Web Worker runtime.
	 */
	class FakeWorker {
		constructor( url ) {
			this.url = url;
			this.listeners = {};
			this.posted = [];
			this.terminated = false;
			workerInstances.push( this );
		}
		addEventListener( type, fn ) {
			( this.listeners[ type ] = this.listeners[ type ] || [] ).push(
				fn
			);
		}
		removeEventListener() {}
		postMessage( msg ) {
			this.posted.push( msg );
			if ( ! workerAutoComplete ) {
				return;
			}
			// Resolve on a microtask so the caller has time to attach handlers.
			queueMicrotask( () => {
				this.emit( 'message', {
					type: 'complete',
					embeddings: [ { id: '0' } ],
					chunkMetadata: [
						{
							id: '0',
							path: 'theme/style.php',
							start_line: 1,
							end_line: 10,
							content: 'x',
							type: 'code',
						},
					],
				} );
			} );
		}
		terminate() {
			this.terminated = true;
		}
		emit( type, data ) {
			for ( const fn of this.listeners[ type ] || [] ) {
				fn( { data } );
			}
		}
	}

	beforeEach( () => {
		jest.resetModules();
		workerInstances = [];
		workerAutoComplete = true;

		window.wpAgenticAdmin = { pluginUrl: 'http://test/' };
		global.Worker = FakeWorker;
		localStorage.clear();

		mockExecuteAbility = jest.fn();
		mockVectorStore = {
			init: jest.fn().mockResolvedValue(),
			clear: jest.fn().mockResolvedValue(),
			buildFromEmbeddings: jest.fn().mockResolvedValue( 1 ),
		};

		jest.doMock( '../agentic-abilities-api', () => ( {
			executeAbility: mockExecuteAbility,
		} ) );
		jest.doMock( '../vector-store', () => ( {
			__esModule: true,
			default: mockVectorStore,
		} ) );
		jest.doMock( '../../utils/logger', () => ( {
			createLogger: () => ( {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
			} ),
		} ) );

		kb = require( '../knowledge-base' );
	} );

	afterEach( () => {
		delete global.Worker;
		delete window.wpAgenticAdmin;
		localStorage.clear();
	} );

	/**
	 * Wire mockExecuteAbility to return one chunk per extraction phase.
	 */
	function stubSuccessfulExtraction() {
		mockExecuteAbility.mockImplementation( ( id ) => {
			switch ( id ) {
				case 'wp-agentic-admin/codebase-extract':
					return Promise.resolve( {
						chunks: [
							{
								path: 'theme/style.php',
								start_line: 1,
								end_line: 10,
								content: 'x',
								type: 'code',
							},
						],
						total_files: 1,
						has_more: false,
					} );
				case 'wp-agentic-admin/schema-extract':
					return Promise.resolve( {
						chunks: [
							{
								path: 'wp_posts',
								start_line: 0,
								end_line: 0,
								content: 'schema',
								type: 'schema',
							},
						],
						total_tables: 1,
					} );
				case 'wp-agentic-admin/wp-api-extract':
					return Promise.resolve( {
						chunks: [
							{
								path: 'wp_query',
								start_line: 0,
								end_line: 0,
								content: 'api',
								type: 'api',
							},
						],
					} );
				case 'wp-agentic-admin/docs-extract':
					return Promise.resolve( {
						chunks: [
							{
								path: 'docs/readme.md',
								start_line: 0,
								end_line: 0,
								content: 'doc',
								type: 'docs',
							},
						],
					} );
				default:
					return Promise.resolve( null );
			}
		} );
	}

	describe( 'initial state', () => {
		it( 'isBuilding() returns false', () => {
			expect( kb.isBuilding() ).toBe( false );
		} );

		it( 'getProgress() returns null', () => {
			expect( kb.getProgress() ).toBeNull();
		} );

		it( 'getError() returns null', () => {
			expect( kb.getError() ).toBeNull();
		} );

		it( 'getKBStatus() returns null when nothing is persisted', () => {
			expect( kb.getKBStatus() ).toBeNull();
		} );

		it( 'getKBStatus() returns null when localStorage holds invalid JSON', () => {
			localStorage.setItem( 'agentic_admin_kb_status', '{not-json' );
			expect( kb.getKBStatus() ).toBeNull();
		} );
	} );

	describe( 'subscribe', () => {
		it( 'returns a function', () => {
			const unsubscribe = kb.subscribe( () => {} );
			expect( typeof unsubscribe ).toBe( 'function' );
			unsubscribe();
		} );

		it( 'fires listeners on state changes', async () => {
			const listener = jest.fn();
			kb.subscribe( listener );
			await kb.clearIndex();
			expect( listener ).toHaveBeenCalled();
		} );

		it( 'stops firing after unsubscribe', async () => {
			const listener = jest.fn();
			const unsubscribe = kb.subscribe( listener );
			unsubscribe();
			await kb.clearIndex();
			expect( listener ).not.toHaveBeenCalled();
		} );

		it( 'isolates a throwing listener from other subscribers', async () => {
			const ok = jest.fn();
			kb.subscribe( () => {
				throw new Error( 'boom' );
			} );
			kb.subscribe( ok );
			await kb.clearIndex();
			expect( ok ).toHaveBeenCalled();
		} );
	} );

	describe( 'clearIndex', () => {
		it( 'delegates to vectorStore and removes persisted status', async () => {
			localStorage.setItem(
				'agentic_admin_kb_status',
				JSON.stringify( { totalChunks: 5 } )
			);

			await kb.clearIndex();

			expect( mockVectorStore.init ).toHaveBeenCalled();
			expect( mockVectorStore.clear ).toHaveBeenCalled();
			expect(
				localStorage.getItem( 'agentic_admin_kb_status' )
			).toBeNull();
			expect( kb.getProgress() ).toBeNull();
			expect( kb.getError() ).toBeNull();
		} );
	} );

	describe( 'buildIndex — success path', () => {
		it( 'completes a full build, persists status, leaves isBuilding=false', async () => {
			stubSuccessfulExtraction();

			const status = await kb.buildIndex();

			expect( status ).toMatchObject( {
				totalChunks: 1,
				codeFiles: 1,
				schemaTables: 1,
				apiChunks: 1,
				docsChunks: 1,
			} );
			expect( typeof status.lastIndexed ).toBe( 'number' );

			expect( kb.isBuilding() ).toBe( false );
			expect( kb.getError() ).toBeNull();
			expect( kb.getProgress() ).toMatchObject( {
				phase: 'done',
				percent: 100,
			} );

			expect( workerInstances.length ).toBe( 1 );
			expect( workerInstances[ 0 ].terminated ).toBe( true );
			expect(
				JSON.parse( localStorage.getItem( 'agentic_admin_kb_status' ) )
			).toMatchObject( { totalChunks: 1 } );
		} );

		it( 'notifies subscribers across all phases', async () => {
			stubSuccessfulExtraction();

			const phases = new Set();
			kb.subscribe( () => {
				const p = kb.getProgress();
				if ( p ) {
					phases.add( p.phase );
				}
			} );

			await kb.buildIndex();

			// Expect at least one notification per major phase.
			expect( phases ).toEqual(
				new Set( [
					'starting',
					'code',
					'schema',
					'api',
					'docs',
					'embedding',
					'done',
				] )
			);
		} );
	} );

	describe( 'buildIndex — deduplication', () => {
		it( 'returns the same worker/extraction for concurrent calls', async () => {
			stubSuccessfulExtraction();

			const [ s1, s2 ] = await Promise.all( [
				kb.buildIndex(),
				kb.buildIndex(),
			] );

			expect( s1 ).toEqual( s2 );
			// Exactly one Worker constructed.
			expect( workerInstances.length ).toBe( 1 );
			// Each ability called once, not twice.
			expect( mockExecuteAbility ).toHaveBeenCalledTimes( 4 );
		} );
	} );

	describe( 'buildIndex — error path', () => {
		it( 'surfaces a missing plugin URL via getError and isBuilding=false', async () => {
			stubSuccessfulExtraction();
			delete window.wpAgenticAdmin;

			await expect( kb.buildIndex() ).rejects.toThrow(
				/Plugin URL not available/
			);

			expect( kb.isBuilding() ).toBe( false );
			expect( kb.getError() ).toMatch( /Plugin URL not available/ );
		} );

		it( 'surfaces a worker error and resets _building', async () => {
			stubSuccessfulExtraction();
			workerAutoComplete = false;

			const buildPromise = kb.buildIndex();

			// Wait for phases 1-4 to complete and the worker to be constructed.
			await new Promise( ( resolve ) => setImmediate( resolve ) );

			expect( workerInstances.length ).toBe( 1 );
			workerInstances[ 0 ].emit( 'message', {
				type: 'error',
				message: 'embedding failed',
			} );

			await expect( buildPromise ).rejects.toThrow( /embedding failed/ );
			expect( kb.isBuilding() ).toBe( false );
			expect( kb.getError() ).toBe( 'embedding failed' );
		} );

		it( 'throws "No content found to index" when every extractor returns empty', async () => {
			mockExecuteAbility.mockResolvedValue( { chunks: [] } );

			await expect( kb.buildIndex() ).rejects.toThrow(
				/No content found to index/
			);
			expect( kb.isBuilding() ).toBe( false );
			expect( kb.getError() ).toMatch( /No content found to index/ );
			// No worker should have been spawned.
			expect( workerInstances.length ).toBe( 0 );
		} );
	} );
} );
