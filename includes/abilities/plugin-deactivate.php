<?php
/**
 * Plugin Deactivate Ability
 *
 * Deactivates a specific plugin by its slug.
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the plugin-deactivate ability.
 *
 * @return void
 */
function wp_agentic_admin_register_plugin_deactivate(): void {
	register_agentic_ability(
		'wp-agentic-admin/plugin-deactivate',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Deactivate Plugin', 'wp-agentic-admin' ),
			'description'         => __( 'Deactivate a specific plugin by its slug.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'plugin' => array(
						'type'        => 'string',
						'description' => __( 'The plugin file path (slug) to deactivate.', 'wp-agentic-admin' ),
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
						'description' => __( 'Whether the plugin was successfully deactivated.', 'wp-agentic-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_plugin_deactivate',
			'permission_callback' => function () {
				return current_user_can( 'deactivate_plugins' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'     => false,
					'destructive'  => true,
					'idempotent'   => true,
					'instructions' => __( 'This will deactivate the specified plugin. The site may behave differently after deactivation.', 'wp-agentic-admin' ),
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'             => array( 'deactivate', 'disable', 'turn off', 'deactivate plugin' ),
			'initialMessage'       => __( 'Deactivating the plugin...', 'wp-agentic-admin' ),
			'requiresConfirmation' => true,
			'confirmationMessage'  => __( 'Are you sure you want to deactivate this plugin? This may affect your site functionality.', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the plugin-deactivate ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_plugin_deactivate( array $input = array() ): array {
	if ( empty( $input['plugin'] ) ) {
		return array(
			'success' => false,
			'message' => __( 'No plugin specified.', 'wp-agentic-admin' ),
		);
	}

	return wp_agentic_admin_deactivate_plugin_by_slug( $input['plugin'] );
}
