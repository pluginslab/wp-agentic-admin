<?php
/**
 * Cache Flush Ability
 *
 * Flushes the WordPress object cache.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the cache-flush ability.
 *
 * @return void
 */
function agentic_admin_register_cache_flush(): void {
	agentic_admin_register_ability(
		'wp-agentic-admin/cache-flush',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Flush Cache', 'agentic-admin' ),
			'description'         => __( 'Flush the WordPress object cache.', 'agentic-admin' ),
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
						'description' => __( 'Whether the cache was successfully flushed.', 'agentic-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'agentic_admin_execute_cache_flush',
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
			'initialMessage' => __( 'Flushing the cache...', 'agentic-admin' ),
		)
	);
}

/**
 * Execute the cache-flush ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function agentic_admin_execute_cache_flush( array $input = array() ): array {
	// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Required parameter for callback signature.
	$result = wp_cache_flush();

	return array(
		'success' => $result,
		'message' => $result
			? __( 'Object cache flushed successfully.', 'agentic-admin' )
			: __( 'Failed to flush object cache.', 'agentic-admin' ),
	);
}
