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
function agentic_admin_register_query_database(): void {
	agentic_admin_register_ability(
		'wp-agentic-admin/query-database',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Query Database', 'agentic-admin' ),
			'description'         => __( 'Execute read-only SQL queries for site inspection.', 'agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array( 'query' => '' ),
				'properties'           => array(
					'query' => array(
						'type'        => 'string',
						'description' => __( 'SQL SELECT query to execute.', 'agentic-admin' ),
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
						'description' => __( 'Whether the query succeeded.', 'agentic-admin' ),
					),
					'results' => array(
						'type'        => 'array',
						'description' => __( 'Query results.', 'agentic-admin' ),
					),
					'rows'    => array(
						'type'        => 'integer',
						'description' => __( 'Number of rows returned.', 'agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'agentic_admin_execute_query_database',
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
			'initialMessage' => __( "I'll run that query...", 'agentic-admin' ),
		)
	);
}

/**
 * Maximum length (in characters) for a query string. Prevents pathological
 * queries that try to bypass the keyword blocklist via obfuscation.
 *
 * @var int
 */
const AGENTIC_ADMIN_QUERY_MAX_LENGTH = 2000;

/**
 * Column names that must never appear in a query — neither in SELECT lists
 * nor in WHERE clauses.
 *
 * Blocking them in WHERE clauses prevents email/password reconnaissance
 * attacks (e.g. SELECT * FROM wp_users WHERE user_email='target@x.com'),
 * where an empty vs. non-empty result set itself leaks whether the value
 * exists in the database. See issue #166.
 *
 * @return string[]
 */
function agentic_admin_sensitive_columns(): array {
	return array(
		'user_pass',
		'user_email',
		'user_activation_key',
		'session_tokens',
	);
}

/**
 * Check if a SQL query is safe (SELECT-family only, no sensitive columns).
 *
 * @param string $query SQL query string.
 * @return string|true True if safe, otherwise an error message.
 */
function agentic_admin_check_query_safety( string $query ) {
	if ( strlen( $query ) > AGENTIC_ADMIN_QUERY_MAX_LENGTH ) {
		return sprintf(
			/* translators: %d: maximum query length in characters */
			__( 'Query exceeds the maximum length of %d characters.', 'agentic-admin' ),
			AGENTIC_ADMIN_QUERY_MAX_LENGTH
		);
	}

	$upper = strtoupper( trim( $query ) );

	// Must start with SELECT, SHOW, DESCRIBE, or EXPLAIN.
	if ( ! preg_match( '/^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i', $upper ) ) {
		return __( 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed.', 'agentic-admin' );
	}

	$forbidden = array( 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'REPLACE', 'GRANT', 'REVOKE' );
	foreach ( $forbidden as $keyword ) {
		if ( preg_match( '/\b' . $keyword . '\b/', $upper ) ) {
			return __( 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed.', 'agentic-admin' );
		}
	}

	// Block any reference to sensitive columns (in SELECT lists, WHERE
	// clauses, JOIN conditions — anywhere). Even read access via WHERE
	// leaks information by row-count side-channel. See issue #166.
	foreach ( agentic_admin_sensitive_columns() as $col ) {
		if ( preg_match( '/\b' . preg_quote( $col, '/' ) . '\b/i', $query ) ) {
			return sprintf(
				/* translators: %s: sensitive column name */
				__( 'Queries that reference the sensitive column "%s" are blocked.', 'agentic-admin' ),
				$col
			);
		}
	}

	return true;
}

/**
 * Redact sensitive column values in a row of results.
 *
 * Belt-and-suspenders defense: even when the query itself doesn't name
 * a sensitive column (e.g. SELECT *), the result rows must not leak
 * password hashes or activation keys.
 *
 * @param array $row Associative array of column => value.
 * @return array Row with sensitive columns replaced by [REDACTED].
 */
function agentic_admin_redact_sensitive_row( array $row ): array {
	foreach ( agentic_admin_sensitive_columns() as $col ) {
		if ( array_key_exists( $col, $row ) ) {
			$row[ $col ] = '[REDACTED]';
		}
	}
	return $row;
}

/**
 * Execute the query-database ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function agentic_admin_execute_query_database( array $input = array() ): array {
	global $wpdb;

	$query = isset( $input['query'] ) ? trim( $input['query'] ) : '';

	if ( empty( $query ) ) {
		return array(
			'success' => false,
			'message' => __( 'No query provided.', 'agentic-admin' ),
			'results' => array(),
			'rows'    => 0,
		);
	}

	$safety = agentic_admin_check_query_safety( $query );
	if ( true !== $safety ) {
		return array(
			'success' => false,
			'message' => $safety,
			'results' => array(),
			'rows'    => 0,
		);
	}

	// Replace {prefix} placeholder with actual prefix.
	$query = str_replace( '{prefix}', $wpdb->prefix, $query );

	// The query is fully built by the LLM (the whole point of the ability),
	// so $wpdb->prepare() can't be used here — there are no separable
	// placeholders. Safety is enforced upstream by:
	// - read-only verb gate (SELECT/SHOW/DESCRIBE/EXPLAIN only)
	// - forbidden-keyword blocklist (INSERT/UPDATE/DELETE/DROP/…)
	// - sensitive-column blocklist (user_pass/user_email/…)
	// - 2000-char length cap
	// - manage_options capability check in permission_callback
	// - per-row redaction of sensitive columns as belt-and-suspenders.
	// Caching is intentionally skipped: each LLM-generated query is unique,
	// so a cache would never hit while doubling our database call surface.
	// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$results = $wpdb->get_results( $query, ARRAY_A );

	if ( null === $results ) {
		return array(
			'success' => false,
			'message' => ! empty( $wpdb->last_error ) ? $wpdb->last_error : __( 'Query failed.', 'agentic-admin' ),
			'results' => array(),
			'rows'    => 0,
		);
	}

	// Limit to 50 rows, then redact any sensitive columns that snuck
	// through (e.g. via SELECT *).
	$results = array_map(
		'agentic_admin_redact_sensitive_row',
		array_slice( $results, 0, 50 )
	);

	return array(
		'success' => true,
		'results' => $results,
		'rows'    => count( $results ),
	);
}
