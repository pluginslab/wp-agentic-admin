/**
 * Ability Manifest Tests
 *
 * Locks in the manifest contract:
 *   - Every entry in REGISTRARS is a function
 *   - LOCAL_ONLY_ABILITIES and JS_ONLY_ABILITIES are subsets of REGISTRARS
 *   - Expected core abilities are present (regression guard)
 */

// Stub heavy ESM-only deps that the ability modules transitively import.
// We only care about the manifest's structural contract here, not behavior.
jest.mock( '@mlc-ai/web-llm', () => ( {} ), { virtual: true } );

jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

import {
	REGISTRARS,
	LOCAL_ONLY_ABILITIES,
	JS_ONLY_ABILITIES,
} from '../manifest';

describe( 'abilities manifest', () => {
	it( 'every registrar is a function', () => {
		for ( const [ slug, fn ] of Object.entries( REGISTRARS ) ) {
			expect( typeof fn ).toBe( 'function' );
			// Surface the failing slug in the assertion message if it ever breaks.
			if ( typeof fn !== 'function' ) {
				throw new Error(
					`REGISTRARS["${ slug }"] is not a function (got ${ typeof fn })`
				);
			}
		}
	} );

	it( 'every LOCAL_ONLY ability exists in REGISTRARS', () => {
		for ( const slug of LOCAL_ONLY_ABILITIES ) {
			expect( REGISTRARS ).toHaveProperty( slug );
		}
	} );

	it( 'all expected core abilities are registered (regression guard)', () => {
		const expectedCore = [
			'site-health',
			'security-scan',
			'verify-core-checksums',
			'verify-plugin-checksums',
			'file-scan',
			'database-check',
			'role-capabilities-check',
			'error-log-read',
			'error-log-search',
			'cron-list',
			'rewrite-list',
			'plugin-list',
			'theme-list',
			'user-list',
			'post-list',
			'comment-stats',
			'update-check',
			'cache-flush',
			'transient-flush',
			'rewrite-flush',
			'db-optimize',
			'revision-cleanup',
			'plugin-activate',
			'plugin-deactivate',
			'plugin-install',
			'web-search',
			'current-user-role',
			'core-site-info',
			'core-environment-info',
			'codebase-index',
			'code-search',
			'discover-plugin-abilities',
			'run-plugin-ability',
		];

		for ( const slug of expectedCore ) {
			expect( REGISTRARS ).toHaveProperty( slug );
			expect( LOCAL_ONLY_ABILITIES.has( slug ) ).toBe( false );
		}
	} );

	it( 'expected local-only slugs match the privacy gate plan', () => {
		expect( [ ...LOCAL_ONLY_ABILITIES ].sort() ).toEqual(
			[ 'read-file', 'wp-config-list' ].sort()
		);
	} );

	it( 'every JS_ONLY ability exists in REGISTRARS', () => {
		for ( const slug of JS_ONLY_ABILITIES ) {
			expect( REGISTRARS ).toHaveProperty( slug );
		}
	} );

	it( 'JS_ONLY contains the expected JS-only abilities', () => {
		// These have no PHP register function — PHP enabledAbilities will
		// never include them, so JS must add them back on its own.
		expect( [ ...JS_ONLY_ABILITIES ].sort() ).toEqual(
			[
				'current-user-role',
				'core-site-info',
				'core-environment-info',
				'codebase-index',
				'code-search',
				'wp-config-list', // also LOCAL_ONLY
			].sort()
		);
	} );
} );
