<?php
/**
 * Plugin List Ability
 *
 * Lists all installed plugins with their status.
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the plugin-list ability.
 *
 * @return void
 */
function wp_agentic_admin_register_plugin_list(): void {
	register_agentic_ability(
		'wp-agentic-admin/plugin-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Plugins', 'wp-agentic-admin' ),
			'description'         => __( 'List all installed plugins with their activation status.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array( 'status' => 'all' ),
				'properties'           => array(
					'status' => array(
						'type'        => 'string',
						'enum'        => array( 'all', 'active', 'inactive' ),
						'default'     => 'all',
						'description' => __( 'Filter plugins by status.', 'wp-agentic-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'plugins' => array(
						'type'        => 'array',
						'items'       => array(
							'type'       => 'object',
							'properties' => array(
								'name'    => array( 'type' => 'string' ),
								'slug'    => array( 'type' => 'string' ),
								'version' => array( 'type' => 'string' ),
								'active'  => array( 'type' => 'boolean' ),
							),
						),
						'description' => __( 'List of plugins.', 'wp-agentic-admin' ),
					),
					'total'   => array(
						'type'        => 'integer',
						'description' => __( 'Total number of plugins.', 'wp-agentic-admin' ),
					),
					'active'  => array(
						'type'        => 'integer',
						'description' => __( 'Number of active plugins.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_plugin_list',
			'permission_callback' => function () {
				return current_user_can( 'activate_plugins' );
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
			'keywords'       => array( 'plugin', 'plugins', 'installed', 'extensions', 'addons', 'add-ons' ),
			'initialMessage' => __( "I'll check your installed plugins...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the plugin-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_plugin_list( array $input = array() ): array {
	$status = isset( $input['status'] ) ? $input['status'] : 'all';
	return wp_agentic_admin_get_all_plugins( $status );
}
