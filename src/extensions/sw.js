/**
 * WP Neural Admin - Service Worker
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
 * @package WPNeuralAdmin
 * @since 1.2.0
 */

import { ServiceWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

/**
 * Service Worker MLCEngine Handler
 * This handles all communication between client pages and the WebLLM engine
 */
let handler;

/**
 * Activate event - Initialize the handler when SW becomes active
 */
self.addEventListener('activate', (event) => {
	console.log('[WP Neural Admin SW] Service Worker activating...');

	// Create the handler that manages the MLCEngine
	handler = new ServiceWorkerMLCEngineHandler();

	console.log('[WP Neural Admin SW] Service Worker activated and ready');

	// Claim all clients immediately so they can start using this SW
	event.waitUntil(self.clients.claim());
});

/**
 * Install event - Skip waiting to activate immediately
 */
self.addEventListener('install', (event) => {
	console.log('[WP Neural Admin SW] Service Worker installing...');

	// Skip waiting to become active immediately
	event.waitUntil(self.skipWaiting());
});

/**
 * Fetch event - We don't intercept fetches, just log for debugging
 * The ServiceWorkerMLCEngineHandler handles message-based communication
 */
self.addEventListener('fetch', (event) => {
	// Let all fetch requests pass through normally
	// WebLLM model fetching is handled internally by the engine
});
