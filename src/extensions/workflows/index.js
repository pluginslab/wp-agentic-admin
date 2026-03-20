/**
 * Workflows Index
 *
 * Exports all workflow registration functions.
 * Pre-defined multi-step workflows using existing abilities.
 * These workflows are registered during initialization and provide
 * common WordPress maintenance operations.
 *
 * DEVELOPER NOTES:
 * ================
 * Workflows chain multiple abilities together as a single user action.
 * Unlike single abilities (where the LLM generates responses), workflow
 * summaries use the `summarize` function DIRECTLY - the LLM is bypassed.
 *
 * This means your `summarize` function is critical for user experience.
 * A poor summarize function = useless output like "Completed 2 steps".
 * A good summarize function = rich, actionable data shown to the user.
 *
 * Key concepts:
 * - `results` array contains StepResult objects for each completed step
 * - Each StepResult has: abilityId, label, stepIndex, success, result, duration, skipped
 * - The actual data is in `stepResult.result` (whatever the PHP ability returned)
 * - Use `results.find(r => r.abilityId === '...')` to get specific step results
 * - Always check `stepResult?.success` before accessing `stepResult.result`
 * - Check `stepResult?.skipped` to see if step was skipped by includeIf conditions
 *
 * @since 0.1.0
 * @see docs/WORKFLOWS-GUIDE.md for complete documentation
 */

// Import all workflow registration functions
import { registerSiteCleanupWorkflow } from './site-cleanup';
import { registerPerformanceCheckWorkflow } from './performance-check';
import { registerPluginAuditWorkflow } from './plugin-audit';
import { registerDatabaseMaintenanceWorkflow } from './database-maintenance';
import { registerCheckIfHackedWorkflow } from './check-if-hacked';
import { createLogger } from '../utils/logger';

const log = createLogger( 'Workflows' );

// Re-export individual functions for external use
export { registerSiteCleanupWorkflow } from './site-cleanup';
export { registerPerformanceCheckWorkflow } from './performance-check';
export { registerPluginAuditWorkflow } from './plugin-audit';
export { registerDatabaseMaintenanceWorkflow } from './database-maintenance';
export { registerCheckIfHackedWorkflow } from './check-if-hacked';

/**
 * Register all built-in workflows.
 *
 * Called during plugin initialization to register all pre-defined workflows.
 * Third-party plugins can register additional workflows using:
 *   wp.agenticAdmin.registerWorkflow('my-plugin/my-workflow', { ... })
 *
 * @see docs/WORKFLOWS-GUIDE.md for how to create custom workflows
 * @see docs/third-party-integration.md for integration examples
 */
export function registerAllWorkflows() {
	registerSiteCleanupWorkflow();
	registerPerformanceCheckWorkflow();
	registerPluginAuditWorkflow();
	registerDatabaseMaintenanceWorkflow();
	registerCheckIfHackedWorkflow();

	log.info( 'All built-in workflows registered' );
}

export default registerAllWorkflows;
