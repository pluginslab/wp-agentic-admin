<?php
/**
 * Database Optimize Ability
 *
 * Optimizes WordPress database tables.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the db-optimize ability.
 *
 * @return void
 */
function wp_neural_admin_register_db_optimize(): void {
	register_neural_ability(
		'wp-neural-admin/db-optimize',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Optimize Database', 'wp-neural-admin' ),
			'description'         => __( 'Optimize WordPress database tables.', 'wp-neural-admin' ),
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
					'success'          => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the optimization was successful.', 'wp-neural-admin' ),
					),
					'tables_optimized' => array(
						'type'        => 'integer',
						'description' => __( 'Number of tables optimized.', 'wp-neural-admin' ),
					),
					'tables'           => array(
						'type'        => 'array',
						'items'       => array( 'type' => 'string' ),
						'description' => __( 'List of optimized table names.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_db_optimize',
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
			'keywords'       => array( 'database', 'db', 'optimize', 'slow', 'performance', 'speed', 'cleanup', 'clean up' ),
			'initialMessage' => __( 'Optimizing the database...', 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the db-optimize ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_db_optimize( array $input = array() ): array {
	global $wpdb;

	$tables           = $wpdb->get_results( 'SHOW TABLES', ARRAY_N );
	$optimized_tables = array();

	foreach ( $tables as $table ) {
		$table_name = $table[0];
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( 'OPTIMIZE TABLE %i', $table_name ) );
		$optimized_tables[] = $table_name;
	}

	return array(
		'success'          => true,
		'tables_optimized' => count( $optimized_tables ),
		'tables'           => $optimized_tables,
	);
}
