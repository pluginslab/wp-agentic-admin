<?php
/**
 * Plugin Deactivate Ability
 *
 * Deactivates a specific plugin by its slug.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the plugin-deactivate ability.
 *
 * @return void
 */
function wp_neural_admin_register_plugin_deactivate(): void {
	register_neural_ability(
		'wp-neural-admin/plugin-deactivate',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Deactivate Plugin', 'wp-neural-admin' ),
			'description'         => __( 'Deactivate a specific plugin by its slug.', 'wp-neural-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'plugin' => array(
						'type'        => 'string',
						'description' => __( 'The plugin file path (slug) to deactivate.', 'wp-neural-admin' ),
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
						'description' => __( 'Whether the plugin was successfully deactivated.', 'wp-neural-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_plugin_deactivate',
			'permission_callback' => function () {
				return current_user_can( 'deactivate_plugins' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'     => false,
					'destructive'  => true,
					'idempotent'   => true,
					'instructions' => __( 'This will deactivate the specified plugin. The site may behave differently after deactivation.', 'wp-neural-admin' ),
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'             => array( 'deactivate', 'disable', 'turn off', 'deactivate plugin' ),
			'initialMessage'       => __( 'Deactivating the plugin...', 'wp-neural-admin' ),
			'requiresConfirmation' => true,
			'confirmationMessage'  => __( 'Are you sure you want to deactivate this plugin? This may affect your site functionality.', 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the plugin-deactivate ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_plugin_deactivate( array $input = array() ): array {
	if ( empty( $input['plugin'] ) ) {
		return array(
			'success' => false,
			'message' => __( 'No plugin specified.', 'wp-neural-admin' ),
		);
	}

	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$plugin_file = sanitize_text_field( $input['plugin'] );
	$all_plugins = get_plugins();

	// Check if plugin exists.
	if ( ! isset( $all_plugins[ $plugin_file ] ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin file path */
				__( 'Plugin "%s" not found.', 'wp-neural-admin' ),
				$plugin_file
			),
		);
	}

	$plugin_name = $all_plugins[ $plugin_file ]['Name'];

	// Check if already inactive.
	if ( ! is_plugin_active( $plugin_file ) ) {
		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already inactive.', 'wp-neural-admin' ),
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
				__( 'Failed to deactivate plugin "%s".', 'wp-neural-admin' ),
				$plugin_name
			),
		);
	}

	return array(
		'success' => true,
		'message' => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been deactivated.', 'wp-neural-admin' ),
			$plugin_name
		),
	);
}
