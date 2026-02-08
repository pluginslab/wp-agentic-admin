/**
 * ESLint Configuration
 *
 * Extends WordPress coding standards from @wordpress/scripts.
 *
 * @since 0.1.0
 */

module.exports = {
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
	env: {
		browser: true,
		es2021: true,
		node: true,
		worker: true, // For Service Worker (self global)
		jest: true, // For test files (describe, it, expect, etc.)
	},
	globals: {
		wpAgenticAdmin: 'readonly',
	},
	rules: {
		// Allow console statements (useful for debugging AI agent behavior)
		'no-console': 'off',

		// Allow nested ternary in specific cases (model loader status messages)
		'no-nested-ternary': 'warn',

		// JSDoc: Make missing descriptions a warning instead of error
		'jsdoc/require-returns-description': 'warn',
		'jsdoc/require-param-description': 'warn',
	},
};
