<?php
/**
 * Role Capabilities Check Ability
 *
 * Compares the current site's role capabilities against WordPress defaults.
 * Detects privilege escalation (e.g., subscribers with admin capabilities),
 * extra roles, and modified capabilities.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the role-capabilities-check ability.
 *
 * @return void
 */
function wp_agentic_admin_register_role_capabilities_check(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/role-capabilities-check',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Check Role Capabilities', 'wp-agentic-admin' ),
			'description'         => __( 'Compare site role capabilities against WordPress defaults to detect privilege escalation or tampering.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(),
				'properties'           => array(),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'      => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the check completed.', 'wp-agentic-admin' ),
					),
					'message'      => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'total_issues' => array(
						'type'        => 'integer',
						'description' => __( 'Total differences found.', 'wp-agentic-admin' ),
					),
					'roles'        => array(
						'type'        => 'array',
						'description' => __( 'Per-role comparison results.', 'wp-agentic-admin' ),
					),
					'extra_roles'  => array(
						'type'        => 'array',
						'description' => __( 'Roles that do not exist in default WordPress.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_role_capabilities_check',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'    => true,
					'destructive' => false,
					'idempotent'  => true,
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'       => array( 'role', 'roles', 'capabilities', 'permissions', 'privilege', 'escalation', 'user role', 'subscriber', 'editor', 'admin capabilities' ),
			'initialMessage' => __( 'Comparing role capabilities against WordPress defaults...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the role-capabilities-check ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_role_capabilities_check( array $input = array() ): array {
	// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Required parameter for callback signature.
	$defaults     = wp_agentic_admin_get_default_role_capabilities();
	$current      = wp_roles()->roles;
	$roles_result = array();
	$total_issues = 0;
	$extra_roles  = array();

	// Check each default role against the current site.
	foreach ( $defaults as $role_slug => $default_caps ) {
		if ( ! isset( $current[ $role_slug ] ) ) {
			// Default role was removed — this is legitimate hardening, skip it.
			continue;
		}

		$current_caps = array_keys( array_filter( $current[ $role_slug ]['capabilities'] ?? array() ) );
		$default_list = array_keys( $default_caps );

		$added   = array_values( array_diff( $current_caps, $default_list ) );
		$removed = array_values( array_diff( $default_list, $current_caps ) );

		if ( empty( $added ) && empty( $removed ) ) {
			$roles_result[] = array(
				'role'      => $role_slug,
				'role_name' => $current[ $role_slug ]['name'],
				'status'    => 'default',
				'added'     => array(),
				'removed'   => array(),
			);
			continue;
		}

		++$total_issues;

		// Risk depends on which role gained capabilities.
		$risk = wp_agentic_admin_calculate_role_risk( $role_slug, $added, $removed );

		$roles_result[] = array(
			'role'       => $role_slug,
			'role_name'  => $current[ $role_slug ]['name'],
			'status'     => 'modified',
			'added'      => $added,
			'removed'    => $removed,
			'risk_score' => $risk,
		);
	}

	// Detect non-default roles (from plugins, or attacker-created).
	$default_slugs = array_keys( $defaults );
	foreach ( $current as $role_slug => $role_data ) {
		if ( in_array( $role_slug, $default_slugs, true ) ) {
			continue;
		}

		$caps = array_keys( array_filter( $role_data['capabilities'] ?? array() ) );

		// Dangerous capabilities that indicate admin-level access.
		$dangerous_caps  = array( 'manage_options', 'edit_users', 'install_plugins', 'edit_plugins', 'delete_users', 'create_users', 'update_core', 'activate_plugins' );
		$has_admin_caps  = ! empty( array_intersect( $caps, $dangerous_caps ) );

		$extra_roles[] = array(
			'role'         => $role_slug,
			'role_name'    => $role_data['name'],
			'capabilities' => $caps,
			'cap_count'    => count( $caps ),
			'has_admin'    => $has_admin_caps,
			'risk_score'   => $has_admin_caps ? 8.0 : 3.0,
		);
	}

	if ( 0 === $total_issues && empty( $extra_roles ) ) {
		$message = __( 'All default WordPress roles match their expected capabilities. No modifications detected.', 'wp-agentic-admin' );
	} else {
		$parts = array();
		if ( $total_issues > 0 ) {
			$parts[] = sprintf(
				/* translators: %d: number of modified roles */
				_n( '%d default role modified', '%d default roles modified', $total_issues, 'wp-agentic-admin' ),
				$total_issues
			);
		}
		if ( ! empty( $extra_roles ) ) {
			$parts[] = sprintf(
				/* translators: %d: number of extra roles */
				_n( '%d non-default role found', '%d non-default roles found', count( $extra_roles ), 'wp-agentic-admin' ),
				count( $extra_roles )
			);
		}
		$message = sprintf(
			/* translators: %s: details */
			__( 'Role capabilities check: %s.', 'wp-agentic-admin' ),
			implode( ', ', $parts )
		);
	}

	return array(
		'success'      => true,
		'message'      => $message,
		'total_issues' => $total_issues,
		'roles'        => $roles_result,
		'extra_roles'  => $extra_roles,
	);
}

/**
 * Calculate risk score for a modified default role.
 *
 * Subscribers and contributors gaining capabilities is high risk.
 * Editors gaining admin-level capabilities is medium-high risk.
 * Removed capabilities are low risk (usually intentional hardening).
 *
 * @param string $role_slug Role slug.
 * @param array  $added     Capabilities added beyond defaults.
 * @param array  $removed   Capabilities removed from defaults.
 * @return float Risk score 1.0–10.0.
 */
function wp_agentic_admin_calculate_role_risk( string $role_slug, array $added, array $removed ): float {
	if ( empty( $added ) ) {
		// Only removals — likely intentional hardening.
		return 3.0;
	}

	// Dangerous capabilities that should never appear on low-privilege roles.
	$dangerous = array( 'manage_options', 'edit_users', 'install_plugins', 'edit_plugins', 'delete_users', 'create_users', 'update_core', 'activate_plugins', 'edit_themes', 'switch_themes' );

	$has_dangerous = ! empty( array_intersect( $added, $dangerous ) );

	// Risk by role — lower-privilege roles are higher risk when escalated.
	$role_risk_base = array(
		'subscriber'  => 9.0,
		'contributor' => 8.5,
		'author'      => 7.0,
		'editor'      => 6.5,
		'administrator' => 4.0,
	);

	$base = $role_risk_base[ $role_slug ] ?? 6.0;

	// If dangerous capabilities were added, use the base risk.
	// Otherwise reduce by 2 (non-dangerous additions are less alarming).
	return $has_dangerous ? $base : max( 3.0, $base - 2.0 );
}

/**
 * Get the default WordPress role capabilities.
 *
 * These are the capabilities assigned by WordPress core during installation.
 *
 * @see wp-admin/includes/schema.php populate_roles()
 *
 * @return array Associative array of role => capabilities (cap => true).
 */
function wp_agentic_admin_get_default_role_capabilities(): array {
	/**
	 * Filters the default role capabilities used as the baseline comparison.
	 *
	 * @since 0.9.6
	 *
	 * @param array $defaults Associative array of role => capabilities.
	 */
	return apply_filters( 'wp_agentic_admin_default_role_capabilities', array(
		'administrator' => array(
			'switch_themes'          => true,
			'edit_themes'            => true,
			'activate_plugins'       => true,
			'edit_plugins'           => true,
			'edit_users'             => true,
			'edit_files'             => true,
			'manage_options'         => true,
			'moderate_comments'      => true,
			'manage_categories'      => true,
			'manage_links'           => true,
			'upload_files'           => true,
			'import'                 => true,
			'unfiltered_html'        => true,
			'edit_posts'             => true,
			'edit_others_posts'      => true,
			'edit_published_posts'   => true,
			'publish_posts'          => true,
			'edit_pages'             => true,
			'read'                   => true,
			'level_10'               => true,
			'level_9'                => true,
			'level_8'                => true,
			'level_7'                => true,
			'level_6'                => true,
			'level_5'                => true,
			'level_4'                => true,
			'level_3'                => true,
			'level_2'                => true,
			'level_1'                => true,
			'level_0'                => true,
			'edit_others_pages'      => true,
			'edit_published_pages'   => true,
			'publish_pages'          => true,
			'delete_pages'           => true,
			'delete_others_pages'    => true,
			'delete_published_pages' => true,
			'delete_posts'           => true,
			'delete_others_posts'    => true,
			'delete_published_posts' => true,
			'delete_private_posts'   => true,
			'edit_private_posts'     => true,
			'read_private_posts'     => true,
			'delete_private_pages'   => true,
			'edit_private_pages'     => true,
			'read_private_pages'     => true,
			'delete_users'           => true,
			'create_users'           => true,
			'unfiltered_upload'      => true,
			'edit_dashboard'         => true,
			'update_plugins'         => true,
			'delete_plugins'         => true,
			'install_plugins'        => true,
			'update_themes'          => true,
			'install_themes'         => true,
			'update_core'            => true,
			'list_users'             => true,
			'remove_users'           => true,
			'promote_users'          => true,
			'edit_theme_options'     => true,
			'delete_themes'          => true,
			'export'                 => true,
		),
		'editor'        => array(
			'moderate_comments'      => true,
			'manage_categories'      => true,
			'manage_links'           => true,
			'upload_files'           => true,
			'unfiltered_html'        => true,
			'edit_posts'             => true,
			'edit_others_posts'      => true,
			'edit_published_posts'   => true,
			'publish_posts'          => true,
			'edit_pages'             => true,
			'read'                   => true,
			'level_7'                => true,
			'level_6'                => true,
			'level_5'                => true,
			'level_4'                => true,
			'level_3'                => true,
			'level_2'                => true,
			'level_1'                => true,
			'level_0'                => true,
			'edit_others_pages'      => true,
			'edit_published_pages'   => true,
			'publish_pages'          => true,
			'delete_pages'           => true,
			'delete_others_pages'    => true,
			'delete_published_pages' => true,
			'delete_posts'           => true,
			'delete_others_posts'    => true,
			'delete_published_posts' => true,
			'delete_private_posts'   => true,
			'edit_private_posts'     => true,
			'read_private_posts'     => true,
			'delete_private_pages'   => true,
			'edit_private_pages'     => true,
			'read_private_pages'     => true,
		),
		'author'        => array(
			'upload_files'           => true,
			'edit_posts'             => true,
			'edit_published_posts'   => true,
			'publish_posts'          => true,
			'read'                   => true,
			'level_2'                => true,
			'level_1'                => true,
			'level_0'                => true,
			'delete_posts'           => true,
			'delete_published_posts' => true,
		),
		'contributor'   => array(
			'edit_posts'   => true,
			'read'         => true,
			'level_1'      => true,
			'level_0'      => true,
			'delete_posts' => true,
		),
		'subscriber'    => array(
			'read'    => true,
			'level_0' => true,
		),
	) );
}
