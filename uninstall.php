<?php
/**
 * Uninstall script
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// 1. Single Site Cleanup.
delete_option( 'wp_agentic_admin_settings' );
delete_option( 'wp_agentic_admin_version' );
delete_transient( 'wp_agentic_admin_cache' );
delete_transient( 'wp_agentic_admin_post_types' );

// 2. Multisite Cleanup.
if ( is_multisite() ) {
	$sites = get_sites();

	foreach ( $sites as $site ) {
		switch_to_blog( $site->blog_id );

		delete_option( 'wp_agentic_admin_settings' );
		delete_option( 'wp_agentic_admin_version' );
		delete_transient( 'wp_agentic_admin_cache' );
		delete_transient( 'wp_agentic_admin_post_types' );

		restore_current_blog();
	}
}
