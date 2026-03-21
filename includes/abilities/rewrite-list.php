<?php
/**
 * Rewrite List Ability
 *
 * Lists and counts WordPress rewrite rules.
 * Similar to WP-CLI: wp rewrite list
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the rewrite-list ability.
 *
 * @return void
 */
function wp_agentic_admin_register_rewrite_list(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/rewrite-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Rewrite Rules', 'wp-agentic-admin' ),
			'description'         => __( 'List and count WordPress permalink rewrite rules.', 'wp-agentic-admin' ),
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
					'success'             => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the operation was successful.', 'wp-agentic-admin' ),
					),
					'message'             => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'rules_count'         => array(
						'type'        => 'integer',
						'description' => __( 'Total number of rewrite rules.', 'wp-agentic-admin' ),
					),
					'permalink_structure' => array(
						'type'        => 'string',
						'description' => __( 'Current permalink structure.', 'wp-agentic-admin' ),
					),
					'rule_categories'     => array(
						'type'                 => 'object',
						'description'          => __( 'Rewrite rule counts grouped by category.', 'wp-agentic-admin' ),
						'additionalProperties' => array(
							'type' => 'integer',
						),
					),
					'rule_sample'         => array(
						'type'        => 'array',
						'description' => __( 'Sample rewrite rules across categories.', 'wp-agentic-admin' ),
						'items'       => array(
							'type'       => 'object',
							'properties' => array(
								'category' => array(
									'type' => 'string',
								),
								'pattern'  => array(
									'type' => 'string',
								),
								'query'    => array(
									'type' => 'string',
								),
							),
						),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_rewrite_list',
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
			'keywords'       => array( 'rewrite', 'list', 'count', 'how many', 'show', 'view', 'rules', 'permalink', 'permalinks' ),
			'initialMessage' => __( 'Getting rewrite rules...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Get a normalized rewrite rule query string.
 *
 * @param mixed $query Rewrite rule query.
 * @return string
 */
function wp_agentic_admin_get_rewrite_rule_query_string( $query ): string {
	if ( is_string( $query ) ) {
		return $query;
	}

	if ( is_scalar( $query ) ) {
		return (string) $query;
	}

	$encoded_query = wp_json_encode( $query );

	return is_string( $encoded_query ) ? $encoded_query : '';
}

/**
 * Detect the category for a rewrite rule.
 *
 * @param string $pattern Rewrite rule pattern.
 * @param mixed  $query   Rewrite rule query.
 * @return string
 */
function wp_agentic_admin_get_rewrite_rule_category( string $pattern, $query ): string {
	$query_string = wp_agentic_admin_get_rewrite_rule_query_string( $query );

	if ( false !== strpos( $pattern, 'wp-sitemap' ) || false !== strpos( $query_string, 'wp-sitemap' ) ) {
		return 'sitemap';
	}

	if ( false !== strpos( $pattern, 'robots\.txt' ) ) {
		return 'robots';
	}

	if ( false !== strpos( $pattern, 'favicon\.ico' ) ) {
		return 'favicon';
	}

	if ( false !== strpos( $pattern, 'wp-json' ) || false !== strpos( $query_string, 'rest_route=' ) ) {
		return 'rest';
	}

	if ( false !== strpos( $query_string, 'category_name=' ) || false !== strpos( $query_string, 'category=' ) ) {
		return 'category';
	}

	if ( false !== strpos( $query_string, 'tag=' ) || false !== strpos( $query_string, 'tagname=' ) ) {
		return 'tag';
	}

	if ( false !== strpos( $query_string, 'taxonomy=' ) || false !== strpos( $query_string, 'term=' ) ) {
		return 'taxonomy';
	}

	if ( false !== strpos( $query_string, 'author_name=' ) || false !== strpos( $query_string, 'author=' ) ) {
		return 'author';
	}

	if (
		false !== strpos( $query_string, 'year=' ) ||
		false !== strpos( $query_string, 'monthnum=' ) ||
		false !== strpos( $query_string, 'day=' )
	) {
		return 'date';
	}

	if ( false !== strpos( $query_string, 's=' ) ) {
		return 'search';
	}

	if ( false !== strpos( $pattern, 'feed' ) || false !== strpos( $query_string, 'feed=' ) ) {
		return 'feed';
	}

	if ( false !== strpos( $query_string, 'attachment=' ) ) {
		return 'attachment';
	}

	if ( false !== strpos( $query_string, 'pagename=' ) ) {
		return 'page';
	}

	if ( false !== strpos( $query_string, 'name=' ) || false !== strpos( $query_string, 'post_type=post' ) ) {
		return 'post';
	}

	if ( false !== strpos( $pattern, 'page/?([0-9]{1,})/?$' ) || false !== strpos( $query_string, 'paged=' ) ) {
		return 'pagination';
	}

	return 'other';
}

/**
 * Build a balanced sample of rewrite rules across categories.
 *
 * @param array $categorized_rules Rewrite rules grouped by category.
 * @param int   $sample_limit      Maximum number of sample rules.
 * @return array
 */
function wp_agentic_admin_get_rewrite_rule_sample( array $categorized_rules, int $sample_limit = 20 ): array {
	$preferred_order = array(
		'post',
		'page',
		'category',
		'tag',
		'taxonomy',
		'author',
		'date',
		'search',
		'feed',
		'sitemap',
		'attachment',
		'rest',
		'robots',
		'favicon',
		'pagination',
		'other',
	);

	$category_names = array();

	foreach ( $preferred_order as $category_name ) {
		if ( ! empty( $categorized_rules[ $category_name ] ) ) {
			$category_names[] = $category_name;
		}
	}

	foreach ( array_keys( $categorized_rules ) as $category_name ) {
		if ( ! in_array( $category_name, $category_names, true ) ) {
			$category_names[] = $category_name;
		}
	}

	$sample = array();
	$index  = 0;

	$sampled_count = count( $sample );

	while ( $sampled_count < $sample_limit ) {
		$added_rule = false;

		foreach ( $category_names as $category_name ) {
			if ( ! isset( $categorized_rules[ $category_name ][ $index ] ) ) {
				continue;
			}

			$sample[]   = $categorized_rules[ $category_name ][ $index ];
			$added_rule = true;

			if ( count( $sample ) >= $sample_limit ) {
				break;
			}
		}

		if ( ! $added_rule ) {
			break;
		}

		++$index;
	}

	return $sample;
}

/**
 * Execute the rewrite-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_rewrite_list( array $input = array() ): array {
	// Get all rewrite rules.
	$rules       = get_option( 'rewrite_rules' );
	$rules_count = is_array( $rules ) ? count( $rules ) : 0;

	// Get the current permalink structure.
	$permalink_structure = get_option( 'permalink_structure' );

	if ( empty( $permalink_structure ) ) {
		$permalink_display = __( 'Plain (default)', 'wp-agentic-admin' );
	} else {
		$permalink_display = $permalink_structure;
	}

	$categorized_counts = array();
	$categorized_rules  = array();

	if ( is_array( $rules ) ) {
		foreach ( $rules as $pattern => $query ) {
			$category = wp_agentic_admin_get_rewrite_rule_category( $pattern, $query );

			if ( ! isset( $categorized_counts[ $category ] ) ) {
				$categorized_counts[ $category ] = 0;
				$categorized_rules[ $category ]  = array();
			}

			++$categorized_counts[ $category ];

			$categorized_rules[ $category ][] = array(
				'category' => $category,
				'pattern'  => $pattern,
				'query'    => wp_agentic_admin_get_rewrite_rule_query_string( $query ),
			);
		}
	}

	if ( ! empty( $categorized_counts ) ) {
		arsort( $categorized_counts );
	}

	$result = array(
		'success'             => true,
		'message'             => sprintf(
			/* translators: %d: number of rewrite rules */
			__( 'Found %d rewrite rules.', 'wp-agentic-admin' ),
			$rules_count
		),
		'rules_count'         => $rules_count,
		'permalink_structure' => $permalink_display,
		'rule_categories'     => $categorized_counts,
		'rule_sample'         => wp_agentic_admin_get_rewrite_rule_sample( $categorized_rules, 20 ),
	);

	return $result;
}
