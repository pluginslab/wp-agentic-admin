<?php
/**
 * Site Health Ability
 *
 * Gets comprehensive site health information.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the site-health ability.
 *
 * @return void
 */
function wp_agentic_admin_register_site_health(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/site-health',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Site Health', 'wp-agentic-admin' ),
			'description'         => __( 'Get comprehensive site health information.', 'wp-agentic-admin' ),
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
						'description' => __( 'WordPress version.', 'wp-agentic-admin' ),
					),
					'php_version'       => array(
						'type'        => 'string',
						'description' => __( 'PHP version.', 'wp-agentic-admin' ),
					),
					'mysql_version'     => array(
						'type'        => 'string',
						'description' => __( 'MySQL version.', 'wp-agentic-admin' ),
					),
					'site_url'          => array(
						'type'        => 'string',
						'description' => __( 'Site URL.', 'wp-agentic-admin' ),
					),
					'home_url'          => array(
						'type'        => 'string',
						'description' => __( 'Home URL.', 'wp-agentic-admin' ),
					),
					'is_multisite'      => array(
						'type'        => 'boolean',
						'description' => __( 'Whether this is a multisite installation.', 'wp-agentic-admin' ),
					),
					'active_theme'      => array(
						'type'        => 'object',
						'description' => __( 'Active theme information.', 'wp-agentic-admin' ),
					),
					'debug_mode'        => array(
						'type'        => 'boolean',
						'description' => __( 'Whether debug mode is enabled.', 'wp-agentic-admin' ),
					),
					'memory_limit'      => array(
						'type'        => 'string',
						'description' => __( 'PHP memory limit.', 'wp-agentic-admin' ),
					),
					'max_upload_size'   => array(
						'type'        => 'string',
						'description' => __( 'Maximum upload size.', 'wp-agentic-admin' ),
					),
					'server_software'   => array(
						'type'        => 'string',
						'description' => __( 'Server software.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_site_health',
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
			'initialMessage' => __( 'Let me check that for you...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the site-health ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_site_health( array $input = array() ): array {
	// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Required parameter for callback signature.
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
