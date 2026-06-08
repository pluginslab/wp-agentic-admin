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
			'agentic-admin/plugin-list',
			'agentic-admin/plugin-activate',
			'agentic-admin/plugin-deactivate',
			'agentic-admin/plugin-install',
			'agentic-admin/theme-list',
			'agentic-admin/update-check',
		],
	},
	{
		id: 'performance',
		label: 'Performance',
		icon: 'tool',
		description: 'Optimize site speed and resources',
		abilities: [
			'agentic-admin/cache-flush',
			'agentic-admin/transient-flush',
			'agentic-admin/db-optimize',
			'agentic-admin/revision-cleanup',
			'agentic-admin/cron-list',
			'agentic-admin/rewrite-list',
			'agentic-admin/rewrite-flush',
		],
	},
	{
		id: 'security',
		label: 'Security',
		icon: 'shield',
		description: 'Audit site security and integrity',
		abilities: [
			'agentic-admin/security-scan',
			'agentic-admin/verify-core-checksums',
			'agentic-admin/verify-plugin-checksums',
			'agentic-admin/database-check',
		],
	},
	{
		id: 'troubleshooting',
		label: 'Troubleshooting',
		icon: 'bug',
		description: 'Diagnose errors and site health issues',
		abilities: [
			'agentic-admin/error-log-read',
			'agentic-admin/error-log-search',
			'agentic-admin/site-health',
		],
	},
	{
		id: 'content-create',
		label: 'Content',
		icon: 'edit',
		description: 'Review and manage page content',
		abilities: [ 'agentic-admin/post-list' ],
	},
	{
		id: 'content-users',
		label: 'Content & Users',
		icon: 'post',
		description: 'Manage posts, comments, and users',
		abilities: [
			'agentic-admin/post-list',
			'agentic-admin/comment-stats',
			'agentic-admin/user-list',
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
			'agentic-admin/site-health',
			'agentic-admin/plugin-list',
			'agentic-admin/theme-list',
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
