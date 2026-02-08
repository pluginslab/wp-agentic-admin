/**
 * Plugin Audit Workflow
 *
 * Helps users understand their plugin landscape and identify potential issues.
 *
 * Steps:
 * 1. List all plugins - get names, versions, active/inactive status
 * 2. Check site health - provides context about the environment
 *
 * WORKFLOW DESIGN NOTES:
 * - Read-only, so no confirmation needed
 * - Inactive plugins are flagged because they're often forgotten and can be
 *   security risks or just clutter
 * - Combines plugin data with environment info for context
 *
 * @since 0.1.0
 */

/**
 * @typedef {import('../services/workflow-registry').StepResult} StepResult
 */

import { registerWorkflow } from '../services/agentic-abilities-api';

/**
 * Register the "Plugin Audit" workflow.
 */
export function registerPluginAuditWorkflow() {
	registerWorkflow( 'wp-agentic-admin/plugin-audit', {
		label: 'Plugin Audit',
		description: 'Lists all plugins and checks for plugin-related issues.',
		keywords: [
			'plugin audit',
			'audit plugins',
			'audit my plugins',
			'check plugins',
			'check my plugins',
			'plugin health',
			'plugin status',
			'review plugins',
			'review my plugins',
			'plugin review',
		],
		steps: [
			{
				abilityId: 'wp-agentic-admin/plugin-list',
				label: 'List all installed plugins',
			},
			{
				abilityId: 'wp-agentic-admin/site-health',
				label: 'Check for plugin-related issues',
			},
		],
		requiresConfirmation: false,

		/**
		 * Generate plugin audit summary.
		 *
		 * This is an example of a data-rich summary that shows:
		 * - Overview counts (total, active, inactive)
		 * - Full plugin lists with versions
		 * - Actionable hints (inactive plugins should be removed)
		 * - Environment context
		 *
		 * @param {StepResult[]} results - Completed step results.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( results ) => {
			const pluginResult = results.find(
				( r ) => r.abilityId === 'wp-agentic-admin/plugin-list'
			);
			const healthResult = results.find(
				( r ) => r.abilityId === 'wp-agentic-admin/site-health'
			);

			let summary = 'Plugin audit complete.\n\n';

			// Plugin data.
			// The plugin-list ability returns: { plugins: [], total: int, active: int }
			// Each plugin has: { name, slug, version, active }
			if ( pluginResult?.success && pluginResult.result ) {
				// Destructure with defaults to handle missing data gracefully.
				const {
					plugins = [],
					total = 0,
					active = 0,
				} = pluginResult.result;
				const inactive = total - active;

				// Show counts first for quick overview.
				summary += `**Plugins Overview:**\n`;
				summary += `- Total: ${ total } plugins\n`;
				summary += `- Active: ${ active }\n`;
				summary += `- Inactive: ${ inactive }${
					inactive > 0 ? ' ⚠️' : ''
				}\n\n`;

				// Show actual plugin names - this is what makes the summary useful.
				if ( plugins.length > 0 ) {
					const activePlugins = plugins.filter( ( p ) => p.active );
					const inactivePlugins = plugins.filter(
						( p ) => ! p.active
					);

					if ( activePlugins.length > 0 ) {
						summary += `**Active Plugins:**\n`;
						activePlugins.forEach( ( p ) => {
							summary += `- ${ p.name } (v${ p.version })\n`;
						} );
						summary += '\n';
					}

					// Flag inactive plugins with actionable advice.
					if ( inactivePlugins.length > 0 ) {
						summary += `**Inactive Plugins** (consider removing):\n`;
						inactivePlugins.forEach( ( p ) => {
							summary += `- ${ p.name } (v${ p.version })\n`;
						} );
						summary += '\n';
					}
				}
			}

			// Add environment context at the end.
			if ( healthResult?.success && healthResult.result ) {
				const h = healthResult.result;
				summary += `**Environment:** WordPress ${
					h.wordpress_version || '?'
				}, PHP ${ h.php_version || '?' }, Theme: ${
					h.active_theme?.name || 'unknown'
				}`;
			}

			return summary;
		},
	} );
}

export default registerPluginAuditWorkflow;
