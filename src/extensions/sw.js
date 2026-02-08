/**
 * WP Agentic Admin - Service Worker
 *
 * This Service Worker hosts the WebLLM engine, allowing the AI model to persist
 * across page navigations within wp-admin. The model stays loaded in GPU memory
 * as long as there's at least one active client (browser tab) connected.
 *
 * Architecture:
 * - Service Worker: Holds the MLCEngine instance, runs inference
 * - Client Pages: Send requests via postMessage, receive responses
 *
 * Benefits:
 * - Model persists across page navigations (no reload needed)
 * - Can be extended to work site-wide across all wp-admin pages
 * - Shared model instance across multiple tabs
 *
 * @since 0.1.0
 * @version 1.3.102
 */

import { ServiceWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Service Worker Version - increment this to force reload
const SW_VERSION = '1.3.102';

/**
 * Log helper with timestamp
 * @param {...any} args - Console log arguments to output with timestamp.
 */
function swLog( ...args ) {
	const timestamp = new Date().toISOString().split( 'T' )[ 1 ].slice( 0, -1 );
	console.log( `[WP Agentic SW ${ timestamp }]`, ...args );
}

/**
 * Service Worker MLCEngine Handler
 * IMPORTANT: Must be created at top level, not inside event handlers
 * Chrome requires message handlers to be set up during initial script evaluation
 */
swLog( `Service Worker version: ${ SW_VERSION }` );
swLog( 'Creating ServiceWorkerMLCEngineHandler...' );
// eslint-disable-next-line no-unused-vars -- handler sets up message listeners via side effects
const handler = new ServiceWorkerMLCEngineHandler();
swLog( 'ServiceWorkerMLCEngineHandler created successfully' );

/**
 * Activate event - Claim clients
 */
self.addEventListener( 'activate', ( event ) => {
	swLog( 'Service Worker activating...' );
	swLog( 'Service Worker activated and ready' );

	// Claim all clients immediately so they can start using this SW
	event.waitUntil( self.clients.claim() );
} );

/**
 * Install event - Skip waiting to activate immediately
 */
self.addEventListener( 'install', ( event ) => {
	swLog( 'Service Worker installing...' );

	// Skip waiting to become active immediately
	event.waitUntil( self.skipWaiting() );
} );

/**
 * Note: NO custom message event listener!
 * ServiceWorkerMLCEngineHandler sets up its own message handler internally.
 * Adding our own listener would intercept WebLLM messages and prevent them
 * from reaching the handler.
 */
