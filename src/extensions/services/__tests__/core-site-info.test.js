/**
 * Core Site Info Ability Tests
 *
 * Tests contextual field filtering in interpretResult and parseIntent.
 * Verifies that the LLM receives focused interpretations when users
 * ask about specific fields (issue #79).
 */

// We need to mock the agentic-abilities-api before importing the module
// so registerAbility captures the ability config for us to test.
let registeredAbility = null;

jest.mock( '../../services/agentic-abilities-api', () => ( {
	registerAbility: ( id, config ) => {
		registeredAbility = { id, ...config };
	},
	executeAbility: jest.fn(),
} ) );

import { registerCoreSiteInfo } from '../../abilities/core-site-info';

// Register the ability so we can access its methods.
registerCoreSiteInfo();

const MOCK_RESULT = {
	name: 'My WordPress Site',
	description: 'Just another WordPress site',
	url: 'https://example.com',
	version: '6.9.0',
	language: 'en_US',
	admin_email: 'admin@example.com',
	charset: 'UTF-8',
};

describe( 'core/get-site-info', () => {
	describe( 'interpretResult', () => {
		it( 'returns full interpretation when no userMessage is provided', () => {
			const result = registeredAbility.interpretResult( MOCK_RESULT );
			expect( result ).toContain( 'site name is' );
			expect( result ).toContain( 'URL is' );
			expect( result ).toContain( 'tagline is' );
			expect( result ).toContain( 'WordPress 6.9.0' );
			expect( result ).toContain( 'admin email:' );
		} );

		it( 'returns full interpretation for general queries', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'tell me about my site'
			);
			expect( result ).toContain( 'site name is' );
			expect( result ).toContain( 'URL is' );
			expect( result ).toContain( 'tagline is' );
		} );

		it( 'returns only URL when user asks about URL', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what is my site URL?'
			);
			expect( result ).toContain( 'URL is https://example.com' );
			expect( result ).not.toContain( 'site name is' );
			expect( result ).not.toContain( 'tagline is' );
			expect( result ).not.toContain( 'WordPress 6.9.0' );
		} );

		it( 'returns only URL when user asks about address', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what is my address URL'
			);
			expect( result ).toContain( 'URL is https://example.com' );
			expect( result ).not.toContain( 'site name is' );
		} );

		it( 'returns only name when user asks about site name', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what is the site name?'
			);
			expect( result ).toContain( 'site name is "My WordPress Site"' );
			expect( result ).not.toContain( 'URL is' );
			expect( result ).not.toContain( 'tagline is' );
		} );

		it( 'returns only version when user asks about version', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what WordPress version am I running?'
			);
			expect( result ).toContain( 'WordPress 6.9.0' );
			expect( result ).not.toContain( 'site name is' );
			expect( result ).not.toContain( 'URL is' );
		} );

		it( 'returns only email when user asks about email', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what is the admin email?'
			);
			expect( result ).toContain( 'admin email: admin@example.com' );
			expect( result ).not.toContain( 'site name is' );
			expect( result ).not.toContain( 'URL is' );
		} );

		it( 'returns only language when user asks about language', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what language is my site in?'
			);
			expect( result ).toContain( 'language: en_US' );
			expect( result ).not.toContain( 'site name is' );
		} );

		it( 'returns multiple fields when user asks about several', () => {
			const result = registeredAbility.interpretResult(
				MOCK_RESULT,
				'what is my site name and email?'
			);
			expect( result ).toContain( 'site name is' );
			expect( result ).toContain( 'admin email:' );
			expect( result ).not.toContain( 'URL is' );
			expect( result ).not.toContain( 'WordPress 6.9.0' );
		} );

		it( 'handles empty result gracefully', () => {
			const result = registeredAbility.interpretResult( {} );
			expect( result ).toBe(
				'Site information was retrieved but contained no data.'
			);
		} );

		it( 'handles null result gracefully', () => {
			const result = registeredAbility.interpretResult( null );
			expect( result ).toBe( 'Unable to retrieve site information.' );
		} );
	} );

	describe( 'parseIntent', () => {
		it( 'returns empty object for general queries', () => {
			expect(
				registeredAbility.parseIntent( 'tell me about my site' )
			).toEqual( {} );
		} );

		it( 'detects URL field', () => {
			expect(
				registeredAbility.parseIntent( 'what is my site URL?' )
			).toEqual( { fields: [ 'url' ] } );
		} );

		it( 'detects name field from "title"', () => {
			expect(
				registeredAbility.parseIntent( 'what is the site title?' )
			).toEqual( { fields: [ 'name' ] } );
		} );

		it( 'detects address as URL', () => {
			expect(
				registeredAbility.parseIntent( 'what is my address' )
			).toEqual( { fields: [ 'url' ] } );
		} );

		it( 'detects multiple fields', () => {
			const result = registeredAbility.parseIntent(
				'show me the name and version'
			);
			expect( result.fields ).toContain( 'name' );
			expect( result.fields ).toContain( 'version' );
		} );

		it( 'detects charset field via encoding keyword', () => {
			expect(
				registeredAbility.parseIntent(
					'what encoding does my site use?'
				)
			).toEqual( { fields: [ 'charset' ] } );
		} );
	} );
} );
