<?php
/**
 * Plugin Install Ability
 *
 * Installs a plugin from the WordPress.org plugin directory.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the plugin-install ability.
 *
 * @return void
 */
function wp_agentic_admin_register_plugin_install(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/plugin-install',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Install Plugin', 'wp-agentic-admin' ),
			'description'         => __( 'Install a plugin from the WordPress.org plugin directory by name or slug.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'plugin'   => array(
						'type'        => 'string',
						'description' => __( 'The plugin name or slug to install from WordPress.org.', 'wp-agentic-admin' ),
					),
					'activate' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether to activate the plugin after installing.', 'wp-agentic-admin' ),
						'default'     => false,
					),
				),
				'required'             => array( 'plugin' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the plugin was successfully installed.', 'wp-agentic-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_plugin_install',
			'permission_callback' => function () {
				return current_user_can( 'install_plugins' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'     => false,
					'destructive'  => false,
					'idempotent'   => true,
					'instructions' => __( 'This will download and install a plugin from WordPress.org. The plugin will not be activated unless explicitly requested.', 'wp-agentic-admin' ),
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'             => array( 'install', 'download', 'add plugin', 'get plugin', 'install plugin' ),
			'initialMessage'       => __( 'Installing the plugin...', 'wp-agentic-admin' ),
			'requiresConfirmation' => true,
		)
	);
}

/**
 * Execute the plugin-install ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_plugin_install( array $input = array() ): array {
	if ( empty( $input['plugin'] ) ) {
		return array(
			'success' => false,
			'message' => __( 'No plugin specified.', 'wp-agentic-admin' ),
		);
	}

	$plugin_slug = sanitize_text_field( $input['plugin'] );
	$activate    = ! empty( $input['activate'] );

	// Normalize: strip paths, lowercase, convert spaces to hyphens.
	$plugin_slug = strtolower( trim( $plugin_slug ) );
	$plugin_slug = preg_replace( '/\s+/', '-', $plugin_slug );
	$plugin_slug = preg_replace( '/[^a-z0-9\-]/', '', $plugin_slug );

	if ( '' === $plugin_slug ) {
		return array(
			'success' => false,
			'message' => __( 'Invalid plugin slug.', 'wp-agentic-admin' ),
		);
	}

	// Check if plugin is already installed.
	$resolved = wp_agentic_admin_resolve_plugin( $plugin_slug );
	if ( null !== $resolved['plugin_file'] && $resolved['certainty'] >= 8.0 ) {
		$plugin_data = wp_agentic_admin_get_plugin_by_slug( $resolved['plugin_file'] );
		$status      = $plugin_data && $plugin_data['active'] ? __( 'active', 'wp-agentic-admin' ) : __( 'inactive', 'wp-agentic-admin' );

		return array(
			'success'       => true,
			'message'       => sprintf(
				/* translators: 1: plugin name, 2: plugin status */
				__( 'Plugin "%1$s" is already installed (%2$s).', 'wp-agentic-admin' ),
				$resolved['plugin_name'],
				$status
			),
			'already_installed' => true,
			'plugin_name'   => $resolved['plugin_name'],
			'plugin_slug'   => $resolved['plugin_file'],
			'active'        => $plugin_data && $plugin_data['active'],
		);
	}

	// Load required WordPress files for plugin installation.
	if ( ! function_exists( 'plugins_api' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
	}
	if ( ! class_exists( 'Plugin_Upgrader' ) ) {
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
	}
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';

	// Look up the plugin on WordPress.org.
	$api = plugins_api(
		'plugin_information',
		array(
			'slug'   => $plugin_slug,
			'fields' => array(
				'short_description' => true,
				'sections'          => false,
				'requires'          => true,
				'tested'            => true,
				'rating'            => false,
				'downloaded'        => false,
				'download_link'     => true,
				'last_updated'      => false,
				'homepage'          => false,
				'tags'              => false,
			),
		)
	);

	if ( is_wp_error( $api ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: 1: plugin slug, 2: error message */
				__( 'Could not find plugin "%1$s" on WordPress.org: %2$s', 'wp-agentic-admin' ),
				$plugin_slug,
				$api->get_error_message()
			),
		);
	}

	// Verify download link is available.
	if ( empty( $api->download_link ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'No download link available for "%s".', 'wp-agentic-admin' ),
				$api->name ?? $plugin_slug
			),
		);
	}

	// Install the plugin using a silent skin.
	$skin     = new WP_Ajax_Upgrader_Skin();
	$upgrader = new Plugin_Upgrader( $skin );
	$result   = $upgrader->install( $api->download_link );

	if ( is_wp_error( $result ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: 1: plugin name, 2: error message */
				__( 'Failed to install "%1$s": %2$s', 'wp-agentic-admin' ),
				$api->name,
				$result->get_error_message()
			),
		);
	}

	if ( true !== $result ) {
		$errors    = $skin->get_errors();
		$feedback  = $skin->get_upgrade_messages();
		$error_msg = '';

		if ( is_wp_error( $errors ) && $errors->has_errors() ) {
			$error_msg = $errors->get_error_message();
		} elseif ( ! empty( $feedback ) ) {
			$error_msg = implode( ' ', $feedback );
		} else {
			$error_msg = __( 'Unknown error during installation.', 'wp-agentic-admin' );
		}

		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: 1: plugin name, 2: error message */
				__( 'Failed to install "%1$s": %2$s', 'wp-agentic-admin' ),
				$api->name,
				$error_msg
			),
		);
	}

	$activated = false;

	// Optionally activate the plugin.
	if ( $activate ) {
		// Clear the plugin cache so get_plugins() picks up the new plugin.
		wp_clean_plugins_cache();

		$installed = wp_agentic_admin_resolve_plugin( $plugin_slug );
		if ( null !== $installed['plugin_file'] ) {
			$activate_result = activate_plugin( $installed['plugin_file'] );
			$activated       = ! is_wp_error( $activate_result );
		}
	}

	$message = sprintf(
		/* translators: %s: plugin name */
		__( 'Plugin "%s" has been installed successfully.', 'wp-agentic-admin' ),
		$api->name
	);

	if ( $activate && $activated ) {
		$message = sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been installed and activated successfully.', 'wp-agentic-admin' ),
			$api->name
		);
	} elseif ( $activate && ! $activated ) {
		$message = sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" was installed but could not be activated.', 'wp-agentic-admin' ),
			$api->name
		);
	}

	return array(
		'success'     => true,
		'message'     => $message,
		'plugin_name' => $api->name,
		'plugin_slug' => $plugin_slug,
		'activated'   => $activated,
	);
}
