<?php
/**
 * Error Log Read Ability
 *
 * Reads recent entries from the WordPress debug.log file.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the error-log-read ability.
 *
 * @return void
 */
function wp_neural_admin_register_error_log_read(): void {
	register_neural_ability(
		'wp-neural-admin/error-log-read',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Read Error Log', 'wp-neural-admin' ),
			'description'         => __( 'Read recent entries from the WordPress debug.log file.', 'wp-neural-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array( 'lines' => 50 ),
				'properties'           => array(
					'lines' => array(
						'type'        => 'integer',
						'default'     => 50,
						'minimum'     => 1,
						'maximum'     => 500,
						'description' => __( 'Number of lines to read from the end of the log.', 'wp-neural-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'entries'       => array(
						'type'        => 'array',
						'items'       => array( 'type' => 'string' ),
						'description' => __( 'Array of log entries.', 'wp-neural-admin' ),
					),
					'total_lines'   => array(
						'type'        => 'integer',
						'description' => __( 'Total number of lines in the log file.', 'wp-neural-admin' ),
					),
					'file_exists'   => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the debug.log file exists.', 'wp-neural-admin' ),
					),
					'debug_enabled' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether WP_DEBUG_LOG is enabled.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_error_log_read',
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
			'keywords'       => array( 'error', 'errors', 'log', 'logs', 'problem', 'issue', 'broken', 'white screen', 'crash', 'not working', 'bug', 'debug' ),
			'initialMessage' => __( "I'll look at your error log...", 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the error-log-read ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_error_log_read( array $input = array() ): array {
	$lines = isset( $input['lines'] ) ? absint( $input['lines'] ) : 50;

	// Check if debug.log exists.
	$log_file = \WPNeuralAdmin\Utils::get_debug_log_path();

	if ( ! file_exists( $log_file ) ) {
		return array(
			'entries'       => array(),
			'total_lines'   => 0,
			'file_exists'   => false,
			'debug_enabled' => defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG,
		);
	}

	// Read the last N lines from the file.
	$entries = array();

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	$content     = file_get_contents( $log_file );
	$all_lines   = explode( "\n", $content );
	$total_lines = count( $all_lines );

	// Get last N non-empty lines.
	$all_lines = array_filter( $all_lines, 'strlen' );
	$entries   = array_slice( $all_lines, -$lines );

	return array(
		'entries'       => array_values( $entries ),
		'total_lines'   => $total_lines,
		'file_exists'   => true,
		'debug_enabled' => defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG,
	);
}
