<?php
/**
 * Backup Check Ability
 *
 * Checks backup plugin status and last backup time.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the backup-check ability.
 *
 * @return void
 */
function wp_agentic_admin_register_backup_check(): void {
	register_agentic_ability(
		'wp-agentic-admin/backup-check',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Check Backup Status', 'wp-agentic-admin' ),
			'description'         => __( 'Check backup plugin status and last backup time.', 'wp-agentic-admin' ),
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
					'has_backup_plugin' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether a backup plugin is detected.', 'wp-agentic-admin' ),
					),
					'plugin'            => array(
						'type'        => 'string',
						'description' => __( 'Detected backup plugin name.', 'wp-agentic-admin' ),
					),
					'last_backup'       => array(
						'type'        => 'string',
						'description' => __( 'Last backup date if available.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_backup_check',
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
			'keywords'       => array( 'backup', 'backups', 'restore', 'recovery' ),
			'initialMessage' => __( "I'll check your backup status...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the backup-check ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_backup_check( array $input = array() ): array {
	if ( ! function_exists( 'is_plugin_active' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	// Known backup plugins.
	$backup_plugins = array(
		array(
			'slug' => 'updraftplus/updraftplus.php',
			'name' => 'UpdraftPlus',
		),
		array(
			'slug' => 'backwpup/backwpup.php',
			'name' => 'BackWPup',
		),
		array(
			'slug' => 'jetpack/jetpack.php',
			'name' => 'Jetpack (VaultPress)',
		),
		array(
			'slug' => 'blogvault-real-time-backup/developer_developer.php',
			'name' => 'BlogVault',
		),
		array(
			'slug' => 'duplicator/duplicator.php',
			'name' => 'Duplicator',
		),
		array(
			'slug' => 'all-in-one-wp-migration/all-in-one-wp-migration.php',
			'name' => 'All-in-One WP Migration',
		),
	);

	$detected = array();

	foreach ( $backup_plugins as $plugin ) {
		if ( is_plugin_active( $plugin['slug'] ) ) {
			$info = array(
				'name'        => $plugin['name'],
				'active'      => true,
				'last_backup' => wp_agentic_admin_get_last_backup_time( $plugin['slug'] ),
			);

			$detected[] = $info;
		}
	}

	if ( empty( $detected ) ) {
		return array(
			'has_backup_plugin' => false,
			'plugin'            => '',
			'last_backup'       => '',
			'detected'          => array(),
			'message'           => 'No backup plugin detected. Consider installing one for data safety.',
		);
	}

	return array(
		'has_backup_plugin' => true,
		'plugin'            => $detected[0]['name'],
		'last_backup'       => $detected[0]['last_backup'],
		'detected'          => $detected,
	);
}

/**
 * Get last backup time for a specific backup plugin.
 *
 * @param string $plugin_slug Plugin file slug.
 * @return string Date string or 'Unknown'.
 */
function wp_agentic_admin_get_last_backup_time( string $plugin_slug ): string {
	global $wpdb;

	switch ( $plugin_slug ) {
		case 'updraftplus/updraftplus.php':
			$option = get_option( 'updraft_last_backup' );
			if ( is_array( $option ) && isset( $option['last_backup'] ) ) {
				return gmdate( 'Y-m-d H:i:s', $option['last_backup'] );
			}
			break;

		case 'backwpup/backwpup.php':
			$option = get_site_option( 'backwpup_last_backup' );
			if ( is_numeric( $option ) ) {
				return gmdate( 'Y-m-d H:i:s', (int) $option );
			}
			break;

		case 'duplicator/duplicator.php':
			// Duplicator stores packages in its own table.
			$table = $wpdb->prefix . 'duplicator_packages';
			if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$last = $wpdb->get_var( "SELECT MAX(created) FROM `$table` WHERE status = 100" );
				if ( $last ) {
					return $last;
				}
			}
			// Duplicator Lite stores in options.
			$packages = get_option( 'duplicator_package_active', array() );
			if ( ! empty( $packages ) && is_array( $packages ) && isset( $packages['Created'] ) ) {
				return $packages['Created'];
			}
			break;

		case 'jetpack/jetpack.php':
			// VaultPress/Jetpack Backup stores timestamp in option.
			$option = get_option( 'vaultpress_backup_last' );
			if ( is_numeric( $option ) ) {
				return gmdate( 'Y-m-d H:i:s', (int) $option );
			}
			break;

		case 'blogvault-real-time-backup/developer_developer.php':
			// BlogVault stores last backup info in option.
			$option = get_option( 'bv_last_backup_time' );
			if ( is_numeric( $option ) ) {
				return gmdate( 'Y-m-d H:i:s', (int) $option );
			}
			break;

		case 'all-in-one-wp-migration/all-in-one-wp-migration.php':
			// All-in-One WP Migration stores exports in its backups dir.
			$backups_dir = WP_CONTENT_DIR . '/ai1wm-backups/';
			if ( is_dir( $backups_dir ) ) {
				$files = glob( $backups_dir . '*.wpress' );
				if ( ! empty( $files ) ) {
					$latest = 0;
					foreach ( $files as $file ) {
						$mtime = filemtime( $file );
						if ( $mtime > $latest ) {
							$latest = $mtime;
						}
					}
					if ( $latest > 0 ) {
						return gmdate( 'Y-m-d H:i:s', $latest );
					}
				}
			}
			break;
	}

	return 'Unknown';
}
