/**
 * Unit tests for the page context helper.
 */

import {
	getPageContextString,
	getPageContextPrompt,
} from '../../utils/page-context';

const setContext = ( pageContext ) => {
	window.agenticAdmin = { pageContext };
};

describe( 'page context', () => {
	afterEach( () => {
		delete window.agenticAdmin;
	} );

	it( 'is empty without data', () => {
		expect( getPageContextString() ).toBe( '' );
		expect( getPageContextPrompt() ).toBe( '' );
	} );

	it( 'is empty on the plugin page', () => {
		setContext( {
			pagenow: 'admin.php',
			screenId: 'toplevel_page_agentic-admin',
		} );
		expect( getPageContextString() ).toBe( '' );
	} );

	it( 'names known admin screens', () => {
		setContext( { pagenow: 'plugins.php', screenId: 'plugins' } );
		expect( getPageContextString() ).toBe(
			'The user is currently on the WordPress "Plugins" admin page (plugins.php).'
		);
		expect( getPageContextPrompt() ).toMatch( /^\n\nCONTEXT:\nThe user/ );
	} );

	it( 'describes the editor with its post type', () => {
		setContext( {
			pagenow: 'post.php',
			screenId: 'page',
			screenBase: 'post',
			postType: 'page',
		} );
		expect( getPageContextString() ).toBe(
			'The user is editing a "page" in the WordPress editor.'
		);
	} );

	it( 'falls back to the file and screen ID', () => {
		setContext( {
			pagenow: 'admin.php',
			screenId: 'woocommerce_page_wc-orders',
		} );
		expect( getPageContextString() ).toBe(
			'The user is currently on the WordPress admin page admin.php (screen: woocommerce_page_wc-orders).'
		);
	} );
} );
