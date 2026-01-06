<?php
/**
 * Site Health Ability
 *
 * Gets comprehensive site health information.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the site-health ability.
 *
 * @return void
 */
function wp_neural_admin_register_site_health(): void {
	register_neural_ability(
		'wp-neural-admin/site-health',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Site Health', 'wp-neural-admin' ),
			'description'         => __( 'Get comprehensive site health information.', 'wp-neural-admin' ),
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
					'wordpress_version' => array(
						'type'        => 'string',
						'description' => __( 'WordPress version.', 'wp-neural-admin' ),
					),
					'php_version'       => array(
						'type'        => 'string',
						'description' => __( 'PHP version.', 'wp-neural-admin' ),
					),
					'mysql_version'     => array(
						'type'        => 'string',
						'description' => __( 'MySQL version.', 'wp-neural-admin' ),
					),
					'site_url'          => array(
						'type'        => 'string',
						'description' => __( 'Site URL.', 'wp-neural-admin' ),
					),
					'home_url'          => array(
						'type'        => 'string',
						'description' => __( 'Home URL.', 'wp-neural-admin' ),
					),
					'is_multisite'      => array(
						'type'        => 'boolean',
						'description' => __( 'Whether this is a multisite installation.', 'wp-neural-admin' ),
					),
					'active_theme'      => array(
						'type'        => 'object',
						'description' => __( 'Active theme information.', 'wp-neural-admin' ),
					),
					'debug_mode'        => array(
						'type'        => 'boolean',
						'description' => __( 'Whether debug mode is enabled.', 'wp-neural-admin' ),
					),
					'memory_limit'      => array(
						'type'        => 'string',
						'description' => __( 'PHP memory limit.', 'wp-neural-admin' ),
					),
					'max_upload_size'   => array(
						'type'        => 'string',
						'description' => __( 'Maximum upload size.', 'wp-neural-admin' ),
					),
					'server_software'   => array(
						'type'        => 'string',
						'description' => __( 'Server software.', 'wp-neural-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_neural_admin_execute_site_health',
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
			'keywords'       => array( 'health', 'version', 'php', 'mysql', 'info', 'status', 'server', 'wordpress version', 'wp version', 'memory', 'memory limit', 'theme', 'url', 'site url', 'home url' ),
			'initialMessage' => __( 'Let me check that for you...', 'wp-neural-admin' ),
		)
	);
}

/**
 * Execute the site-health ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_site_health( array $input = array() ): array {
	global $wpdb;

	$theme = wp_get_theme();

	return array(
		'wordpress_version' => get_bloginfo( 'version' ),
		'php_version'       => phpversion(),
		'mysql_version'     => $wpdb->db_version(),
		'site_url'          => site_url(),
		'home_url'          => home_url(),
		'is_multisite'      => is_multisite(),
		'active_theme'      => array(
			'name'    => $theme->get( 'Name' ),
			'version' => $theme->get( 'Version' ),
		),
		'debug_mode'        => defined( 'WP_DEBUG' ) && WP_DEBUG,
		'memory_limit'      => WP_MEMORY_LIMIT,
		'max_upload_size'   => size_format( wp_max_upload_size() ),
		'server_software'   => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : 'Unknown',
	);
}
