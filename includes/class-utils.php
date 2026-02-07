<?php
/**
 * Utils class
 *
 * @package WPAgenticAdmin
 */

namespace WPAgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Utility class.
 *
 * Provides utility functions for cache management and other helper methods.
 *
 * @since 0.1.0
 */
class Utils {

	/**
	 * Initialize hooks for cache clearing.
	 */
	public static function init_hooks(): void {
		add_action( 'registered_post_type', array( __CLASS__, 'clear_cache' ) );
		add_action( 'unregistered_post_type', array( __CLASS__, 'clear_cache' ) );
	}

	/**
	 * Get post types that support the block editor with caching.
	 *
	 * @return array
	 */
	public static function get_block_editor_post_types(): array {
		$cache_key = 'wp_agentic_admin_post_types';
		$cached    = get_transient( $cache_key );

		if ( false !== $cached && is_array( $cached ) ) {
			return $cached;
		}

		$post_types           = get_post_types( array( 'public' => true ), 'objects' );
		$supported_post_types = array();

		foreach ( $post_types as $pt ) {
			if ( post_type_supports( $pt->name, 'editor' ) ) {
				$supported_post_types[] = array(
					'value' => sanitize_key( $pt->name ),
					'label' => sanitize_text_field( $pt->label ),
				);
			}
		}

		// Cache for 1 hour.
		set_transient( $cache_key, $supported_post_types, HOUR_IN_SECONDS );

		return apply_filters( 'wp_agentic_admin_supported_post_types', $supported_post_types );
	}

	/**
	 * Clear cache helper.
	 */
	public static function clear_cache(): void {
		delete_transient( 'wp_agentic_admin_post_types' );
		delete_transient( 'wp_agentic_admin_cache' );
	}

	/**
	 * Check if WebGPU is likely supported based on user agent.
	 * Note: Actual detection happens client-side.
	 *
	 * @return array
	 */
	public static function get_browser_requirements(): array {
		return array(
			'chrome'  => '113+',
			'edge'    => '113+',
			'firefox' => 'Nightly with flags',
			'safari'  => 'Technology Preview',
		);
	}

	/**
	 * Get the debug log path.
	 *
	 * @return string|false
	 */
	public static function get_debug_log_path() {
		if ( defined( 'WP_DEBUG_LOG' ) && is_string( WP_DEBUG_LOG ) ) {
			return WP_DEBUG_LOG;
		}

		return WP_CONTENT_DIR . '/debug.log';
	}

	/**
	 * Check if debug logging is enabled.
	 *
	 * @return bool
	 */
	public static function is_debug_log_enabled(): bool {
		return defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG;
	}
}
