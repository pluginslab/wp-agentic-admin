<?php
/**
 * Shared Plugin Helper Functions
 *
 * Common functionality used across plugin-related abilities to avoid code duplication.
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get all installed plugins with their status.
 *
 * @param string $status_filter Optional. Filter by status: 'all', 'active', or 'inactive'. Default 'all'.
 * @return array Array with plugins list and counts.
 */
function wp_agentic_admin_get_all_plugins( string $status_filter = 'all' ): array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins    = get_plugins();
	$active_plugins = get_option( 'active_plugins', array() );
	$plugins        = array();
	$active_count   = 0;

	foreach ( $all_plugins as $plugin_file => $plugin_data ) {
		$is_active = in_array( $plugin_file, $active_plugins, true );

		// Apply status filter.
		if ( 'active' === $status_filter && ! $is_active ) {
			continue;
		}
		if ( 'inactive' === $status_filter && $is_active ) {
			continue;
		}

		if ( $is_active ) {
			++$active_count;
		}

		$plugins[] = array(
			'name'    => $plugin_data['Name'],
			'slug'    => $plugin_file,
			'version' => $plugin_data['Version'],
			'author'  => $plugin_data['Author'],
			'active'  => $is_active,
		);
	}

	return array(
		'plugins' => $plugins,
		'total'   => count( $plugins ),
		'active'  => $active_count,
	);
}

/**
 * Get plugin data by slug.
 *
 * @param string $plugin_file The plugin file path (slug).
 * @return array|null Plugin data array or null if not found.
 */
function wp_agentic_admin_get_plugin_by_slug( string $plugin_file ): ?array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins = get_plugins();

	if ( ! isset( $all_plugins[ $plugin_file ] ) ) {
		return null;
	}

	$is_active = is_plugin_active( $plugin_file );

	return array(
		'name'    => $all_plugins[ $plugin_file ]['Name'],
		'slug'    => $plugin_file,
		'version' => $all_plugins[ $plugin_file ]['Version'],
		'author'  => $all_plugins[ $plugin_file ]['Author'],
		'active'  => $is_active,
	);
}

/**
 * Activate a plugin by its slug.
 *
 * @param string $plugin_file The plugin file path (slug) to activate.
 * @return array Result with success status and message.
 */
function wp_agentic_admin_activate_plugin_by_slug( string $plugin_file ): array {
	$plugin_file = sanitize_text_field( $plugin_file );
	$plugin_data = wp_agentic_admin_get_plugin_by_slug( $plugin_file );

	// Check if plugin exists.
	if ( null === $plugin_data ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin file path */
				__( 'Plugin "%s" not found.', 'wp-agentic-admin' ),
				$plugin_file
			),
		);
	}

	$plugin_name = $plugin_data['name'];

	// Check if already active.
	if ( $plugin_data['active'] ) {
		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already active.', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	// Activate the plugin.
	$result = activate_plugin( $plugin_file );

	// Check if activation failed.
	if ( is_wp_error( $result ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: 1: plugin name, 2: error message */
				__( 'Failed to activate plugin "%1$s": %2$s', 'wp-agentic-admin' ),
				$plugin_name,
				$result->get_error_message()
			),
		);
	}

	// Verify activation.
	if ( ! is_plugin_active( $plugin_file ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Failed to activate plugin "%s".', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	return array(
		'success' => true,
		'message' => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been activated successfully.', 'wp-agentic-admin' ),
			$plugin_name
		),
	);
}

/**
 * Deactivate a plugin by its slug.
 *
 * @param string $plugin_file The plugin file path (slug) to deactivate.
 * @return array Result with success status and message.
 */
function wp_agentic_admin_deactivate_plugin_by_slug( string $plugin_file ): array {
	$plugin_file = sanitize_text_field( $plugin_file );
	$plugin_data = wp_agentic_admin_get_plugin_by_slug( $plugin_file );

	// Check if plugin exists.
	if ( null === $plugin_data ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin file path */
				__( 'Plugin "%s" not found.', 'wp-agentic-admin' ),
				$plugin_file
			),
		);
	}

	$plugin_name = $plugin_data['name'];

	// Check if already inactive.
	if ( ! $plugin_data['active'] ) {
		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already inactive.', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	// Deactivate the plugin.
	deactivate_plugins( $plugin_file );

	// Verify deactivation.
	if ( is_plugin_active( $plugin_file ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Failed to deactivate plugin "%s".', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	return array(
		'success' => true,
		'message' => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been deactivated.', 'wp-agentic-admin' ),
			$plugin_name
		),
	);
}
