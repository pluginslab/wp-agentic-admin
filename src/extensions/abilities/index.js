/**
 * Abilities Index
 * 
 * Exports all ability registration functions.
 * 
 * @package WPNeuralAdmin
 */

import { registerErrorLogRead } from './error-log-read';
import { registerCacheFlush } from './cache-flush';
import { registerDbOptimize } from './db-optimize';
import { registerPluginList } from './plugin-list';
import { registerPluginDeactivate } from './plugin-deactivate';
import { registerSiteHealth } from './site-health';

// Re-export individual functions for external use
export { registerErrorLogRead } from './error-log-read';
export { registerCacheFlush } from './cache-flush';
export { registerDbOptimize } from './db-optimize';
export { registerPluginList } from './plugin-list';
export { registerPluginDeactivate } from './plugin-deactivate';
export { registerSiteHealth } from './site-health';

/**
 * Register all core abilities.
 * 
 * This function is called during initialization to register
 * all built-in abilities with the chat system.
 */
export function registerAllAbilities() {
    registerErrorLogRead();
    registerCacheFlush();
    registerDbOptimize();
    registerPluginList();
    registerPluginDeactivate();
    registerSiteHealth();

    console.log('[Abilities] All core abilities registered');
}

export default registerAllAbilities;
