/**
 * WP Agentic Admin - Admin Sidebar Entry Point
 *
 * Renders an AI chat sidebar on all wp-admin pages.
 * Toggled via a superhero icon in the WordPress admin bar.
 * Shares the WebLLM instance via the existing Service Worker.
 *
 * @version 0.9.6
 */

import { createRoot } from '@wordpress/element';
import AdminSidebar from './components/AdminSidebar';
import './styles/admin-sidebar.scss';
import { createLogger } from './utils/logger';

const log = createLogger( 'AdminSidebar' );

document.addEventListener( 'DOMContentLoaded', () => {
	// Find the container rendered by PHP in admin_footer.
	const container = document.getElementById( 'wp-agentic-admin-sidebar' );

	if ( ! container ) {
		log.warn( 'Sidebar container not found' );
		return;
	}

	if ( typeof window.wpAgenticAdmin === 'undefined' ) {
		log.error( 'Settings not found' );
		return;
	}

	// Toggle sidebar on admin bar icon click.
	const toggleBtn = document.getElementById(
		'wp-admin-bar-wp-agentic-admin-sidebar-toggle'
	);

	if ( toggleBtn ) {
		const toggleLink = toggleBtn.querySelector( 'a' ) || toggleBtn;
		toggleLink.setAttribute( 'aria-expanded', 'false' );

		toggleBtn.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			const isOpen = container.classList.toggle( 'is-open' );
			toggleBtn.classList.toggle( 'is-active', isOpen );
			toggleLink.setAttribute( 'aria-expanded', String( isOpen ) );
		} );
	}

	// Close sidebar when clicking the overlay.
	const overlay = document.getElementById(
		'wp-agentic-admin-sidebar-overlay'
	);
	if ( overlay ) {
		overlay.addEventListener( 'click', () => {
			container.classList.remove( 'is-open' );
			if ( toggleBtn ) {
				toggleBtn.classList.remove( 'is-active' );
				const toggleLink = toggleBtn.querySelector( 'a' ) || toggleBtn;
				toggleLink.setAttribute( 'aria-expanded', 'false' );
			}
		} );
	}

	// Close sidebar on Escape key and return focus to toggle button.
	document.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Escape' && container.classList.contains( 'is-open' ) ) {
			container.classList.remove( 'is-open' );
			if ( toggleBtn ) {
				toggleBtn.classList.remove( 'is-active' );
				const toggleLink = toggleBtn.querySelector( 'a' ) || toggleBtn;
				toggleLink.setAttribute( 'aria-expanded', 'false' );
				toggleLink.focus();
			}
		}
	} );

	const root = createRoot( container );
	root.render( <AdminSidebar /> );

	log.info( 'Admin sidebar initialized' );
} );
