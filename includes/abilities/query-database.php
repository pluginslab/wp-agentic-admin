<?php
/**
 * Query Database Ability
 *
 * Executes read-only SQL queries for site inspection.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the query-database ability.
 *
 * @return void
 */
function wp_agentic_admin_register_query_database(): void {
	register_agentic_ability(
		'wp-agentic-admin/query-database',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Query Database', 'wp-agentic-admin' ),
			'description'         => __( 'Execute read-only SQL queries for site inspection.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array( 'query' => '' ),
				'properties'           => array(
					'query' => array(
						'type'        => 'string',
						'description' => __( 'SQL SELECT query to execute.', 'wp-agentic-admin' ),
					),
				),
				'required'             => array( 'query' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the query succeeded.', 'wp-agentic-admin' ),
					),
					'results' => array(
						'type'        => 'array',
						'description' => __( 'Query results.', 'wp-agentic-admin' ),
					),
					'rows'    => array(
						'type'        => 'integer',
						'description' => __( 'Number of rows returned.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_query_database',
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
			'keywords'       => array( 'query', 'database', 'sql', 'select', 'table', 'rows' ),
			'initialMessage' => __( "I'll run that query...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Check if a SQL query is safe (SELECT only).
 *
 * @param string $query SQL query string.
 * @return bool True if safe.
 */
function wp_agentic_admin_is_safe_query( string $query ): bool {
	$forbidden = array( 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'REPLACE', 'GRANT', 'REVOKE' );
	$upper     = strtoupper( trim( $query ) );

	// Must start with SELECT or SHOW or DESCRIBE.
	if ( ! preg_match( '/^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i', $upper ) ) {
		return false;
	}

	foreach ( $forbidden as $keyword ) {
		// Check for forbidden keywords as separate words.
		if ( preg_match( '/\b' . $keyword . '\b/', $upper ) ) {
			return false;
		}
	}

	return true;
}

/**
 * Redact sensitive columns from query results.
 *
 * @param array $results Query results.
 * @return array Redacted results.
 */
function wp_agentic_admin_redact_query_results( array $results ): array {
	$sensitive_columns = array( 'user_pass', 'user_email' );

	foreach ( $results as &$row ) {
		$row = (array) $row;
		foreach ( $sensitive_columns as $col ) {
			if ( isset( $row[ $col ] ) ) {
				$row[ $col ] = '[REDACTED]';
			}
		}
	}

	return $results;
}

/**
 * Execute the query-database ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_query_database( array $input = array() ): array {
	global $wpdb;

	$query = isset( $input['query'] ) ? trim( $input['query'] ) : '';

	if ( empty( $query ) ) {
		return array(
			'success' => false,
			'message' => 'No query provided.',
			'results' => array(),
			'rows'    => 0,
		);
	}

	if ( ! wp_agentic_admin_is_safe_query( $query ) ) {
		return array(
			'success' => false,
			'message' => 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed.',
			'results' => array(),
			'rows'    => 0,
		);
	}

	// Replace {prefix} placeholder with actual prefix.
	$query = str_replace( '{prefix}', $wpdb->prefix, $query );

	// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is validated as SELECT-only above.
	$results = $wpdb->get_results( $query, ARRAY_A );

	if ( null === $results ) {
		return array(
			'success' => false,
			'message' => $wpdb->last_error ?: 'Query failed.',
			'results' => array(),
			'rows'    => 0,
		);
	}

	// Limit to 50 rows.
	$results = array_slice( $results, 0, 50 );

	// Redact sensitive data.
	$results = wp_agentic_admin_redact_query_results( $results );

	return array(
		'success' => true,
		'results' => $results,
		'rows'    => count( $results ),
	);
}
