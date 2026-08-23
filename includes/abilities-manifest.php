<?php
/**
 * Ability Manifest — single source of truth for which abilities exist
 * and which are enabled by default.
 *
 * Categories:
 *   - CORE       Always on. Defines what the plugin IS.
 *   - LOCAL_ONLY Registered, but the JS layer hides them from the LLM when
 *                an external AI provider is active (sensitive data must stay local).
 *
 * Site owners can disable individual abilities via the
 * agentic_admin_enabled_abilities filter (see below).
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
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
		'site-health'               => 'agentic_admin_register_site_health',

		// Security suite.
		'security-scan'             => 'agentic_admin_register_security_scan',
		'verify-core-checksums'     => 'agentic_admin_register_verify_core_checksums',
		'verify-plugin-checksums'   => 'agentic_admin_register_verify_plugin_checksums',
		'file-scan'                 => 'agentic_admin_register_file_scan',
		'uploads-scan'              => 'agentic_admin_register_uploads_scan',
		'database-check'            => 'agentic_admin_register_database_check',
		'role-capabilities-check'   => 'agentic_admin_register_role_capabilities_check',

		// Troubleshooting.
		'error-log-read'            => 'agentic_admin_register_error_log_read',
		'error-log-search'          => 'agentic_admin_register_error_log_search',
		'cron-list'                 => 'agentic_admin_register_cron_list',
		'rewrite-list'              => 'agentic_admin_register_rewrite_list',

		// Inventory.
		'plugin-list'               => 'agentic_admin_register_plugin_list',
		'theme-list'                => 'agentic_admin_register_theme_list',
		'user-list'                 => 'agentic_admin_register_user_list',
		'post-list'                 => 'agentic_admin_register_post_list',
		'comment-stats'             => 'agentic_admin_register_comment_stats',
		'update-check'              => 'agentic_admin_register_update_check',

		// Maintenance.
		'cache-flush'               => 'agentic_admin_register_cache_flush',
		'transient-flush'           => 'agentic_admin_register_transient_flush',
		'rewrite-flush'             => 'agentic_admin_register_rewrite_flush',
		'db-optimize'               => 'agentic_admin_register_db_optimize',
		'revision-cleanup'          => 'agentic_admin_register_revision_cleanup',

		// Plugin management.
		'plugin-activate'           => 'agentic_admin_register_plugin_activate',
		'plugin-deactivate'         => 'agentic_admin_register_plugin_deactivate',
		'plugin-install'            => 'agentic_admin_register_plugin_install',

		// Knowledge.
		'web-search'                => 'agentic_admin_register_web_search',

		// RAG infrastructure (used by the knowledge base — always on).
		'schema-extract'            => 'agentic_admin_register_schema_extract',
		'wp-api-extract'            => 'agentic_admin_register_wp_api_extract',
		'docs-extract'              => 'agentic_admin_register_docs_extract',
		'codebase-extract'          => 'agentic_admin_register_codebase_extract',

		// Plugin abilities platform — lets the assistant discover and run
		// abilities that other plugins register via the WordPress Abilities API.
		'discover-plugin-abilities' => 'agentic_admin_register_discover_plugin_abilities',
		'run-plugin-ability'        => 'agentic_admin_register_run_plugin_ability',
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
		'read-file' => 'agentic_admin_register_read_file',
	);
}

/**
 * Resolve the final list of enabled abilities.
 *
 * All abilities are fully functional and registered. Site owners may opt
 * out of individual abilities via the agentic_admin_enabled_abilities filter.
 *
 * @return array<string, string>
 */
function agentic_admin_resolve_enabled_abilities(): array {
	$enabled = array_merge(
		agentic_admin_core_abilities(),
		agentic_admin_local_only_abilities()
	);

	/**
	 * Filter the final list of abilities to register.
	 *
	 * Site owners can use this to disable an ability they do not want the
	 * assistant to use, for example:
	 *
	 *     add_filter( 'agentic_admin_enabled_abilities', function ( $abilities ) {
	 *         unset( $abilities['web-search'] );
	 *         return $abilities;
	 *     });
	 *
	 * @since 0.11.0
	 *
	 * @param array<string, string> $enabled Map of slug → register function name.
	 */
	return (array) apply_filters( 'agentic_admin_enabled_abilities', $enabled );
}
