<?php
/**
 * Shared Plugin Helper Functions
 *
 * Common functionality used across plugin-related abilities to avoid code duplication.
 *
 * @license GPL-2.0-or-later
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

	$actions = array();
	foreach ( $plugins as $plugin ) {
		if ( $plugin['active'] ) {
			$actions[] = array(
				'label'        => $plugin['name'],
				'button_label' => __( 'Deactivate', 'wp-agentic-admin' ),
				'action'       => 'wp-agentic-admin/plugin-deactivate',
				'args'         => array( 'plugin' => $plugin['slug'] ),
			);
		} else {
			$actions[] = array(
				'label'        => $plugin['name'],
				'button_label' => __( 'Activate', 'wp-agentic-admin' ),
				'action'       => 'wp-agentic-admin/plugin-activate',
				'args'         => array( 'plugin' => $plugin['slug'] ),
			);
		}
	}

	return array(
		'plugins' => $plugins,
		'total'   => count( $plugins ),
		'active'  => $active_count,
		'actions' => $actions,
	);
}


/**
 * Resolve a plugin identifier (name, slug, or partial match) to a plugin file path.
 *
 * Uses tiered matching with certainty scoring:
 * - Tier 1 (10.0): Exact slug match (e.g. "akismet/akismet.php")
 * - Tier 2 (9.5):  Exact name match, case-insensitive
 * - Tier 3 (9.0):  Slug directory prefix (e.g. "akismet" matches "akismet/akismet.php")
 * - Tier 4 (8.0):  Name starts with input
 * - Tier 5 (6.0):  Input is substring of name
 * - Tier 6 (5.0):  Name is substring of input
 *
 * If multiple plugins match at the same tier, certainty is reduced by 1.0.
 *
 * @param string $identifier Plugin name, slug, or partial string.
 * @return array {
 *     @type string|null $plugin_file Resolved plugin file path, or null if no match.
 *     @type string|null $plugin_name Display name of the matched plugin.
 *     @type float       $certainty   Match confidence from 1.0 to 10.0.
 *     @type array       $candidates  Top candidates with their certainty scores.
 * }
 */
