<?php
/**
 * Rewrite List Ability
 *
 * Lists and counts WordPress rewrite rules.
 * Similar to WP-CLI: wp rewrite list
 *
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
	register_agentic_ability(
		'wp-agentic-admin/rewrite-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Rewrite Rules', 'wp-agentic-admin' ),
			'description'         => __( 'List and count WordPress permalink rewrite rules.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(),
				'properties'           => array(
					'show_details' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether to show detailed rule information.', 'wp-agentic-admin' ),
						'default'     => false,
					),
				),
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
					'rules'               => array(
						'type'        => 'array',
						'description' => __( 'Array of rewrite rules (if show_details is true).', 'wp-agentic-admin' ),
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
 * Execute the rewrite-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_rewrite_list( array $input = array() ): array {
	global $wp_rewrite;

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

	$result = array(
		'success'             => true,
		'message'             => sprintf(
			/* translators: %d: number of rewrite rules */
			__( 'Found %d rewrite rules.', 'wp-agentic-admin' ),
			$rules_count
		),
		'rules_count'         => $rules_count,
		'permalink_structure' => $permalink_display,
	);

	// Include detailed rules if requested.
	$show_details = $input['show_details'] ?? false;
	if ( $show_details && is_array( $rules ) ) {
		$rules_array = array();
		foreach ( $rules as $pattern => $query ) {
			$rules_array[] = array(
				'pattern' => $pattern,
				'query'   => $query,
			);
		}
		$result['rules'] = $rules_array;
	}

	return $result;
}
