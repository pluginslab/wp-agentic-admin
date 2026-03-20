/**
 * Instruction Definitions
 *
 * Groups existing abilities into domain-specific instruction sets.
 * Each instruction defines which abilities belong to it and what
 * keywords trigger auto-detection from user messages.
 *
 * @since 0.9.6
 */

import instructionRegistry from '../services/instruction-registry';
import { createLogger } from '../utils/logger';

const log = createLogger( 'Instructions' );

/**
 * Register all core instruction sets.
 *
 * Must be called AFTER registerAllAbilities() so that ability IDs exist.
 */
export function registerAllInstructions() {
	instructionRegistry.register( {
		id: 'plugins',
		label: 'Plugin Management',
		description: 'List, activate, and deactivate plugins',
		keywords: [ 'plugin', 'plugins', 'extensions', 'installed' ],
		abilityIds: [
			'wp-agentic-admin/plugin-list',
			'wp-agentic-admin/plugin-activate',
			'wp-agentic-admin/plugin-deactivate',
		],
		context:
			'After listing plugins, tell the user how many are active vs inactive. ' +
			'If they ask to deactivate, confirm the plugin name first. ' +
			'If a plugin is already inactive, say so instead of trying to deactivate it again.',
	} );

	instructionRegistry.register( {
		id: 'cache',
		label: 'Cache & Transients',
		description: 'Flush object cache and transients',
		keywords: [ 'cache', 'transient', 'transients', 'purge' ],
		abilityIds: [
			'wp-agentic-admin/cache-flush',
			'wp-agentic-admin/transient-flush',
		],
	} );

	instructionRegistry.register( {
		id: 'database',
		label: 'Database Maintenance',
		description: 'Optimize database tables and clean up revisions',
		keywords: [ 'database', 'db', 'revision', 'revisions' ],
		abilityIds: [
			'wp-agentic-admin/db-optimize',
			'wp-agentic-admin/revision-cleanup',
		],
		context:
			'Run revision-cleanup before db-optimize — cleaning revisions first makes table optimization more effective. ' +
			'Report how many revisions were found and how much space can be freed before confirming deletion.',
	} );

	instructionRegistry.register( {
		id: 'diagnostics',
		label: 'Site Diagnostics',
		description: 'Site health, error logs, and environment info',
		keywords: [
			'health',
			'error',
			'errors',
			'log',
			'logs',
			'debug',
			'environment',
			'diagnostics',
			'broken',
			'white screen',
			'crash',
			'not working',
			'slow',
			'performance',
			'speed',
		],
		abilityIds: [
			'wp-agentic-admin/site-health',
			'wp-agentic-admin/error-log-read',
			'core/get-site-info',
			'core/get-environment-info',
		],
		context:
			'Start with error-log-read when the user reports something broken — the error log is the fastest way to find the cause. ' +
			'Use site-health when the user asks about versions, memory, or general status. ' +
			'If the error log mentions a plugin file path, suggest loading the plugins instruction to investigate further.',
	} );

	instructionRegistry.register( {
		id: 'routing',
		label: 'URL Routing',
		description: 'List and flush rewrite rules',
		keywords: [
			'rewrite',
			'rewrite rules',
			'permalink',
			'permalinks',
			'url',
			'routing',
		],
		abilityIds: [
			'wp-agentic-admin/rewrite-list',
			'wp-agentic-admin/rewrite-flush',
		],
	} );

	instructionRegistry.register( {
		id: 'cron',
		label: 'Scheduled Tasks',
		description: 'List WordPress cron jobs and scheduled tasks',
		keywords: [ 'cron', 'schedule', 'scheduled', 'task', 'tasks' ],
		abilityIds: [ 'wp-agentic-admin/cron-list' ],
	} );

	log.info(
		`Registered ${ instructionRegistry.getAll().length } instruction sets`
	);
}

export default registerAllInstructions;
