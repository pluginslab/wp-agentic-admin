/**
 * Instruction Registry Tests
 *
 * Tests the instruction registry — domain-specific groupings of abilities
 * that enable progressive disclosure in the system prompt.
 */

import { InstructionRegistry } from '../instruction-registry';

// Mock logger
jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

describe( 'InstructionRegistry', () => {
	let registry;

	const pluginsInstruction = {
		id: 'plugins',
		label: 'Plugin Management',
		description: 'List, activate, and deactivate plugins',
		keywords: [ 'plugin', 'plugins', 'extensions' ],
		abilityIds: [
			'wp-agentic-admin/plugin-list',
			'wp-agentic-admin/plugin-activate',
			'wp-agentic-admin/plugin-deactivate',
		],
	};

	const cacheInstruction = {
		id: 'cache',
		label: 'Cache & Transients',
		description: 'Flush object cache and transients',
		keywords: [ 'cache', 'transient', 'transients' ],
		abilityIds: [
			'wp-agentic-admin/cache-flush',
			'wp-agentic-admin/transient-flush',
		],
	};

	beforeEach( () => {
		registry = new InstructionRegistry();
	} );

	describe( 'register()', () => {
		it( 'should register an instruction', () => {
			registry.register( pluginsInstruction );
			expect( registry.has( 'plugins' ) ).toBe( true );
		} );

		it( 'should throw if id is missing', () => {
			expect( () => {
				registry.register( { keywords: [], abilityIds: [] } );
			} ).toThrow( 'Instruction must have an id' );
		} );

		it( 'should throw if abilityIds is missing', () => {
			expect( () => {
				registry.register( { id: 'test', keywords: [] } );
			} ).toThrow( 'must have abilityIds array' );
		} );

		it( 'should throw if keywords is missing', () => {
			expect( () => {
				registry.register( { id: 'test', abilityIds: [] } );
			} ).toThrow( 'must have keywords array' );
		} );

		it( 'should normalize keywords to lowercase', () => {
			registry.register( {
				...pluginsInstruction,
				keywords: [ 'Plugin', 'PLUGINS' ],
			} );
			const inst = registry.get( 'plugins' );
			expect( inst.keywords ).toEqual( [ 'plugin', 'plugins' ] );
		} );

		it( 'should allow overwriting an existing instruction', () => {
			registry.register( pluginsInstruction );
			registry.register( {
				...pluginsInstruction,
				label: 'Updated Label',
			} );
			expect( registry.get( 'plugins' ).label ).toBe( 'Updated Label' );
		} );
	} );

	describe( 'get() / has() / getAll()', () => {
		beforeEach( () => {
			registry.register( pluginsInstruction );
			registry.register( cacheInstruction );
		} );

		it( 'should get an instruction by id', () => {
			const inst = registry.get( 'plugins' );
			expect( inst.id ).toBe( 'plugins' );
			expect( inst.label ).toBe( 'Plugin Management' );
		} );

		it( 'should return undefined for unknown id', () => {
			expect( registry.get( 'nonexistent' ) ).toBeUndefined();
		} );

		it( 'should check existence', () => {
			expect( registry.has( 'plugins' ) ).toBe( true );
			expect( registry.has( 'nonexistent' ) ).toBe( false );
		} );

		it( 'should return all instructions', () => {
			const all = registry.getAll();
			expect( all ).toHaveLength( 2 );
			expect( all.map( ( i ) => i.id ) ).toEqual( [
				'plugins',
				'cache',
			] );
		} );
	} );

	describe( 'detectInstructions()', () => {
		beforeEach( () => {
			registry.register( pluginsInstruction );
			registry.register( cacheInstruction );
		} );

		it( 'should detect instructions from message keywords', () => {
			const matches = registry.detectInstructions( 'list my plugins' );
			expect( matches ).toEqual( [ 'plugins' ] );
		} );

		it( 'should detect multiple instructions', () => {
			const matches = registry.detectInstructions(
				'flush cache and list plugins'
			);
			expect( matches ).toContain( 'plugins' );
			expect( matches ).toContain( 'cache' );
		} );

		it( 'should return empty array when no keywords match', () => {
			const matches = registry.detectInstructions( 'hello world' );
			expect( matches ).toEqual( [] );
		} );

		it( 'should be case-insensitive', () => {
			const matches = registry.detectInstructions( 'LIST PLUGINS' );
			expect( matches ).toEqual( [ 'plugins' ] );
		} );
	} );

	describe( 'getInstructionForAbility()', () => {
		beforeEach( () => {
			registry.register( pluginsInstruction );
			registry.register( cacheInstruction );
		} );

		it( 'should find the instruction containing an ability', () => {
			const inst = registry.getInstructionForAbility(
				'wp-agentic-admin/plugin-list'
			);
			expect( inst.id ).toBe( 'plugins' );
		} );

		it( 'should return undefined for ungrouped abilities', () => {
			const inst = registry.getInstructionForAbility(
				'wp-agentic-admin/unknown'
			);
			expect( inst ).toBeUndefined();
		} );
	} );

	describe( 'clear()', () => {
		it( 'should remove all instructions', () => {
			registry.register( pluginsInstruction );
			registry.register( cacheInstruction );
			registry.clear();
			expect( registry.getAll() ).toHaveLength( 0 );
		} );
	} );
} );
