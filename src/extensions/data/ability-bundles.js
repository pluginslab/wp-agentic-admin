/**
 * Ability Bundles
 *
 * Curated sets of abilities that constrain the LLM to a specific
 * subset of tools. When a bundle is selected, the ReAct agent only
 * sees the bundled tools in its system prompt.
 *
 * @since 0.5.0
 */

const ABILITY_BUNDLES = [
	{
		id: 'plugins-themes',
		label: 'Plugins & Themes',
		icon: 'plugins',
		description: 'Manage extensions and themes',
		abilities: [
			'wp-agentic-admin/plugin-list',
			'wp-agentic-admin/plugin-activate',
			'wp-agentic-admin/plugin-deactivate',
			'wp-agentic-admin/theme-list',
			'wp-agentic-admin/update-check',
		],
	},
	{
		id: 'performance',
		label: 'Performance',
		icon: 'tool',
		description: 'Optimize site speed and resources',
		abilities: [
			'wp-agentic-admin/cache-flush',
			'wp-agentic-admin/transient-flush',
			'wp-agentic-admin/opcode-cache-status',
			'wp-agentic-admin/db-optimize',
			'wp-agentic-admin/revision-cleanup',
			'wp-agentic-admin/cron-list',
			'wp-agentic-admin/rewrite-list',
			'wp-agentic-admin/rewrite-flush',
		],
	},
	{
		id: 'security',
		label: 'Security',
		icon: 'shield',
		description: 'Audit site security and integrity',
		abilities: [
			'wp-agentic-admin/security-scan',
			'wp-agentic-admin/verify-core-checksums',
			'wp-agentic-admin/verify-plugin-checksums',
			'wp-agentic-admin/database-check',
			'wp-agentic-admin/backup-check',
		],
	},
	{
		id: 'troubleshooting',
		label: 'Troubleshooting',
		icon: 'bug',
		description: 'Diagnose errors and site health issues',
		abilities: [
			'wp-agentic-admin/error-log-read',
			'wp-agentic-admin/error-log-search',
			'wp-agentic-admin/site-health',
		],
	},
	{
		id: 'content-users',
		label: 'Content & Users',
		icon: 'post',
		description: 'Manage posts, comments, and users',
		abilities: [
			'wp-agentic-admin/post-list',
			'wp-agentic-admin/comment-stats',
			'wp-agentic-admin/user-list',
			'core/get-editor-blocks',
			'wp-agentic-admin/write-file',
		],
	},
	{
		id: 'site-overview',
		label: 'Site Overview',
		icon: 'info',
		description: 'Get a full picture of your site',
		abilities: [
			'core/get-site-info',
			'core/get-environment-info',
			'wp-agentic-admin/site-health',
			'wp-agentic-admin/disk-usage',
			'wp-agentic-admin/plugin-list',
			'wp-agentic-admin/theme-list',
		],
	},
];

/**
 * Get a bundle definition by ID.
 *
 * @param {string} id - Bundle identifier
 * @return {Object|undefined} The bundle definition or undefined
 */
export function getBundleById( id ) {
	return ABILITY_BUNDLES.find( ( bundle ) => bundle.id === id );
}

export default ABILITY_BUNDLES;
