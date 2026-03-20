<?php
/**
 * User List Ability
 *
 * Lists all WordPress users with their roles.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the user-list ability.
 *
 * @return void
 */
function wp_agentic_admin_register_user_list(): void {
	register_agentic_ability(
		'wp-agentic-admin/user-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Users', 'wp-agentic-admin' ),
			'description'         => __( 'List all WordPress users with their roles and registration dates.', 'wp-agentic-admin' ),
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
					'users' => array(
						'type'        => 'array',
						'items'       => array(
							'type'       => 'object',
							'properties' => array(
								'username'    => array( 'type' => 'string' ),
								'display_name' => array( 'type' => 'string' ),
								'email'       => array( 'type' => 'string' ),
								'role'        => array( 'type' => 'string' ),
								'registered'  => array( 'type' => 'string' ),
							),
						),
						'description' => __( 'List of users.', 'wp-agentic-admin' ),
					),
					'total' => array(
						'type'        => 'integer',
						'description' => __( 'Total number of users.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_user_list',
			'permission_callback' => function () {
				return current_user_can( 'list_users' );
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
			'keywords'       => array( 'user', 'users', 'members', 'accounts', 'admins', 'authors' ),
			'initialMessage' => __( "I'll check your WordPress users...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the user-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_user_list( array $input = array() ): array {
	$wp_users = get_users( array( 'orderby' => 'registered', 'order' => 'DESC' ) );
	$users    = array();

	foreach ( $wp_users as $user ) {
		$roles = $user->roles;
		// Sanitize email — mask the local part for privacy.
		$email_parts = explode( '@', $user->user_email );
		$masked      = substr( $email_parts[0], 0, 2 ) . '***@' . ( $email_parts[1] ?? '' );

		$users[] = array(
			'username'     => $user->user_login,
			'display_name' => $user->display_name,
			'email'        => $masked,
			'role'         => ! empty( $roles ) ? implode( ', ', $roles ) : 'none',
			'registered'   => $user->user_registered,
		);
	}

	return array(
		'users' => $users,
		'total' => count( $users ),
	);
}
