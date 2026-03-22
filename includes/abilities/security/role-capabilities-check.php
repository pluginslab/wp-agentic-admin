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
			'description'         => __( 'Check default WordPress roles for added capabilities that indicate privilege escalation.', 'wp-agentic-admin' ),
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
						'description' => __( 'Per-role escalation results.', 'wp-agentic-admin' ),
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

	// Check each default role for added capabilities (privilege escalation).
	foreach ( $defaults as $role_slug => $default_caps ) {
		if ( ! isset( $current[ $role_slug ] ) ) {
			continue;
		}

		$current_caps = array_keys( array_filter( $current[ $role_slug ]['capabilities'] ?? array() ) );
		$default_list = array_keys( $default_caps );

		$added = array_values( array_diff( $current_caps, $default_list ) );

		if ( empty( $added ) ) {
			$roles_result[] = array(
				'role'      => $role_slug,
				'role_name' => $current[ $role_slug ]['name'],
				'status'    => 'default',
				'added'     => array(),
			);
			continue;
		}

		++$total_issues;

		$risk = wp_agentic_admin_calculate_role_risk( $role_slug, $added );

		$roles_result[] = array(
			'role'       => $role_slug,
			'role_name'  => $current[ $role_slug ]['name'],
			'status'     => 'escalated',
			'added'      => $added,
			'risk_score' => $risk,
		);
	}

	if ( 0 === $total_issues ) {
		$message = __( 'No privilege escalation detected. All default roles have their expected capabilities.', 'wp-agentic-admin' );
	} else {
		$message = sprintf(
			/* translators: %d: number of escalated roles */
			_n(
				'Privilege escalation detected: %d default role has added capabilities.',
				'Privilege escalation detected: %d default roles have added capabilities.',
				$total_issues,
				'wp-agentic-admin'
			),
			$total_issues
		);
	}

	return array(
		'success'      => true,
		'message'      => $message,
		'total_issues' => $total_issues,
		'roles'        => $roles_result,
	);
}

/**
 * Calculate risk score for a role with added capabilities.
 *
 * Subscribers and contributors gaining capabilities is high risk.
 * Editors gaining admin-level capabilities is medium-high risk.
 *
 * @param string $role_slug Role slug.
 * @param array  $added     Capabilities added beyond defaults.
 * @return float Risk score 1.0–10.0.
 */
function wp_agentic_admin_calculate_role_risk( string $role_slug, array $added ): float {
	// Dangerous capabilities that should never appear on low-privilege roles.
	$dangerous = array( 'manage_options', 'edit_users', 'install_plugins', 'edit_plugins', 'delete_users', 'create_users', 'update_core', 'activate_plugins', 'edit_themes', 'switch_themes' );

	$has_dangerous = ! empty( array_intersect( $added, $dangerous ) );

	// Risk by role — lower-privilege roles are higher risk when escalated.
	$role_risk_base = array(
		'subscriber'    => 9.0,
		'contributor'   => 8.5,
		'author'        => 7.0,
		'editor'        => 6.5,
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
