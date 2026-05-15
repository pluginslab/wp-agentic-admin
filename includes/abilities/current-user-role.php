<?php
/**
 * Current User Role Ability
 *
 * Returns the current logged-in user's role and account info.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the current-user-role ability.
 *
 * @return void
 */
function agentic_admin_register_current_user_role(): void {
	agentic_admin_register_ability(
		'wp-agentic-admin/current-user-role',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Get Current User Role', 'agentic-admin' ),
			'description'         => __( 'Get the current logged-in user\'s role and account info.', 'agentic-admin' ),
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
					'success'            => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the user info was successfully retrieved.', 'agentic-admin' ),
					),
					'message'            => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'agentic-admin' ),
					),
					'username'           => array(
						'type'        => 'string',
						'description' => __( 'The user login name.', 'agentic-admin' ),
					),
					'display_name'       => array(
						'type'        => 'string',
						'description' => __( 'The user display name.', 'agentic-admin' ),
					),
					'email'              => array(
						'type'        => 'string',
						'description' => __( 'The user email address.', 'agentic-admin' ),
					),
					'roles'              => array(
						'type'        => 'array',
						'description' => __( 'The user roles.', 'agentic-admin' ),
						'items'       => array(
							'type' => 'string',
						),
					),
					'capabilities_count' => array(
						'type'        => 'integer',
						'description' => __( 'Number of capabilities the user has.', 'agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'agentic_admin_execute_current_user_role',
			'permission_callback' => function () {
				return is_user_logged_in();
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
			'keywords'       => array( 'role', 'my role', 'user role', 'current user', 'who am i', 'my account', 'my permissions', 'logged in' ),
			'initialMessage' => __( 'Checking your user account...', 'agentic-admin' ),
		)
	);
}

/**
 * Execute the current-user-role ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function agentic_admin_execute_current_user_role( array $input = array() ): array {
	// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Required parameter for callback signature.
	$user = wp_get_current_user();

	if ( ! $user || 0 === $user->ID ) {
		return array(
			'success' => false,
			'message' => __( 'No user is currently logged in.', 'agentic-admin' ),
		);
	}

	return array(
		'success'            => true,
		'message'            => __( 'Current user info retrieved successfully.', 'agentic-admin' ),
		'username'           => $user->user_login,
		'display_name'       => $user->display_name,
		'email'              => $user->user_email,
		'roles'              => array_values( $user->roles ),
		'capabilities_count' => count( $user->allcaps ),
	);
}
