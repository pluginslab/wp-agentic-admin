/**
 * Abilities Index
 * 
 * Exports all ability registration functions.
 * Includes both WP-Neural-Admin custom abilities and
 * WordPress 6.9+ core ability wrappers.
 * 
 * @package WPNeuralAdmin
 */

// WP-Neural-Admin custom abilities
import { registerErrorLogRead } from './error-log-read';
import { registerCacheFlush } from './cache-flush';
import { registerDbOptimize } from './db-optimize';
import { registerPluginList } from './plugin-list';
import { registerPluginDeactivate } from './plugin-deactivate';
import { registerSiteHealth } from './site-health';
// v1.2.0: New WP-CLI-inspired abilities
import { registerTransientFlush } from './transient-flush';
import { registerCronList } from './cron-list';
import { registerRewriteFlush } from './rewrite-flush';
import { registerRevisionCleanup } from './revision-cleanup';
// v1.2.0: WordPress 6.9+ core ability wrappers
import { registerCoreSiteInfo } from './core-site-info';
import { registerCoreEnvironmentInfo } from './core-environment-info';

// Re-export individual functions for external use
export { registerErrorLogRead } from './error-log-read';
export { registerCacheFlush } from './cache-flush';
export { registerDbOptimize } from './db-optimize';
export { registerPluginList } from './plugin-list';
export { registerPluginDeactivate } from './plugin-deactivate';
export { registerSiteHealth } from './site-health';
// v1.2.0: New WP-CLI-inspired abilities
export { registerTransientFlush } from './transient-flush';
export { registerCronList } from './cron-list';
export { registerRewriteFlush } from './rewrite-flush';
export { registerRevisionCleanup } from './revision-cleanup';
// v1.2.0: WordPress 6.9+ core ability wrappers
export { registerCoreSiteInfo } from './core-site-info';
export { registerCoreEnvironmentInfo } from './core-environment-info';

/**
 * Register all abilities.
 * 
 * This function is called during initialization to register
 * all abilities with the chat system, including:
 * - WP-Neural-Admin custom abilities (wp-neural-admin/*)
 * - WordPress 6.9+ core ability wrappers (core/*)
 */
export function registerAllAbilities() {
    // WP-Neural-Admin custom abilities
    registerErrorLogRead();
    registerCacheFlush();
    registerDbOptimize();
    registerPluginList();
    registerPluginDeactivate();
    registerSiteHealth();
    // v1.2.0: New WP-CLI-inspired abilities
    registerTransientFlush();
    registerCronList();
    registerRewriteFlush();
    registerRevisionCleanup();

    // WordPress 6.9+ core ability wrappers
    // These provide chat-friendly interfaces for WordPress core abilities
    // Note: core/get-user-info is not included as it has show_in_rest=false
    registerCoreSiteInfo();
    registerCoreEnvironmentInfo();

    console.log('[Abilities] All abilities registered (including WordPress core wrappers)');
}

export default registerAllAbilities;