function    wp_agentic_admin_resolve_plugin( string $identifier ): array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins = get_plugins();
	$input_lower = strtolower( trim( $identifier ) );

	if ( '' === $input_lower ) {
		return array(
			'plugin_file' => null,
			'plugin_name' => null,
			'certainty'   => 0.0,
			'candidates'  => array(),
		);
	}

	// Collect all matches with their tier and certainty.
	$matches = array();

	foreach ( $all_plugins as $plugin_file => $plugin_data ) {
		$name_lower = strtolower( $plugin_data['Name'] );
		$slug_dir   = strtolower( dirname( $plugin_file ) );

		// Tier 1: Exact slug match.
		if ( strtolower( $plugin_file ) === $input_lower ) {
			$matches[] = array(
				'plugin_file' => $plugin_file,
				'plugin_name' => $plugin_data['Name'],
				'tier'        => 1,
				'certainty'   => 10.0,
			);
			continue;
		}

		// Tier 2: Exact name match (case-insensitive).
		if ( $name_lower === $input_lower ) {
			$matches[] = array(
				'plugin_file' => $plugin_file,
				'plugin_name' => $plugin_data['Name'],
				'tier'        => 2,
				'certainty'   => 9.5,
			);
			continue;
		}

		// Tier 3: Slug directory prefix (e.g. "akismet" matches "akismet/akismet.php").
		if ( '.' !== $slug_dir && $slug_dir === $input_lower ) {
			$matches[] = array(
				'plugin_file' => $plugin_file,
				'plugin_name' => $plugin_data['Name'],
				'tier'        => 3,
				'certainty'   => 9.0,
			);
			continue;
		}

		// Tier 4: Name starts with input.
		if ( str_starts_with( $name_lower, $input_lower ) ) {
			$matches[] = array(
				'plugin_file' => $plugin_file,
				'plugin_name' => $plugin_data['Name'],
				'tier'        => 4,
				'certainty'   => 8.0,
			);
			continue;
		}

		// Tier 5: Input is substring of name.
		if ( false !== strpos( $name_lower, $input_lower ) ) {
			$matches[] = array(
				'plugin_file' => $plugin_file,
				'plugin_name' => $plugin_data['Name'],
				'tier'        => 5,
				'certainty'   => 6.0,
			);
			continue;
		}

		// Tier 6: Name is substring of input.
		if ( false !== strpos( $input_lower, $name_lower ) ) {
			$matches[] = array(
				'plugin_file' => $plugin_file,
				'plugin_name' => $plugin_data['Name'],
				'tier'        => 6,
				'certainty'   => 5.0,
			);
			continue;
		}
	}

	if ( empty( $matches ) ) {
		return array(
			'plugin_file' => null,
			'plugin_name' => null,
			'certainty'   => 0.0,
			'candidates'  => array(),
		);
	}

	// Sort by tier (ascending = best first), then by name length (shorter = more specific).
	usort(
		$matches,
		function ( $a, $b ) {
			if ( $a['tier'] !== $b['tier'] ) {
				return $a['tier'] - $b['tier'];
			}
			return strlen( $a['plugin_name'] ) - strlen( $b['plugin_name'] );
		}
	);

	$best      = $matches[0];
	$best_tier = $best['tier'];

	// Count how many matches share the best tier.
	$same_tier_count = 0;
	foreach ( $matches as $match ) {
		if ( $match['tier'] === $best_tier ) {
			++$same_tier_count;
		}
	}

	// Reduce certainty if multiple plugins matched at the same tier.
	if ( $same_tier_count > 1 ) {
		$best['certainty'] = max( 1.0, $best['certainty'] - 1.0 );
	}

	// Build candidates list (top 5).
	$candidates = array_slice( $matches, 0, 5 );

	return array(
		'plugin_file' => $best['plugin_file'],
		'plugin_name' => $best['plugin_name'],
		'certainty'   => $best['certainty'],
		'candidates'  => $candidates,
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
 * Activate a plugin by its slug or name.
 *
 * Accepts either an exact plugin file path (e.g. "akismet/akismet.php") or a
 * display name / partial match. Uses fuzzy resolution with certainty scoring.
 * If certainty is below 8.0, returns action buttons for the top candidates
 * instead of activating.
 *
 * @param string $plugin_identifier The plugin file path, name, or partial match.
 * @return array Result with success status, message, certainty, and optional actions.
 */
function wp_agentic_admin_activate_plugin_by_slug( string $plugin_identifier ): array {
	$plugin_identifier = sanitize_text_field( $plugin_identifier );
	$resolved          = wp_agentic_admin_resolve_plugin( $plugin_identifier );

	// No match at all.
	if ( null === $resolved['plugin_file'] ) {
		return array(
			'success'   => false,
			'message'   => sprintf(
				/* translators: %s: plugin identifier */
				__( 'No plugin found matching "%s".', 'wp-agentic-admin' ),
				$plugin_identifier
			),
			'certainty' => 0.0,
		);
	}

	// Low certainty — return candidates as action buttons.
	if ( $resolved['certainty'] < 8.0 ) {
		return wp_agentic_admin_build_candidate_response(
			$resolved,
			$plugin_identifier,
			'wp-agentic-admin/plugin-activate',
			__( 'Activate', 'wp-agentic-admin' )
		);
	}

	$plugin_file = $resolved['plugin_file'];
	$plugin_name = $resolved['plugin_name'];
	$certainty   = $resolved['certainty'];

	// Check if already active.
	if ( is_plugin_active( $plugin_file ) ) {
		return array(
			'success'        => true,
			'message'        => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already active.', 'wp-agentic-admin' ),
				$plugin_name
			),
			'matched_plugin' => $plugin_name,
			'certainty'      => $certainty,
		);
	}

	// Activate the plugin.
	$result = activate_plugin( $plugin_file );

	// Check if activation failed.
	if ( is_wp_error( $result ) ) {
		return array(
			'success'        => false,
			'message'        => sprintf(
				/* translators: 1: plugin name, 2: error message */
				__( 'Failed to activate plugin "%1$s": %2$s', 'wp-agentic-admin' ),
				$plugin_name,
				$result->get_error_message()
			),
			'matched_plugin' => $plugin_name,
			'certainty'      => $certainty,
		);
	}

	// Verify activation.
	if ( ! is_plugin_active( $plugin_file ) ) {
		return array(
			'success'        => false,
			'message'        => sprintf(
				/* translators: %s: plugin name */
				__( 'Failed to activate plugin "%s".', 'wp-agentic-admin' ),
				$plugin_name
			),
			'matched_plugin' => $plugin_name,
			'certainty'      => $certainty,
		);
	}

	return array(
		'success'        => true,
		'message'        => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been activated successfully.', 'wp-agentic-admin' ),
			$plugin_name
		),
		'matched_plugin' => $plugin_name,
		'certainty'      => $certainty,
	);
}

