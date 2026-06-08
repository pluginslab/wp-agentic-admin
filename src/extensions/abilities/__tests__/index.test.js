/**
 * Abilities Index Tests
 *
 * Covers the slug-resolution logic in registerAllAbilities():
 *   - With PHP-localized enabledAbilities: register that list + all JS-only
 *   - Without PHP-localized data (test/dev): register everything in REGISTRARS
 */

/* eslint-disable no-undef */

jest.mock( '@mlc-ai/web-llm', () => ( {} ), { virtual: true } );

jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

import { resolveEnabledSlugs } from '../index';
import { REGISTRARS, JS_ONLY_ABILITIES } from '../manifest';

describe( 'resolveEnabledSlugs', () => {
	afterEach( () => {
		delete window.agenticAdmin;
	} );

	describe( 'with PHP-authoritative enabledAbilities', () => {
		it( 'returns the PHP list plus all JS-only abilities', () => {
			window.agenticAdmin = {
				enabledAbilities: [ 'site-health', 'cache-flush' ],
			};

			const enabled = resolveEnabledSlugs();

			expect( enabled.has( 'site-health' ) ).toBe( true );
			expect( enabled.has( 'cache-flush' ) ).toBe( true );

			// All JS-only members are merged in on top.
			for ( const slug of JS_ONLY_ABILITIES ) {
				expect( enabled.has( slug ) ).toBe( true );
			}
		} );

		it( 'respects an empty PHP list (only JS-only abilities register)', () => {
			window.agenticAdmin = {
				enabledAbilities: [],
			};

			const enabled = resolveEnabledSlugs();

			expect( enabled.size ).toBe( JS_ONLY_ABILITIES.size );
			for ( const slug of enabled ) {
				expect( JS_ONLY_ABILITIES.has( slug ) ).toBe( true );
			}
		} );
	} );

	describe( 'fallback (no PHP-localized data)', () => {
		it( 'registers every ability in REGISTRARS', () => {
			// window.agenticAdmin is unset.
			const enabled = resolveEnabledSlugs();

			expect( enabled.size ).toBe( Object.keys( REGISTRARS ).length );
			expect( enabled.has( 'site-health' ) ).toBe( true );
			expect( enabled.has( 'current-user-role' ) ).toBe( true );
			expect( enabled.has( 'discover-plugin-abilities' ) ).toBe( true );
		} );
	} );
} );
