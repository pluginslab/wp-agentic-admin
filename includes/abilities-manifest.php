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
 *     add_filter( 'wp_agentic_admin_enabled_abilities', function( $abilities ) {
 *         $abilities['write-file'] = 'wp_agentic_admin_register_write_file';
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
function wp_agentic_admin_core_abilities(): array {
	return array(
		// Diagnostics.
		'site-health'             => 'wp_agentic_admin_register_site_health',

		// Security suite.
		'security-scan'           => 'wp_agentic_admin_register_security_scan',
		'verify-core-checksums'   => 'wp_agentic_admin_register_verify_core_checksums',
		'verify-plugin-checksums' => 'wp_agentic_admin_register_verify_plugin_checksums',
		'file-scan'               => 'wp_agentic_admin_register_file_scan',
		'uploads-scan'            => 'wp_agentic_admin_register_uploads_scan',
		'database-check'          => 'wp_agentic_admin_register_database_check',
		'role-capabilities-check' => 'wp_agentic_admin_register_role_capabilities_check',

		// Troubleshooting.
		'error-log-read'          => 'wp_agentic_admin_register_error_log_read',
		'error-log-search'        => 'wp_agentic_admin_register_error_log_search',
		'cron-list'               => 'wp_agentic_admin_register_cron_list',
		'rewrite-list'            => 'wp_agentic_admin_register_rewrite_list',

		// Inventory.
		'plugin-list'             => 'wp_agentic_admin_register_plugin_list',
		'theme-list'              => 'wp_agentic_admin_register_theme_list',
		'user-list'               => 'wp_agentic_admin_register_user_list',
		'post-list'               => 'wp_agentic_admin_register_post_list',
		'comment-stats'           => 'wp_agentic_admin_register_comment_stats',
		'update-check'            => 'wp_agentic_admin_register_update_check',

		// Maintenance.
		'cache-flush'             => 'wp_agentic_admin_register_cache_flush',
		'transient-flush'         => 'wp_agentic_admin_register_transient_flush',
		'rewrite-flush'           => 'wp_agentic_admin_register_rewrite_flush',
		'db-optimize'             => 'wp_agentic_admin_register_db_optimize',
		'revision-cleanup'        => 'wp_agentic_admin_register_revision_cleanup',

		// Plugin management.
		'plugin-activate'         => 'wp_agentic_admin_register_plugin_activate',
		'plugin-deactivate'       => 'wp_agentic_admin_register_plugin_deactivate',
		'plugin-install'          => 'wp_agentic_admin_register_plugin_install',

		// Knowledge.
		'web-search'              => 'wp_agentic_admin_register_web_search',

		// RAG infrastructure (used by the knowledge base — always on).
		'schema-extract'          => 'wp_agentic_admin_register_schema_extract',
		'wp-api-extract'          => 'wp_agentic_admin_register_wp_api_extract',
		'docs-extract'            => 'wp_agentic_admin_register_docs_extract',
		'codebase-extract'        => 'wp_agentic_admin_register_codebase_extract',
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
function wp_agentic_admin_local_only_abilities(): array {
	return array(
		'query-database' => 'wp_agentic_admin_register_query_database',
		'read-file'      => 'wp_agentic_admin_register_read_file',
	);
}

/**
 * Labs (parked) abilities — opt-in via WP_AGENTIC_ADMIN_ENABLE_LABS
 * or the wp_agentic_admin_enabled_abilities filter. Preserved for
 * v1.x add-on releases. Off by default.
 *
 * @return array<string, string>
 */
function wp_agentic_admin_labs_abilities(): array {
	return array(
		'write-file'                => 'wp_agentic_admin_register_write_file',
		// content-generate is JS-only (lives in the JS labs manifest).
		'discover-plugin-abilities' => 'wp_agentic_admin_register_discover_plugin_abilities',
		'run-plugin-ability'        => 'wp_agentic_admin_register_run_plugin_ability',
	);
}

/**
 * Resolve the final list of enabled abilities.
 *
 * Core and local-only abilities always register. Labs only register when
 * the WP_AGENTIC_ADMIN_ENABLE_LABS constant is defined and truthy, or
 * when an entry is added back via the wp_agentic_admin_enabled_abilities
 * filter.
 *
 * @return array<string, string>
 */
function wp_agentic_admin_resolve_enabled_abilities(): array {
	$enabled = array_merge(
		wp_agentic_admin_core_abilities(),
		wp_agentic_admin_local_only_abilities()
	);

	if ( defined( 'WP_AGENTIC_ADMIN_ENABLE_LABS' ) && WP_AGENTIC_ADMIN_ENABLE_LABS ) {
		$enabled = array_merge( $enabled, wp_agentic_admin_labs_abilities() );
	}

	/**
	 * Filter the final list of abilities to register.
	 *
	 * Use this to selectively re-enable a labs ability without flipping
	 * the global WP_AGENTIC_ADMIN_ENABLE_LABS constant:
	 *
	 *     add_filter( 'wp_agentic_admin_enabled_abilities', function ( $abilities ) {
	 *         $abilities['write-file'] = 'wp_agentic_admin_register_write_file';
	 *         return $abilities;
	 *     });
	 *
	 * @since 0.11.0
	 *
	 * @param array<string, string> $enabled Map of slug → register function name.
	 */
	return (array) apply_filters( 'wp_agentic_admin_enabled_abilities', $enabled );
}

/**
 * Whether labs (parked) abilities are enabled this request.
 *
 * @return bool True when WP_AGENTIC_ADMIN_ENABLE_LABS is defined and truthy.
 */
function wp_agentic_admin_labs_enabled(): bool {
	return defined( 'WP_AGENTIC_ADMIN_ENABLE_LABS' ) && WP_AGENTIC_ADMIN_ENABLE_LABS;
}
