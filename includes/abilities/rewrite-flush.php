<?php
/**
 * Rewrite Flush Ability
 *
 * Flushes the WordPress rewrite rules (permalinks).
 * Similar to WP-CLI: wp rewrite flush
 *
 * @package WPNeuralAdmin
 * @since 1.2.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the rewrite-flush ability.
 *
 * @return void
 */
function wp_neural_admin_register_rewrite_flush(): void {
	register_neural_ability(
		'wp-neural-admin/rewrite-flush',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Flush Rewrite Rules', 'wp-neural-admin' ),
			'description'         => __( 'Flush and regenerate WordPress permalink rewrite rules.', 'wp-neural-admin' ),
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
						'description' => __( 'Whether the operation was successful.', 'wp-neural-admin' ),
					),
					'message'             => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-neural-admin' ),
					),
					'permalink_structure' => array(
						'type'        => 'string',
						'description' => __( 'Current permalink structure.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_rewrite_flush',
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
			'keywords'       => array( 'rewrite', 'permalink', 'permalinks', 'flush', 'rules', '404', 'not found', 'url', 'slug' ),
			'initialMessage' => __( 'Flushing rewrite rules...', 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the rewrite-flush ability.
 *
 * @param array $input Input parameters (unused, included for API consistency).
 * @return array
 */
function wp_neural_admin_execute_rewrite_flush( array $input = array() ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
	// Flush the rewrite rules.
	flush_rewrite_rules();

	// Get the current permalink structure for confirmation.
	$permalink_structure = get_option( 'permalink_structure' );

	if ( empty( $permalink_structure ) ) {
		$permalink_display = __( 'Plain (default)', 'wp-neural-admin' );
	} else {
		$permalink_display = $permalink_structure;
	}

	return array(
		'success'             => true,
		'message'             => __( 'Rewrite rules flushed successfully. Permalinks have been regenerated.', 'wp-neural-admin' ),
		'permalink_structure' => $permalink_display,
	);
}
