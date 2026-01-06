<?php
/**
 * Plugin List Ability
 *
 * Lists all installed plugins with their status.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the plugin-list ability.
 *
 * @return void
 */
function wp_neural_admin_register_plugin_list(): void {
	register_neural_ability(
		'wp-neural-admin/plugin-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Plugins', 'wp-neural-admin' ),
			'description'         => __( 'List all installed plugins with their activation status.', 'wp-neural-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array( 'status' => 'all' ),
				'properties'           => array(
					'status' => array(
						'type'        => 'string',
						'enum'        => array( 'all', 'active', 'inactive' ),
						'default'     => 'all',
						'description' => __( 'Filter plugins by status.', 'wp-neural-admin' ),
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
						'description' => __( 'List of plugins.', 'wp-neural-admin' ),
					),
					'total'   => array(
						'type'        => 'integer',
						'description' => __( 'Total number of plugins.', 'wp-neural-admin' ),
					),
					'active'  => array(
						'type'        => 'integer',
						'description' => __( 'Number of active plugins.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_plugin_list',
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
			'initialMessage' => __( "I'll check your installed plugins...", 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the plugin-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_plugin_list( array $input = array() ): array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$status         = isset( $input['status'] ) ? $input['status'] : 'all';
	$all_plugins    = get_plugins();
	$active_plugins = get_option( 'active_plugins', array() );
	$plugins        = array();
	$active_count   = 0;

	foreach ( $all_plugins as $plugin_file => $plugin_data ) {
		$is_active = in_array( $plugin_file, $active_plugins, true );

		if ( 'active' === $status && ! $is_active ) {
			continue;
		}
		if ( 'inactive' === $status && $is_active ) {
			continue;
		}

		if ( $is_active ) {
			++$active_count;
		}

		$plugins[] = array(
			'name'    => $plugin_data['Name'],
			'slug'    => $plugin_file,
			'version' => $plugin_data['Version'],
			'active'  => $is_active,
		);
	}

	return array(
		'plugins' => $plugins,
		'total'   => count( $plugins ),
		'active'  => $active_count,
	);
}
