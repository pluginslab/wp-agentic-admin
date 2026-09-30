<?php
/**
 * Uninstall script
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Delete the connector rate-limit counters (one option row per user per minute).
 *
 * @return void
 */
function agentic_admin_delete_rate_limit_counters(): void {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- One-off cleanup on uninstall.
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
			$wpdb->esc_like( 'agentic_admin_conn_rl_' ) . '%'
		)
	);
}

// 1. Single Site Cleanup.
agentic_admin_delete_rate_limit_counters();
delete_option( 'agentic_admin_settings' );
delete_option( 'agentic_admin_model_source' );
delete_option( 'agentic_admin_version' );
delete_transient( 'agentic_admin_cache' );
delete_transient( 'agentic_admin_post_types' );

// 2. Multisite Cleanup.
if ( is_multisite() ) {
	$agentic_admin_sites = get_sites();

	foreach ( $agentic_admin_sites as $agentic_admin_site ) {
		switch_to_blog( $agentic_admin_site->blog_id );

		agentic_admin_delete_rate_limit_counters();
		delete_option( 'agentic_admin_settings' );
		delete_option( 'agentic_admin_model_source' );
		delete_option( 'agentic_admin_version' );
		delete_transient( 'agentic_admin_cache' );
		delete_transient( 'agentic_admin_post_types' );

		restore_current_blog();
	}
}
