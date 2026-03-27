<?php
/**
 * Schema Extract Ability
 *
 * Extracts database table schemas for local RAG knowledge base indexing.
 * Returns human-readable schema chunks with semantic context for core WP tables.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the schema-extract ability.
 *
 * @return void
 */
function wp_agentic_admin_register_schema_extract(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/schema-extract',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Extract Database Schema', 'wp-agentic-admin' ),
			'description'         => __( 'Extract database table schemas for knowledge base indexing.', 'wp-agentic-admin' ),
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
					'chunks'       => array(
						'type'        => 'array',
						'description' => __( 'Schema chunks with table info.', 'wp-agentic-admin' ),
					),
					'total_tables' => array(
						'type'        => 'integer',
						'description' => __( 'Total tables extracted.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_schema_extract',
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
			'keywords'       => array( 'schema', 'database', 'tables', 'extract schema' ),
			'initialMessage' => __( 'Extracting database schema...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Get semantic context descriptions for core WordPress tables.
 *
 * @return array<string, string> Map of short table name to description.
 */
function wp_agentic_admin_get_core_table_context(): array {
	return array(
		'posts'              => 'Stores blog posts, pages, custom post types, and revisions. Each row is a content item with title, content, status, author, and dates.',
		'postmeta'           => 'Key-value metadata for posts. Stores custom fields, plugin data, and internal WordPress post metadata.',
		'comments'           => 'Stores comments on posts. Includes author info, content, approval status, and parent comment for threading.',
		'commentmeta'        => 'Key-value metadata for comments. Used by plugins like Akismet for spam detection data.',
		'terms'              => 'Stores taxonomy terms (categories, tags, custom taxonomy terms). Contains term name and slug.',
		'term_taxonomy'      => 'Links terms to taxonomies. Stores the taxonomy type (category, post_tag, etc.) and hierarchy (parent).',
		'term_relationships' => 'Links posts to taxonomy terms. Maps object IDs (posts) to term_taxonomy_id entries.',
		'termmeta'           => 'Key-value metadata for taxonomy terms.',
		'users'              => 'WordPress user accounts. Stores login, display name, and registration date.',
		'usermeta'           => 'Key-value metadata for users. Stores roles, capabilities, preferences, and plugin user data.',
		'options'            => 'Site-wide settings and configuration. Key-value store for WordPress settings, plugin options, and widget data. autoload column controls which options load on every page.',
		'links'              => 'Blogroll links (legacy feature, rarely used in modern WordPress).',
	);
}

/**
 * Execute the schema-extract ability.
 *
 * Runs SHOW TABLES, then DESCRIBE + SHOW INDEX for each table.
 * Redacts sensitive columns (user_pass, user_email, etc.).
 *
 * @param array $input Input parameters (unused).
 * @return array
 */
function wp_agentic_admin_execute_schema_extract( array $input = array() ): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$tables = $wpdb->get_col( 'SHOW TABLES' );

	if ( empty( $tables ) ) {
		return array(
			'success'      => false,
			'message'      => 'No tables found.',
			'chunks'       => array(),
			'total_tables' => 0,
		);
	}

	$core_context      = wp_agentic_admin_get_core_table_context();
	$sensitive_columns = array( 'user_pass', 'user_email', 'user_activation_key', 'session_tokens' );
	$prefix            = $wpdb->prefix;
	$chunks            = array();

	foreach ( $tables as $table ) {
		// Validate table name to prevent SQL injection — only allow alphanumeric + underscore.
		if ( ! preg_match( '/^[a-zA-Z0-9_]+$/', $table ) ) {
			continue;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$columns = $wpdb->get_results( "DESCRIBE `{$table}`", ARRAY_A );

		if ( empty( $columns ) ) {
			continue;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$indexes = $wpdb->get_results( "SHOW INDEX FROM `{$table}`", ARRAY_A );

		// Build human-readable schema.
		$schema_lines   = array();
		$schema_lines[] = "Table: {$table}";

		// Add semantic context for core WP tables.
		$short_name = str_replace( $prefix, '', $table );
		if ( isset( $core_context[ $short_name ] ) ) {
			$schema_lines[] = 'Purpose: ' . $core_context[ $short_name ];
		}

		$schema_lines[] = '';
		$schema_lines[] = 'Columns:';

		foreach ( $columns as $col ) {
			$col_name = $col['Field'];

			// Redact sensitive columns.
			if ( in_array( $col_name, $sensitive_columns, true ) ) {
				$schema_lines[] = "  {$col_name}: [REDACTED] ({$col['Type']})";
				continue;
			}

			$nullable = 'YES' === $col['Null'] ? ', nullable' : '';
			$default  = null !== $col['Default'] ? ", default: {$col['Default']}" : '';
			$key      = $col['Key'] ? ", key: {$col['Key']}" : '';
			$extra    = $col['Extra'] ? ", {$col['Extra']}" : '';

			$schema_lines[] = "  {$col_name}: {$col['Type']}{$nullable}{$default}{$key}{$extra}";
		}

		// Add index info.
		if ( ! empty( $indexes ) ) {
			$index_groups = array();

			foreach ( $indexes as $idx ) {
				$idx_name = $idx['Key_name'];
				if ( ! isset( $index_groups[ $idx_name ] ) ) {
					$index_groups[ $idx_name ] = array(
						'unique'  => ! $idx['Non_unique'],
						'columns' => array(),
					);
				}
				$index_groups[ $idx_name ]['columns'][] = $idx['Column_name'];
			}

			$schema_lines[] = '';
			$schema_lines[] = 'Indexes:';

			foreach ( $index_groups as $idx_name => $idx_info ) {
				$type           = $idx_info['unique'] ? 'UNIQUE' : 'INDEX';
				$cols           = implode( ', ', $idx_info['columns'] );
				$schema_lines[] = "  {$idx_name} ({$type}): {$cols}";
			}
		}

		$chunks[] = array(
			'path'       => "db://{$table}",
			'start_line' => 1,
			'end_line'   => count( $schema_lines ),
			'content'    => implode( "\n", $schema_lines ),
			'type'       => 'schema',
		);
	}

	return array(
		'success'      => true,
		'chunks'       => $chunks,
		'total_tables' => count( $tables ),
	);
}
