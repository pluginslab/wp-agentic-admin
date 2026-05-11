/**
 * Custom Webpack Configuration for WP Agentic Admin
 *
 * Extends the default @wordpress/scripts config to add:
 * - Service Worker as a separate entry point (no chunking, self-contained)
 *
 * @package
 */

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,

	// Enable WASM support for voy-search vector database.
	experiments: {
		...( defaultConfig.experiments || {} ),
		asyncWebAssembly: true,
	},

	entry: {
		// Main application bundle
		index: path.resolve( __dirname, 'src/extensions/index.js' ),

		// Block editor sidebar plugin
		editor: path.resolve( __dirname, 'src/extensions/editor.js' ),

		// Admin-wide chat sidebar (all wp-admin pages)
		'admin-sidebar': path.resolve(
			__dirname,
			'src/extensions/admin-sidebar.js'
		),

		// Service Worker - needs to be a self-contained bundle
		sw: {
			import: path.resolve( __dirname, 'src/extensions/sw.js' ),
			filename: 'sw.js', // Output as sw.js directly, not sw.index.js
		},

		// Whisper Web Worker — source preserved in src/extensions/services/
		// and src/extensions/components/VoiceButton.jsx for v1.4 (per roadmap).
		// Re-add this entry to ship voice input again.

		// Indexing Web Worker - background embedding + Voy indexing
		'indexing-worker': {
			import: path.resolve(
				__dirname,
				'src/extensions/services/indexing-worker.js'
			),
			filename: 'indexing-worker.js',
		},
	},

	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'build-extensions' ),
	},

	// Service Worker specific optimizations
	optimization: {
		...defaultConfig.optimization,
		// Prevent code splitting for SW - it needs to be self-contained
		splitChunks: {
			...defaultConfig.optimization?.splitChunks,
			cacheGroups: {
				...defaultConfig.optimization?.splitChunks?.cacheGroups,
				// Don't split the service worker or web workers
				sw: false,
				'indexing-worker': false,
			},
		},
		runtimeChunk: false, // SW needs runtime included
	},
};
