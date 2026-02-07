/**
 * ESLint Configuration
 * 
 * Extends WordPress coding standards from @wordpress/scripts
 * with temporary overrides for v1.4.1 release.
 * 
 * @since 0.1.0
 */

module.exports = {
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
	rules: {
		// Temporarily allow console statements (will be replaced with logger in v1.4.2)
		'no-console': 'off',
	},
};
