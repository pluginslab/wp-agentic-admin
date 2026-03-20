<?php
/**
 * OPcache Status Ability
 *
 * Checks OPcache status and configuration.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the opcode-cache-status ability.
 *
 * @return void
 */
function wp_agentic_admin_register_opcode_cache_status(): void {
	register_agentic_ability(
		'wp-agentic-admin/opcode-cache-status',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'OPcache Status', 'wp-agentic-admin' ),
			'description'         => __( 'Check OPcache status and configuration.', 'wp-agentic-admin' ),
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
					'enabled'        => array(
						'type'        => 'boolean',
						'description' => __( 'Whether OPcache is enabled.', 'wp-agentic-admin' ),
					),
					'memory'         => array(
						'type'        => 'object',
						'description' => __( 'Memory usage info.', 'wp-agentic-admin' ),
					),
					'statistics'     => array(
						'type'        => 'object',
						'description' => __( 'Cache statistics.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_opcode_cache_status',
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
			'keywords'       => array( 'opcache', 'opcode', 'cache', 'php', 'performance' ),
			'initialMessage' => __( "I'll check your OPcache status...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the opcode-cache-status ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_opcode_cache_status( array $input = array() ): array {
	if ( ! function_exists( 'opcache_get_status' ) ) {
		return array(
			'enabled'    => false,
			'message'    => 'OPcache extension is not loaded.',
			'memory'     => array(),
			'statistics' => array(),
		);
	}

	$status = opcache_get_status( false );

	if ( false === $status ) {
		return array(
			'enabled'    => false,
			'message'    => 'OPcache is installed but disabled.',
			'memory'     => array(),
			'statistics' => array(),
		);
	}

	$memory = $status['memory_usage'];
	$stats  = $status['opcache_statistics'];

	$total_memory = $memory['used_memory'] + $memory['free_memory'];
	$hit_rate     = $stats['opcache_hit_rate'];

	return array(
		'enabled'    => true,
		'memory'     => array(
			'used'       => round( $memory['used_memory'] / 1048576, 2 ) . ' MB',
			'free'       => round( $memory['free_memory'] / 1048576, 2 ) . ' MB',
			'total'      => round( $total_memory / 1048576, 2 ) . ' MB',
			'percentage' => round( ( $memory['used_memory'] / $total_memory ) * 100, 1 ),
		),
		'statistics' => array(
			'cached_scripts' => $stats['num_cached_scripts'],
			'hits'           => $stats['hits'],
			'misses'         => $stats['misses'],
			'hit_rate'       => round( $hit_rate, 2 ) . '%',
		),
	);
}
