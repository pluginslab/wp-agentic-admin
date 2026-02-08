/**
 * WP Agentic Admin - Main Entry Point
 *
 * @version 0.1.0
 */

import { createRoot } from '@wordpress/element';
import App from './App';
import './styles/main.scss';

document.addEventListener( 'DOMContentLoaded', () => {
	console.log( '[WP Agentic Admin] Version 0.1.1 initializing...' );
	const container = document.getElementById( 'wp-agentic-admin-root' );

	if ( ! container ) {
		return;
	}

	// Check if settings are available
	if ( typeof window.wpAgenticAdmin === 'undefined' ) {
		console.error( 'WP Agentic Admin: Settings not found' );
		return;
	}

	const root = createRoot( container );
	root.render( <App /> );
} );
