/**
 * Custom Webpack Configuration for Agentic Admin
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

	entry: {
		// Main application bundle
		index: path.resolve( __dirname, 'src/extensions/index.js' ),

		// Gutenberg editor sidebar and admin-wide chat sidebar both disabled
		// for v0.11 — UIs not finished, re-enable in v0.12 once polished.
		// Sources preserved at src/extensions/editor.js and
		// src/extensions/admin-sidebar.js.

		// Service Worker - needs to be a self-contained bundle
		sw: {
			import: path.resolve( __dirname, 'src/extensions/sw.js' ),
			filename: 'sw.js', // Output as sw.js directly, not sw.index.js
		},

		// Whisper Web Worker — source preserved in src/extensions/services/
		// and src/extensions/components/VoiceButton.jsx for v1.4 (per roadmap).
		// Re-add this entry to ship voice input again.
	},

	module: {
		...defaultConfig.module,
		rules: [
			...defaultConfig.module.rules,
			// Strip WebLLM's built-in model download addresses. The site owner
			// configures the model source; see tools/strip-webllm-prebuilt-loader.js.
			{
				test: /[\\/]node_modules[\\/]@mlc-ai[\\/]web-llm[\\/]lib[\\/]index\.js$/,
				use: path.resolve(
					__dirname,
					'tools/strip-webllm-prebuilt-loader.js'
				),
			},
		],
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
				// Don't split the service worker
				sw: false,
			},
		},
		runtimeChunk: false, // SW needs runtime included
	},
};
