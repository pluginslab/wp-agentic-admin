<?php
/**
 * Uninstall script
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// 1. Single Site Cleanup.
delete_option( 'agentic_admin_settings' );
delete_option( 'agentic_admin_version' );
delete_transient( 'agentic_admin_cache' );
delete_transient( 'agentic_admin_post_types' );

// 2. Multisite Cleanup.
if ( is_multisite() ) {
	$wp_agentic_admin_sites = get_sites();

	foreach ( $wp_agentic_admin_sites as $wp_agentic_admin_site ) {
		switch_to_blog( $wp_agentic_admin_site->blog_id );

		delete_option( 'agentic_admin_settings' );
		delete_option( 'agentic_admin_version' );
		delete_transient( 'agentic_admin_cache' );
		delete_transient( 'agentic_admin_post_types' );

		restore_current_blog();
	}
}
