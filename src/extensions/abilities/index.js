/**
 * Abilities Index
 *
 * Exports all ability registration functions.
 * Includes both WP-Agentic-Admin custom abilities and
 * WordPress 6.9+ core ability wrappers.
 */

// WP-Agentic-Admin custom abilities
import { createLogger } from '../utils/logger';
import { registerErrorLogRead } from './error-log-read';

const log = createLogger( 'Abilities' );
import { registerCacheFlush } from './cache-flush';
import { registerDbOptimize } from './db-optimize';
import { registerPluginList } from './plugin-list';
import { registerPluginDeactivate } from './plugin-deactivate';
import { registerPluginActivate } from './plugin-activate';
import { registerSiteHealth } from './site-health';
import { registerTransientFlush } from './transient-flush';
import { registerCronList } from './cron-list';
import { registerRewriteFlush } from './rewrite-flush';
import { registerRewriteList } from './rewrite-list';
import { registerRevisionCleanup } from './revision-cleanup';
import { registerThemeList } from './theme-list';
import { registerUserList } from './user-list';
import { registerUpdateCheck } from './update-check';
import { registerDiskUsage } from './disk-usage';
import { registerCommentStats } from './comment-stats';
import { registerSecurityScan } from './security-scan';
import { registerCoreSiteInfo } from './core-site-info';
import { registerCoreEnvironmentInfo } from './core-environment-info';

// Re-export individual functions for external use
export { registerErrorLogRead } from './error-log-read';
export { registerCacheFlush } from './cache-flush';
export { registerDbOptimize } from './db-optimize';
export { registerPluginList } from './plugin-list';
export { registerPluginDeactivate } from './plugin-deactivate';
export { registerPluginActivate } from './plugin-activate';
export { registerSiteHealth } from './site-health';
export { registerTransientFlush } from './transient-flush';
export { registerCronList } from './cron-list';
export { registerRewriteFlush } from './rewrite-flush';
export { registerRewriteList } from './rewrite-list';
export { registerRevisionCleanup } from './revision-cleanup';
export { registerThemeList } from './theme-list';
export { registerUserList } from './user-list';
export { registerUpdateCheck } from './update-check';
export { registerDiskUsage } from './disk-usage';
export { registerCommentStats } from './comment-stats';
export { registerSecurityScan } from './security-scan';
export { registerCoreSiteInfo } from './core-site-info';
export { registerCoreEnvironmentInfo } from './core-environment-info';

/**
 * Register all abilities.
 *
 * This function is called during initialization to register
 * all abilities with the chat system, including:
 * - WP-Agentic-Admin custom abilities (wp-agentic-admin/*)
 * - WordPress 6.9+ core ability wrappers (core/*)
 */
export function registerAllAbilities() {
	// WP-Agentic-Admin custom abilities
	registerErrorLogRead();
	registerCacheFlush();
	registerDbOptimize();
	registerPluginList();
	registerPluginDeactivate();
	registerPluginActivate();
	registerSiteHealth();
	registerTransientFlush();
	registerCronList();
	registerRewriteFlush();
	registerRewriteList();
	registerRevisionCleanup();
	registerThemeList();
	registerUserList();
	registerUpdateCheck();
	registerDiskUsage();
	registerCommentStats();
	registerSecurityScan();

	// WordPress 6.9+ core ability wrappers
	// These provide chat-friendly interfaces for WordPress core abilities
	// Note: core/get-user-info is not included as it has show_in_rest=false
	registerCoreSiteInfo();
	registerCoreEnvironmentInfo();

	log.info( 'All abilities registered (including WordPress core wrappers)' );
}

export default registerAllAbilities;
