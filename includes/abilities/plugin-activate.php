<?php
/**
 * Plugin Activate Ability
 *
 * Activates a specific plugin by its slug.
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the plugin-activate ability.
 *
 * @return void
 */
function wp_agentic_admin_register_plugin_activate(): void {
	register_agentic_ability(
		'wp-agentic-admin/plugin-activate',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Activate Plugin', 'wp-agentic-admin' ),
			'description'         => __( 'Activate a specific plugin by its slug.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'plugin' => array(
						'type'        => 'string',
						'description' => __( 'The plugin file path (slug) to activate.', 'wp-agentic-admin' ),
					),
				),
				'required'             => array( 'plugin' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the plugin was successfully activated.', 'wp-agentic-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_plugin_activate',
			'permission_callback' => function () {
				return current_user_can( 'activate_plugins' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'     => false,
					'destructive'  => false, // Activation is less destructive than deactivation.
					'idempotent'   => true,
					'instructions' => __( 'This will activate the specified plugin. Make sure the plugin is compatible with your WordPress version.', 'wp-agentic-admin' ),
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'             => array( 'activate', 'enable', 'turn on', 'activate plugin' ),
			'initialMessage'       => __( 'Activating the plugin...', 'wp-agentic-admin' ),
			'requiresConfirmation' => false, // Less risky than deactivation.
		)
	);
}

/**
 * Execute the plugin-activate ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_plugin_activate( array $input = array() ): array {
	if ( empty( $input['plugin'] ) ) {
		return array(
			'success' => false,
			'message' => __( 'No plugin specified.', 'wp-agentic-admin' ),
		);
	}

	return wp_agentic_admin_activate_plugin_by_slug( $input['plugin'] );
}
