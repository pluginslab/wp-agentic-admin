<?php
/**
 * Error Log Read Ability
 *
 * Reads recent entries from the WordPress debug.log file.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the error-log-read ability.
 *
 * @return void
 */
function wp_agentic_admin_register_error_log_read(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/error-log-read',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Read Error Log', 'wp-agentic-admin' ),
			'description'         => __( 'Read recent entries from the WordPress debug.log file.', 'wp-agentic-admin' ),
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
						'description' => __( 'Number of lines to read from the end of the log.', 'wp-agentic-admin' ),
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
						'description' => __( 'Array of log entries.', 'wp-agentic-admin' ),
					),
					'total_lines'   => array(
						'type'        => 'integer',
						'description' => __( 'Total number of lines in the log file.', 'wp-agentic-admin' ),
					),
					'file_exists'   => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the debug.log file exists.', 'wp-agentic-admin' ),
					),
					'debug_enabled' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether WP_DEBUG_LOG is enabled.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_error_log_read',
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
			'initialMessage' => __( "I'll look at your error log...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the error-log-read ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_error_log_read( array $input = array() ): array {
	$lines = isset( $input['lines'] ) ? absint( $input['lines'] ) : 50;

	// Check if debug.log exists.
	$log_file = \WPAgenticAdmin\Utils::get_debug_log_path();

	if ( ! file_exists( $log_file ) ) {
		return array(
			'entries'       => array(),
			'total_lines'   => 0,
			'file_exists'   => false,
			'debug_enabled' => defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG,
		);
	}

	// Read the last N lines efficiently without loading the entire file into memory.
	// Uses SplFileObject to seek from the end, safe for multi-hundred-MB debug.log files.
	$file        = new \SplFileObject( $log_file, 'r' );
	$file->seek( PHP_INT_MAX );
	$total_lines = $file->key();

	// Collect last N non-empty lines by reading backwards from end.
	$entries  = array();
	$line_num = max( 0, $total_lines - 1 );

	while ( count( $entries ) < $lines && $line_num >= 0 ) {
		$file->seek( $line_num );
		$line = rtrim( $file->current(), "\r\n" );

		if ( '' !== $line ) {
			array_unshift( $entries, $line );
		}

		--$line_num;
	}

	return array(
		'entries'       => $entries,
		'total_lines'   => $total_lines,
		'file_exists'   => true,
		'debug_enabled' => defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG,
	);
}
