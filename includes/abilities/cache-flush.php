<?php
/**
 * Cache Flush Ability
 *
 * Flushes the WordPress object cache.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the cache-flush ability.
 *
 * @return void
 */
function wp_neural_admin_register_cache_flush(): void {
	register_neural_ability(
		'wp-neural-admin/cache-flush',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Flush Cache', 'wp-neural-admin' ),
			'description'         => __( 'Flush the WordPress object cache.', 'wp-neural-admin' ),
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
					'success' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the cache was successfully flushed.', 'wp-neural-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_cache_flush',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'    => false,
					'destructive' => false,
					'idempotent'  => true,
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'       => array( 'cache', 'flush', 'clear', 'purge', 'refresh', 'reset cache' ),
			'initialMessage' => __( 'Flushing the cache...', 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the cache-flush ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_cache_flush( array $input = array() ): array {
	$result = wp_cache_flush();

	return array(
		'success' => $result,
		'message' => $result
			? __( 'Object cache flushed successfully.', 'wp-neural-admin' )
			: __( 'Failed to flush object cache.', 'wp-neural-admin' ),
	);
}
