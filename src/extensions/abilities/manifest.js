/**
 * JS Ability Registrar Manifest
 *
 * Maps ability slug → JS register function. Mirrors the PHP manifest
 * (includes/abilities-manifest.php).
 *
 * Categories match the PHP side:
 *   - CORE       Always on. Defines what the plugin IS.
 *   - LOCAL_ONLY Hidden from the LLM when an external AI provider is active.
 *   - LABS       Opt-in. Preserved for v1.x add-on releases. Off by default
 *                in v0.11+ (enabled via PHP's WP_AGENTIC_ADMIN_ENABLE_LABS
 *                constant or the wp_agentic_admin_enabled_abilities filter).
 *
 * NOTE for PR 1: REGISTRARS contains every ability so behavior is unchanged.
 * The category sets exist for future use by PR 4 (which will read the
 * filtered list from window.wpAgenticAdmin.enabledAbilities).
 */

import { registerErrorLogRead } from './error-log-read';
import { registerCacheFlush } from './cache-flush';
import { registerDbOptimize } from './db-optimize';
import { registerPluginList } from './plugin-list';
import { registerPluginDeactivate } from './plugin-deactivate';
import { registerPluginActivate } from './plugin-activate';
import { registerPluginInstall } from './plugin-install';
import { registerSiteHealth } from './site-health';
import { registerTransientFlush } from './transient-flush';
import { registerCronList } from './cron-list';
import { registerRewriteFlush } from './rewrite-flush';
import { registerRewriteList } from './rewrite-list';
import { registerRevisionCleanup } from './revision-cleanup';
import { registerThemeList } from './theme-list';
import { registerCurrentUserRole } from './current-user-role';
import { registerUserList } from './user-list';
import { registerUpdateCheck } from './update-check';
import { registerCommentStats } from './comment-stats';
import { registerSecurityScan } from './security-scan';
import { registerPostList } from './post-list';
import { registerErrorLogSearch } from './error-log-search';
import { registerWebSearch } from './web-search';
import { registerCoreSiteInfo } from './core-site-info';
import { registerCoreEnvironmentInfo } from './core-environment-info';
import { registerVerifyCoreChecksums } from './verify-core-checksums';
import { registerVerifyPluginChecksums } from './verify-plugin-checksums';
import { registerDatabaseCheck } from './database-check';
import { registerFileScan } from './file-scan';
import { registerRoleCapabilitiesCheck } from './role-capabilities-check';
import { registerCodebaseIndex } from './codebase-index';
import { registerCodeSearch } from './code-search';

// Local-only abilities (hidden from LLM when external provider is active).
import { registerQueryDatabase } from './query-database';
import { registerReadFile } from './read-file';
import { registerWpConfigList } from './wp-config-list';

// Labs (parked) abilities — still imported so they ship in the bundle;
// off by default once PR 4 flips the resolve() to exclude labs.
import { registerWriteFile } from './write-file';
import { registerContentGenerate } from './content-generate';
import { registerDiscoverPluginAbilities } from './discover-plugin-abilities';
import { registerRunPluginAbility } from './run-plugin-ability';

/**
 * Full registrar lookup. Iteration order is preserved (modern JS objects
 * keep insertion order), which becomes the LLM tool-listing order.
 */
export const REGISTRARS = {
	// CORE — diagnostics.
	'site-health': registerSiteHealth,
	'current-user-role': registerCurrentUserRole,
	'core-site-info': registerCoreSiteInfo,
	'core-environment-info': registerCoreEnvironmentInfo,

	// CORE — security suite.
	'security-scan': registerSecurityScan,
	'verify-core-checksums': registerVerifyCoreChecksums,
	'verify-plugin-checksums': registerVerifyPluginChecksums,
	'file-scan': registerFileScan,
	'database-check': registerDatabaseCheck,
	'role-capabilities-check': registerRoleCapabilitiesCheck,

	// CORE — troubleshooting.
	'error-log-read': registerErrorLogRead,
	'error-log-search': registerErrorLogSearch,
	'cron-list': registerCronList,
	'rewrite-list': registerRewriteList,

	// CORE — inventory.
	'plugin-list': registerPluginList,
	'theme-list': registerThemeList,
	'user-list': registerUserList,
	'post-list': registerPostList,
	'comment-stats': registerCommentStats,
	'update-check': registerUpdateCheck,

	// CORE — maintenance.
	'cache-flush': registerCacheFlush,
	'transient-flush': registerTransientFlush,
	'rewrite-flush': registerRewriteFlush,
	'db-optimize': registerDbOptimize,
	'revision-cleanup': registerRevisionCleanup,

	// CORE — plugin management.
	'plugin-activate': registerPluginActivate,
	'plugin-deactivate': registerPluginDeactivate,
	'plugin-install': registerPluginInstall,

	// CORE — knowledge.
	'web-search': registerWebSearch,
	'codebase-index': registerCodebaseIndex,
	'code-search': registerCodeSearch,

	// LOCAL_ONLY — sensitive abilities.
	'query-database': registerQueryDatabase,
	'read-file': registerReadFile,
	'wp-config-list': registerWpConfigList,

	// LABS — opt-in.
	'write-file': registerWriteFile,
	'content-generate': registerContentGenerate,
	'discover-plugin-abilities': registerDiscoverPluginAbilities,
	'run-plugin-ability': registerRunPluginAbility,
};

/**
 * Abilities hidden from the LLM when an external AI provider is active.
 * Used by future tool-filter logic (issue: external-provider safety).
 */
export const LOCAL_ONLY_ABILITIES = new Set( [
	'query-database',
	'read-file',
	'wp-config-list',
] );

/**
 * Abilities parked for v1.x add-on releases.
 */
export const LABS_ABILITIES = new Set( [
	'write-file',
	'content-generate',
	'discover-plugin-abilities',
	'run-plugin-ability',
] );
