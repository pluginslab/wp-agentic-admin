<?php
/**
 * Theme List Ability
 *
 * Lists all installed themes with their status.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the theme-list ability.
 *
 * @return void
 */
function wp_agentic_admin_register_theme_list(): void {
	register_agentic_ability(
		'wp-agentic-admin/theme-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Themes', 'wp-agentic-admin' ),
			'description'         => __( 'List all installed themes with their activation status.', 'wp-agentic-admin' ),
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
					'themes' => array(
						'type'        => 'array',
						'items'       => array(
							'type'       => 'object',
							'properties' => array(
								'name'    => array( 'type' => 'string' ),
								'slug'    => array( 'type' => 'string' ),
								'version' => array( 'type' => 'string' ),
								'active'  => array( 'type' => 'boolean' ),
								'parent'  => array( 'type' => 'string' ),
							),
						),
						'description' => __( 'List of themes.', 'wp-agentic-admin' ),
					),
					'total'  => array(
						'type'        => 'integer',
						'description' => __( 'Total number of themes.', 'wp-agentic-admin' ),
					),
					'active' => array(
						'type'        => 'string',
						'description' => __( 'Slug of the active theme.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_theme_list',
			'permission_callback' => function () {
				return current_user_can( 'switch_themes' );
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
			'keywords'       => array( 'theme', 'themes', 'template', 'templates', 'appearance' ),
			'initialMessage' => __( "I'll check your installed themes...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the theme-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_theme_list( array $input = array() ): array {
	$installed    = wp_get_themes();
	$active_theme = get_stylesheet();
	$themes       = array();

	foreach ( $installed as $slug => $theme ) {
		$themes[] = array(
			'name'    => $theme->get( 'Name' ),
			'slug'    => $slug,
			'version' => $theme->get( 'Version' ),
			'active'  => ( $slug === $active_theme ),
			'parent'  => $theme->parent() ? $theme->parent()->get( 'Name' ) : '',
		);
	}

	return array(
		'themes' => $themes,
		'total'  => count( $themes ),
		'active' => $active_theme,
	);
}
