<?php
/**
 * Ability Manifest — single source of truth for which abilities exist
 * and which are enabled by default.
 *
 * Categories:
 *   - CORE       Always on. Defines what the plugin IS.
 *   - LOCAL_ONLY Registered, but the JS layer hides them from the LLM when
 *                an external AI provider is active (sensitive data must stay local).
 *   - LABS       Opt-in. Preserved for v1.x add-on releases. Off by default
 *                in v0.11+; enable via constant or filter.
 *
 * Re-enable parked abilities globally:
 *
 *     define( 'WP_AGENTIC_ADMIN_ENABLE_LABS', true );
 *
 * Or selectively via filter:
 *
 *     add_filter( 'agentic_admin_enabled_abilities', function( $abilities ) {
 *         $abilities['write-file'] = 'agentic_admin_register_write_file';
 *         return $abilities;
 *     });
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core abilities — always registered.
 *
 * @return array<string, string> Map of ability slug → register function name.
 */
function agentic_admin_core_abilities(): array {
	return array(
		// Diagnostics.
		'site-health'             => 'agentic_admin_register_site_health',

		// Security suite.
		'security-scan'           => 'agentic_admin_register_security_scan',
		'verify-core-checksums'   => 'agentic_admin_register_verify_core_checksums',
		'verify-plugin-checksums' => 'agentic_admin_register_verify_plugin_checksums',
		'file-scan'               => 'agentic_admin_register_file_scan',
		'uploads-scan'            => 'agentic_admin_register_uploads_scan',
		'database-check'          => 'agentic_admin_register_database_check',
		'role-capabilities-check' => 'agentic_admin_register_role_capabilities_check',

		// Troubleshooting.
		'error-log-read'          => 'agentic_admin_register_error_log_read',
		'error-log-search'        => 'agentic_admin_register_error_log_search',
		'cron-list'               => 'agentic_admin_register_cron_list',
		'rewrite-list'            => 'agentic_admin_register_rewrite_list',

		// Inventory.
		'plugin-list'             => 'agentic_admin_register_plugin_list',
		'theme-list'              => 'agentic_admin_register_theme_list',
		'user-list'               => 'agentic_admin_register_user_list',
		'post-list'               => 'agentic_admin_register_post_list',
		'comment-stats'           => 'agentic_admin_register_comment_stats',
		'update-check'            => 'agentic_admin_register_update_check',

		// Maintenance.
		'cache-flush'             => 'agentic_admin_register_cache_flush',
		'transient-flush'         => 'agentic_admin_register_transient_flush',
		'rewrite-flush'           => 'agentic_admin_register_rewrite_flush',
		'db-optimize'             => 'agentic_admin_register_db_optimize',
		'revision-cleanup'        => 'agentic_admin_register_revision_cleanup',

		// Plugin management.
		'plugin-activate'         => 'agentic_admin_register_plugin_activate',
		'plugin-deactivate'       => 'agentic_admin_register_plugin_deactivate',
		'plugin-install'          => 'agentic_admin_register_plugin_install',

		// Knowledge.
		'web-search'              => 'agentic_admin_register_web_search',

		// RAG infrastructure (used by the knowledge base — always on).
		'schema-extract'          => 'agentic_admin_register_schema_extract',
		'wp-api-extract'          => 'agentic_admin_register_wp_api_extract',
		'docs-extract'            => 'agentic_admin_register_docs_extract',
		'codebase-extract'        => 'agentic_admin_register_codebase_extract',
	);
}

/**
 * Local-only abilities — registered server-side, but the JS layer hides
 * them from the LLM whenever an external AI provider is active.
 *
 * Note: wp-config-list is JS-only (no PHP register function) so it lives
 * only in the JS manifest.
 *
 * @return array<string, string>
 */
function agentic_admin_local_only_abilities(): array {
	return array(
		'query-database' => 'agentic_admin_register_query_database',
		'read-file'      => 'agentic_admin_register_read_file',
	);
}

/**
 * Labs (parked) abilities — opt-in via WP_AGENTIC_ADMIN_ENABLE_LABS
 * or the agentic_admin_enabled_abilities filter. Preserved for
 * v1.x add-on releases. Off by default.
 *
 * @return array<string, string>
 */
function agentic_admin_labs_abilities(): array {
	return array(
		'write-file'                => 'agentic_admin_register_write_file',
		// content-generate is JS-only (lives in the JS labs manifest).
		'discover-plugin-abilities' => 'agentic_admin_register_discover_plugin_abilities',
		'run-plugin-ability'        => 'agentic_admin_register_run_plugin_ability',
	);
}

/**
 * Resolve the final list of enabled abilities.
 *
 * Core and local-only abilities always register. Labs only register when
 * the WP_AGENTIC_ADMIN_ENABLE_LABS constant is defined and truthy, or
 * when an entry is added back via the agentic_admin_enabled_abilities
 * filter.
 *
 * @return array<string, string>
 */
function agentic_admin_resolve_enabled_abilities(): array {
	$enabled = array_merge(
		agentic_admin_core_abilities(),
		agentic_admin_local_only_abilities()
	);

	if ( defined( 'WP_AGENTIC_ADMIN_ENABLE_LABS' ) && WP_AGENTIC_ADMIN_ENABLE_LABS ) {
		$enabled = array_merge( $enabled, agentic_admin_labs_abilities() );
	}

	/**
	 * Filter the final list of abilities to register.
	 *
	 * Use this to selectively re-enable a labs ability without flipping
	 * the global WP_AGENTIC_ADMIN_ENABLE_LABS constant:
	 *
	 *     add_filter( 'agentic_admin_enabled_abilities', function ( $abilities ) {
	 *         $abilities['write-file'] = 'agentic_admin_register_write_file';
	 *         return $abilities;
	 *     });
	 *
	 * @since 0.11.0
	 *
	 * @param array<string, string> $enabled Map of slug → register function name.
	 */
	return (array) apply_filters( 'agentic_admin_enabled_abilities', $enabled );
}

/**
 * Whether labs (parked) abilities are enabled this request.
 *
 * @return bool True when WP_AGENTIC_ADMIN_ENABLE_LABS is defined and truthy.
 */
function agentic_admin_labs_enabled(): bool {
	return defined( 'WP_AGENTIC_ADMIN_ENABLE_LABS' ) && WP_AGENTIC_ADMIN_ENABLE_LABS;
}
