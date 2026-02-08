/**
 * Database Maintenance Workflow
 *
 * Optimizes database tables and clears caches for best results.
 *
 * Steps:
 * 1. Optimize database - runs OPTIMIZE TABLE on all WordPress tables
 * 2. Clear caches - ensures cached queries are refreshed with optimized tables
 *
 * WORKFLOW DESIGN NOTES:
 * - Requires confirmation because it modifies the database
 * - Cache clear comes AFTER optimization so queries are re-cached against
 *   the optimized tables
 * - Shows actual table names to prove work was done
 *
 * @since 0.1.0
 */

/**
 * @typedef {import('../services/workflow-registry').StepResult} StepResult
 */

import { registerWorkflow } from '../services/agentic-abilities-api';

/**
 * Register the "Database Maintenance" workflow.
 */
export function registerDatabaseMaintenanceWorkflow() {
	registerWorkflow( 'wp-agentic-admin/database-maintenance', {
		label: 'Database Maintenance',
		description: 'Optimizes the database and clears related caches.',
		keywords: [
			'database maintenance',
			'db maintenance',
			'optimize database',
			'database cleanup',
			'db cleanup',
			'fix database',
			'repair database',
		],
		steps: [
			{
				abilityId: 'wp-agentic-admin/db-optimize',
				label: 'Optimize database tables',
			},
			{
				abilityId: 'wp-agentic-admin/cache-flush',
				label: 'Clear caches after optimization',
			},
		],
		requiresConfirmation: true,
		confirmationMessage:
			'This will optimize database tables and clear caches. Continue?',

		/**
		 * Generate database maintenance summary.
		 *
		 * Shows concrete evidence of work done (table count, table names).
		 * This builds user trust - they can see exactly what happened.
		 *
		 * @param {StepResult[]} results - Completed step results.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( results ) => {
			const dbResult = results.find(
				( r ) => r.abilityId === 'wp-agentic-admin/db-optimize'
			);
			const cacheResult = results.find(
				( r ) => r.abilityId === 'wp-agentic-admin/cache-flush'
			);

			let summary = 'Database maintenance complete.\n\n';

			// Database optimization results.
			// The db-optimize ability returns: { success, tablesOptimized, tables: [] }
			if ( dbResult?.success && dbResult.result ) {
				const { tablesOptimized = 0, tables = [] } = dbResult.result;
				summary += `✓ **Optimized ${ tablesOptimized } tables**\n`;

				// Show some table names as proof of work.
				// Limit to 5 to keep the summary manageable.
				if ( tables.length > 0 ) {
					const displayTables = tables.slice( 0, 5 );
					displayTables.forEach( ( t ) => {
						summary += `  - ${ t }\n`;
					} );
					if ( tables.length > 5 ) {
						summary += `  - ...and ${ tables.length - 5 } more\n`;
					}
				}
				summary += '\n';
			} else {
				summary += `✗ **Database optimization failed**\n\n`;
			}

			// Cache clear confirmation.
			if ( cacheResult?.success ) {
				summary += `✓ **Cache cleared** after optimization`;
			} else {
				summary += `✗ **Cache clear failed**`;
			}

			return summary;
		},
	} );
}

export default registerDatabaseMaintenanceWorkflow;
