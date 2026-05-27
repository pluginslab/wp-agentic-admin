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

		// We intentionally use HStack/VStack/etc. for now. Track v0.12 migration
		// to stable APIs separately when @wordpress/components publishes them.
		'@wordpress/no-unsafe-wp-apis': 'warn',

		// Unused vars are noise, not bugs. Track + clean up in a dedicated pass.
		'no-unused-vars': 'warn',

		// JSDoc: missing descriptions/types are downgraded to warnings — the
		// recommended preset is too aggressive for our hybrid JS+JSX codebase.
		'jsdoc/require-returns-description': 'warn',
		'jsdoc/require-param-description': 'warn',
		'jsdoc/require-param-type': 'warn',
		'jsdoc/require-returns-type': 'warn',
		'jsdoc/require-param': 'warn',
		'jsdoc/require-returns': 'warn',

		// JSX type is valid in WordPress component returns
		'jsdoc/no-undefined-types': [
			'error',
			{
				definedTypes: [ 'JSX' ],
			},
		],

		// @wordpress/* packages are WordPress-provided externals, not listed in package.json
		'import/no-extraneous-dependencies': 'off',
		'import/no-unresolved': [
			'error',
			{
				ignore: [ '^@wordpress/' ],
			},
		],
	},
};
