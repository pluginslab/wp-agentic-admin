/**
 * Abilities Index Tests
 *
 * Covers the slug-resolution logic in registerAllAbilities():
 *   - With PHP-localized enabledAbilities: register that list + JS-only,
 *     gating JS-only labs on enableLabs
 *   - Without PHP-localized data (test/dev): register everything minus
 *     LABS unless enableLabs is true
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
import { LABS_ABILITIES, JS_ONLY_ABILITIES } from '../manifest';

describe( 'resolveEnabledSlugs', () => {
	afterEach( () => {
		delete window.wpAgenticAdmin;
	} );

	describe( 'with PHP-authoritative enabledAbilities', () => {
		it( 'returns the PHP list plus non-labs JS-only abilities when labs off', () => {
			window.wpAgenticAdmin = {
				enabledAbilities: [ 'site-health', 'cache-flush' ],
				enableLabs: false,
			};

			const enabled = resolveEnabledSlugs();

			expect( enabled.has( 'site-health' ) ).toBe( true );
			expect( enabled.has( 'cache-flush' ) ).toBe( true );

			// JS-only non-labs members should be added.
			expect( enabled.has( 'current-user-role' ) ).toBe( true );
			expect( enabled.has( 'core-site-info' ) ).toBe( true );
			expect( enabled.has( 'wp-config-list' ) ).toBe( true );

			// JS-only LABS member must be filtered out when labs is off.
			expect( enabled.has( 'content-generate' ) ).toBe( false );
		} );

		it( 'adds JS-only labs when enableLabs is true', () => {
			window.wpAgenticAdmin = {
				enabledAbilities: [ 'site-health' ],
				enableLabs: true,
			};

			const enabled = resolveEnabledSlugs();

			expect( enabled.has( 'content-generate' ) ).toBe( true );
		} );

		it( 'respects an empty PHP list (only JS-only abilities register)', () => {
			window.wpAgenticAdmin = {
				enabledAbilities: [],
				enableLabs: false,
			};

			const enabled = resolveEnabledSlugs();

			expect( enabled.size ).toBeGreaterThan( 0 );
			for ( const slug of enabled ) {
				expect( JS_ONLY_ABILITIES.has( slug ) ).toBe( true );
				// And no labs members snuck in.
				expect( LABS_ABILITIES.has( slug ) ).toBe( false );
			}
		} );
	} );

	describe( 'fallback (no PHP-localized data)', () => {
		it( 'registers all REGISTRARS minus LABS by default', () => {
			// window.wpAgenticAdmin is unset.
			const enabled = resolveEnabledSlugs();

			expect( enabled.has( 'site-health' ) ).toBe( true );
			expect( enabled.has( 'current-user-role' ) ).toBe( true );

			for ( const slug of LABS_ABILITIES ) {
				expect( enabled.has( slug ) ).toBe( false );
			}
		} );

		it( 'includes LABS when enableLabs is true', () => {
			window.wpAgenticAdmin = { enableLabs: true };

			const enabled = resolveEnabledSlugs();

			for ( const slug of LABS_ABILITIES ) {
				expect( enabled.has( slug ) ).toBe( true );
			}
		} );
	} );
} );
