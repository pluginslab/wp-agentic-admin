<?php
/**
 * Rewrite Flush Ability
 *
 * Flushes the WordPress rewrite rules (permalinks).
 * Similar to WP-CLI: wp rewrite flush
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the rewrite-flush ability.
 *
 * @return void
 */
function wp_agentic_admin_register_rewrite_flush(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/rewrite-flush',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Flush Rewrite Rules', 'wp-agentic-admin' ),
			'description'         => __( 'Flush and regenerate WordPress permalink rewrite rules.', 'wp-agentic-admin' ),
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
					'permalink_structure' => array(
						'type'        => 'string',
						'description' => __( 'Current permalink structure.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_rewrite_flush',
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
			'keywords'       => array( 'flush rewrite', 'flush permalink', 'regenerate permalink', 'refresh rewrite', 'reset rewrite', '404', 'not found' ),
			'initialMessage' => __( 'Flushing rewrite rules...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the rewrite-flush ability.
 *
 * @param array $input Input parameters (unused, included for API consistency).
 * @return array
 */
function wp_agentic_admin_execute_rewrite_flush( array $input = array() ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
	// Flush the rewrite rules.
	flush_rewrite_rules();

	// Get the current permalink structure for confirmation.
	$permalink_structure = get_option( 'permalink_structure' );

	if ( empty( $permalink_structure ) ) {
		$permalink_display = __( 'Plain (default)', 'wp-agentic-admin' );
	} else {
		$permalink_display = $permalink_structure;
	}

	return array(
		'success'             => true,
		'message'             => __( 'Rewrite rules flushed successfully. Permalinks have been regenerated.', 'wp-agentic-admin' ),
		'permalink_structure' => $permalink_display,
	);
}
