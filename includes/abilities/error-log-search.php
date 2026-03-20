<?php
/**
 * Error Log Search Ability
 *
 * Filters debug.log by keyword and severity.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the error-log-search ability.
 *
 * @return void
 */
function wp_agentic_admin_register_error_log_search(): void {
	register_agentic_ability(
		'wp-agentic-admin/error-log-search',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Search Error Log', 'wp-agentic-admin' ),
			'description'         => __( 'Filter debug.log by keyword and severity level.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(
					'keyword' => '',
					'level'   => '',
					'lines'   => 100,
				),
				'properties'           => array(
					'keyword' => array(
						'type'        => 'string',
						'default'     => '',
						'description' => __( 'Search keyword.', 'wp-agentic-admin' ),
					),
					'level'   => array(
						'type'        => 'string',
						'default'     => '',
						'enum'        => array( '', 'fatal', 'warning', 'notice', 'deprecated' ),
						'description' => __( 'Error severity level filter.', 'wp-agentic-admin' ),
					),
					'lines'   => array(
						'type'        => 'integer',
						'default'     => 100,
						'description' => __( 'Number of log lines to scan.', 'wp-agentic-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'matches' => array(
						'type'        => 'array',
						'description' => __( 'Matching log lines.', 'wp-agentic-admin' ),
					),
					'total'   => array(
						'type'        => 'integer',
						'description' => __( 'Number of matches.', 'wp-agentic-admin' ),
					),
					'scanned' => array(
						'type'        => 'integer',
						'description' => __( 'Lines scanned.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_error_log_search',
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
			'keywords'       => array( 'search', 'filter', 'error', 'fatal', 'warning', 'log' ),
			'initialMessage' => __( "I'll search the error log...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the error-log-search ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_error_log_search( array $input = array() ): array {
	$keyword   = isset( $input['keyword'] ) ? sanitize_text_field( $input['keyword'] ) : '';
	$level     = isset( $input['level'] ) ? sanitize_text_field( $input['level'] ) : '';
	$max_lines = isset( $input['lines'] ) ? min( absint( $input['lines'] ), 500 ) : 100;

	$log_file = \WPAgenticAdmin\Utils::get_debug_log_path();

	if ( ! file_exists( $log_file ) || ! is_readable( $log_file ) ) {
		return array(
			'matches' => array(),
			'total'   => 0,
			'scanned' => 0,
			'message' => 'debug.log not found or not readable.',
		);
	}

	// Read last N lines.
	$lines   = file( $log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
	$lines   = array_slice( $lines, -$max_lines );
	$scanned = count( $lines );

	// Level mapping to PHP error prefixes.
	$level_map = array(
		'fatal'      => array( 'Fatal error', 'PHP Fatal' ),
		'warning'    => array( 'Warning', 'PHP Warning' ),
		'notice'     => array( 'Notice', 'PHP Notice' ),
		'deprecated' => array( 'Deprecated', 'PHP Deprecated' ),
	);

	$matches = array();

	foreach ( $lines as $line ) {
		$match = true;

		// Keyword filter.
		if ( '' !== $keyword && false === stripos( $line, $keyword ) ) {
			$match = false;
		}

		// Level filter.
		if ( $match && '' !== $level && isset( $level_map[ $level ] ) ) {
			$level_match = false;
			foreach ( $level_map[ $level ] as $prefix ) {
				if ( false !== stripos( $line, $prefix ) ) {
					$level_match = true;
					break;
				}
			}
			if ( ! $level_match ) {
				$match = false;
			}
		}

		if ( $match ) {
			$matches[] = $line;
		}
	}

	// Limit output.
	$matches = array_slice( $matches, -50 );

	return array(
		'matches' => $matches,
		'total'   => count( $matches ),
		'scanned' => $scanned,
	);
}
