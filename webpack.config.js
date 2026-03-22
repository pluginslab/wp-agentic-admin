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
const webpack = require( 'webpack' );

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
	},

	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'build-extensions' ),
	},

	// Always inline FEEDBACK_S3_ENDPOINT at build time so `process.env.*` is
	// never a runtime reference in the browser (process is not defined there).
	plugins: [
		...( defaultConfig.plugins || [] ),
		new webpack.DefinePlugin( {
			'process.env.FEEDBACK_S3_ENDPOINT': JSON.stringify(
				process.env.FEEDBACK_S3_ENDPOINT || ''
			),
		} ),
	],

	// Service Worker specific optimizations
	optimization: {
		...defaultConfig.optimization,
		// Prevent code splitting for SW - it needs to be self-contained
		splitChunks: {
			...defaultConfig.optimization?.splitChunks,
			cacheGroups: {
				...defaultConfig.optimization?.splitChunks?.cacheGroups,
				// Don't split the service worker
				sw: false,
			},
		},
		runtimeChunk: false, // SW needs runtime included
	},
};
