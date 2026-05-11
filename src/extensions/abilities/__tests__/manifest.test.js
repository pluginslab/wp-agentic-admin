/**
 * Ability Manifest Tests
 *
 * Locks in the contract introduced by PR 1:
 *   - Every entry in REGISTRARS is a function
 *   - LOCAL_ONLY_ABILITIES and LABS_ABILITIES are subsets of REGISTRARS
 *   - The two category sets don't overlap
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

import { REGISTRARS, LOCAL_ONLY_ABILITIES, LABS_ABILITIES } from '../manifest';

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

	it( 'every LABS ability exists in REGISTRARS', () => {
		for ( const slug of LABS_ABILITIES ) {
			expect( REGISTRARS ).toHaveProperty( slug );
		}
	} );

	it( 'LOCAL_ONLY and LABS do not overlap', () => {
		for ( const slug of LOCAL_ONLY_ABILITIES ) {
			expect( LABS_ABILITIES.has( slug ) ).toBe( false );
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
		];

		for ( const slug of expectedCore ) {
			expect( REGISTRARS ).toHaveProperty( slug );
			expect( LOCAL_ONLY_ABILITIES.has( slug ) ).toBe( false );
			expect( LABS_ABILITIES.has( slug ) ).toBe( false );
		}
	} );

	it( 'expected labs slugs match the parked-feature plan', () => {
		expect( [ ...LABS_ABILITIES ].sort() ).toEqual(
			[
				'write-file',
				'content-generate',
				'backup-check',
				'opcode-cache-status',
				'disk-usage',
				'discover-plugin-abilities',
				'run-plugin-ability',
			].sort()
		);
	} );

	it( 'expected local-only slugs match the privacy gate plan', () => {
		expect( [ ...LOCAL_ONLY_ABILITIES ].sort() ).toEqual(
			[ 'query-database', 'read-file', 'wp-config-list' ].sort()
		);
	} );
} );
