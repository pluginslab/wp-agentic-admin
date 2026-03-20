<?php
/**
 * Update Check Ability
 *
 * Checks for available WordPress core, plugin, and theme updates.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the update-check ability.
 *
 * @return void
 */
function wp_agentic_admin_register_update_check(): void {
	register_agentic_ability(
		'wp-agentic-admin/update-check',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Check Updates', 'wp-agentic-admin' ),
			'description'         => __( 'Check for available WordPress core, plugin, and theme updates.', 'wp-agentic-admin' ),
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
					'core'    => array(
						'type'        => 'object',
						'description' => __( 'Core update info.', 'wp-agentic-admin' ),
					),
					'plugins' => array(
						'type'        => 'array',
						'description' => __( 'Plugins with available updates.', 'wp-agentic-admin' ),
					),
					'themes'  => array(
						'type'        => 'array',
						'description' => __( 'Themes with available updates.', 'wp-agentic-admin' ),
					),
					'total'   => array(
						'type'        => 'integer',
						'description' => __( 'Total number of available updates.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_update_check',
			'permission_callback' => function () {
				return current_user_can( 'update_core' );
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
			'keywords'       => array( 'update', 'updates', 'outdated', 'upgrade', 'version' ),
			'initialMessage' => __( "I'll check for available updates...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the update-check ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_update_check( array $input = array() ): array {
	// Ensure update functions are available.
	if ( ! function_exists( 'get_core_updates' ) ) {
		require_once ABSPATH . 'wp-admin/includes/update.php';
	}
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	// Core updates.
	$core_updates = get_core_updates();
	$core_info    = array(
		'current'   => get_bloginfo( 'version' ),
		'available' => false,
		'new_version' => '',
	);

	if ( ! empty( $core_updates ) && 'upgrade' === $core_updates[0]->response ) {
		$core_info['available']   = true;
		$core_info['new_version'] = $core_updates[0]->version;
	}

	// Plugin updates.
	$plugin_updates  = get_plugin_updates();
	$plugins_needing = array();

	foreach ( $plugin_updates as $file => $data ) {
		$plugins_needing[] = array(
			'name'        => $data->Name,
			'slug'        => $file,
			'current'     => $data->Version,
			'new_version' => $data->update->new_version,
		);
	}

	// Theme updates.
	$theme_updates  = get_theme_updates();
	$themes_needing = array();

	foreach ( $theme_updates as $slug => $theme ) {
		$themes_needing[] = array(
			'name'        => $theme->get( 'Name' ),
			'slug'        => $slug,
			'current'     => $theme->get( 'Version' ),
			'new_version' => $theme->update['new_version'],
		);
	}

	$total = ( $core_info['available'] ? 1 : 0 ) + count( $plugins_needing ) + count( $themes_needing );

	return array(
		'core'    => $core_info,
		'plugins' => $plugins_needing,
		'themes'  => $themes_needing,
		'total'   => $total,
	);
}