/**
 * Deactivate a plugin by its slug or name.
 *
 * Accepts either an exact plugin file path (e.g. "akismet/akismet.php") or a
 * display name / partial match. Uses fuzzy resolution with certainty scoring.
 * If certainty is below 8.0, returns action buttons for the top candidates
 * instead of deactivating.
 *
 * @param string $plugin_identifier The plugin file path, name, or partial match.
 * @return array Result with success status, message, certainty, and optional actions.
 */
function wp_agentic_admin_deactivate_plugin_by_slug( string $plugin_identifier ): array {
	$plugin_identifier = sanitize_text_field( $plugin_identifier );
	$resolved          = wp_agentic_admin_resolve_plugin( $plugin_identifier );

	// No match at all.
	if ( null === $resolved['plugin_file'] ) {
		return array(
			'success'   => false,
			'message'   => sprintf(
				/* translators: %s: plugin identifier */
				__( 'No plugin found matching "%s".', 'wp-agentic-admin' ),
				$plugin_identifier
			),
			'certainty' => 0.0,
		);
	}

	// Low certainty — return candidates as action buttons.
	if ( $resolved['certainty'] < 8.0 ) {
		return wp_agentic_admin_build_candidate_response(
			$resolved,
			$plugin_identifier,
			'wp-agentic-admin/plugin-deactivate',
			__( 'Deactivate', 'wp-agentic-admin' )
		);
	}

	$plugin_file = $resolved['plugin_file'];
	$plugin_name = $resolved['plugin_name'];
	$certainty   = $resolved['certainty'];

	// Check if already inactive.
	if ( ! is_plugin_active( $plugin_file ) ) {
		return array(
			'success'        => true,
			'message'        => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already inactive.', 'wp-agentic-admin' ),
				$plugin_name
			),
			'matched_plugin' => $plugin_name,
			'certainty'      => $certainty,
		);
	}

	// Deactivate the plugin.
	deactivate_plugins( $plugin_file );

	// Verify deactivation.
	if ( is_plugin_active( $plugin_file ) ) {
		return array(
			'success'        => false,
			'message'        => sprintf(
				/* translators: %s: plugin name */
				__( 'Failed to deactivate plugin "%s".', 'wp-agentic-admin' ),
				$plugin_name
			),
			'matched_plugin' => $plugin_name,
			'certainty'      => $certainty,
		);
	}

	return array(
		'success'        => true,
		'message'        => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been deactivated.', 'wp-agentic-admin' ),
			$plugin_name
		),
		'matched_plugin' => $plugin_name,
		'certainty'      => $certainty,
	);
}

/**
 * Build a response with candidate action buttons when certainty is low.
 *
 * Returns a structured response with action buttons for the top plugin
 * candidates, allowing the user to select the correct one.
 *
 * @param array  $resolved         Result from wp_agentic_admin_resolve_plugin().
 * @param string $original_input   The user's original input string.
 * @param string $action_id        The ability action ID (e.g. "wp-agentic-admin/plugin-activate").
 * @param string $button_label     Label for the action button (e.g. "Activate").
 * @return array Response with actions for UI buttons.
 */
function wp_agentic_admin_build_candidate_response( array $resolved, string $original_input, string $action_id, string $button_label ): array {
	$actions = array();

	foreach ( $resolved['candidates'] as $candidate ) {
		$actions[] = array(
			'label'        => sprintf( '%s (%.1f/10)', $candidate['plugin_name'], $candidate['certainty'] ),
			'button_label' => $button_label,
			'action'       => $action_id,
			'args'         => array( 'plugin' => $candidate['plugin_file'] ),
		);
	}

	return array(
		'success'   => false,
		'message'   => sprintf(
			/* translators: %s: user input */
			__( 'Multiple plugins match "%s". Please select the correct one:', 'wp-agentic-admin' ),
			$original_input
		),
		'certainty' => $resolved['certainty'],
		'actions'   => $actions,
	);
}
