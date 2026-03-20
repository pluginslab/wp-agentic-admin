/**
 * WP Agentic Admin - Main Entry Point
 *
 * @version 0.1.0
 */

import { createRoot } from '@wordpress/element';
import App from './App';
import './styles/main.scss';
import { createLogger } from './utils/logger';

const log = createLogger( 'WPAgenticAdmin' );

document.addEventListener( 'DOMContentLoaded', () => {
	log.info(
		`Version ${
			window.wpAgenticAdmin?.version || 'unknown'
		} initializing...`
	);
	const container = document.getElementById( 'wp-agentic-admin-root' );

	if ( ! container ) {
		return;
	}

	// Check if settings are available
	if ( typeof window.wpAgenticAdmin === 'undefined' ) {
		log.error( 'Settings not found' );
		return;
	}

	const root = createRoot( container );
	root.render( <App /> );
} );
