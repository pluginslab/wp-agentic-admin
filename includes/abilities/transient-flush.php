<?php
/**
 * Transient Flush Ability
 *
 * Deletes expired or all transients from the database.
 * Similar to WP-CLI: wp transient delete --all / --expired
 *
 * @package WPNeuralAdmin
 * @since 1.2.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the transient-flush ability.
 *
 * @return void
 */
function wp_neural_admin_register_transient_flush(): void {
	register_neural_ability(
		'wp-neural-admin/transient-flush',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Flush Transients', 'wp-neural-admin' ),
			'description'         => __( 'Delete expired or all transients from the database.', 'wp-neural-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'expired_only' => array(
						'type'        => 'boolean',
						'description' => __( 'If true, only delete expired transients. If false, delete all transients.', 'wp-neural-admin' ),
						'default'     => true,
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'       => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the operation was successful.', 'wp-neural-admin' ),
					),
					'message'       => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-neural-admin' ),
					),
					'deleted_count' => array(
						'type'        => 'integer',
						'description' => __( 'Number of transients deleted.', 'wp-neural-admin' ),
					),
					'expired_only'  => array(
						'type'        => 'boolean',
						'description' => __( 'Whether only expired transients were deleted.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_transient_flush',
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
			'keywords'       => array( 'transient', 'transients', 'flush', 'clear', 'delete', 'expired', 'cleanup' ),
			'initialMessage' => __( 'Flushing transients...', 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the transient-flush ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_transient_flush( array $input = array() ): array {
	global $wpdb;

	$expired_only = isset( $input['expired_only'] ) ? (bool) $input['expired_only'] : true;
	$deleted      = 0;
	$time         = time();

	if ( $expired_only ) {
		// Delete only expired transients.
		// Transients are stored with a timeout option: _transient_timeout_{name}.
		// If the timeout value is less than current time, it's expired.

		// Get expired transient timeout options.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query needed to find expired transients efficiently.
		$expired = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT option_name FROM {$wpdb->options} 
				WHERE option_name LIKE %s 
				AND option_value < %d",
				$wpdb->esc_like( '_transient_timeout_' ) . '%',
				$time
			)
		);

		if ( ! empty( $expired ) ) {
			foreach ( $expired as $transient_timeout ) {
				// Extract transient name from timeout option name.
				$transient_name = str_replace( '_transient_timeout_', '', $transient_timeout );

				// Delete the transient (this deletes both the value and timeout).
				if ( delete_transient( $transient_name ) ) {
					++$deleted;
				}
			}
		}

		// Also handle site transients for multisite.
		if ( is_multisite() ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query needed for multisite transient cleanup.
			$expired_site = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT meta_key FROM {$wpdb->sitemeta} 
					WHERE meta_key LIKE %s 
					AND meta_value < %d",
					$wpdb->esc_like( '_site_transient_timeout_' ) . '%',
					$time
				)
			);

			if ( ! empty( $expired_site ) ) {
				foreach ( $expired_site as $transient_timeout ) {
					$transient_name = str_replace( '_site_transient_timeout_', '', $transient_timeout );
					if ( delete_site_transient( $transient_name ) ) {
						++$deleted;
					}
				}
			}
		}

		$message = sprintf(
			/* translators: %d: number of transients deleted */
			_n(
				'Deleted %d expired transient.',
				'Deleted %d expired transients.',
				$deleted,
				'wp-neural-admin'
			),
			$deleted
		);
	} else {
		// Delete ALL transients.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$deleted = $wpdb->query(
			"DELETE FROM {$wpdb->options} 
			WHERE option_name LIKE '_transient_%' 
			OR option_name LIKE '_site_transient_%'"
		);

		$message = sprintf(
			/* translators: %d: number of transients deleted */
			_n(
				'Deleted %d transient.',
				'Deleted %d transients.',
				$deleted,
				'wp-neural-admin'
			),
			$deleted
		);
	}

	// Clear the options cache after direct DB manipulation.
	wp_cache_flush();

	return array(
		'success'       => true,
		'message'       => $message,
		'deleted_count' => (int) $deleted,
		'expired_only'  => $expired_only,
	);
}
