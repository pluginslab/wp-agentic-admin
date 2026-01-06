<?php
/**
 * Abilities class
 *
 * Registers SRE abilities with the WordPress Abilities API.
 *
 * @package WPNeuralAdmin
 */

namespace WPNeuralAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Abilities {

	/**
	 * Singleton instance.
	 *
	 * @var Abilities|null
	 */
	private static ?Abilities $instance = null;

	/**
	 * Get the singleton instance.
	 *
	 * @return Abilities
	 */
	public static function get_instance(): Abilities {
		if ( null === self::$instance ) {
			self::$instance = new Abilities();
		}
		return self::$instance;
	}

	/**
	 * Initialize the class.
	 */
	public function __construct() {
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Register the SRE tools category.
	 */
	public function register_category(): void {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		wp_register_ability_category(
			'sre-tools',
			array(
				'label'       => __( 'SRE Tools', 'wp-neural-admin' ),
				'description' => __( 'Site Reliability Engineering tools for diagnostics and maintenance.', 'wp-neural-admin' ),
			)
		);
	}

	/**
	 * Register all SRE abilities.
	 */
	public function register_abilities(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		$this->register_error_log_read();
		$this->register_cache_flush();
		$this->register_db_optimize();
		$this->register_plugin_list();
		$this->register_plugin_deactivate();
		$this->register_site_health();
	}

	/**
	 * Register error-log-read ability.
	 */
	private function register_error_log_read(): void {
		wp_register_ability(
			'wp-neural-admin/error-log-read',
			array(
				'label'               => __( 'Read Error Log', 'wp-neural-admin' ),
				'description'         => __( 'Read recent entries from the WordPress debug.log file.', 'wp-neural-admin' ),
				'category'            => 'sre-tools',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'lines' => array(
							'type'        => 'integer',
							'default'     => 50,
							'minimum'     => 1,
							'maximum'     => 500,
							'description' => __( 'Number of lines to read from the end of the log.', 'wp-neural-admin' ),
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'entries'     => array(
							'type'        => 'array',
							'items'       => array( 'type' => 'string' ),
							'description' => __( 'Log entries from the debug.log file.', 'wp-neural-admin' ),
						),
						'file_exists' => array(
							'type'        => 'boolean',
							'description' => __( 'Whether the debug.log file exists.', 'wp-neural-admin' ),
						),
						'debug_enabled' => array(
							'type'        => 'boolean',
							'description' => __( 'Whether WP_DEBUG_LOG is enabled.', 'wp-neural-admin' ),
						),
						'total_lines' => array(
							'type'        => 'integer',
							'description' => __( 'Total number of lines in the log file.', 'wp-neural-admin' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'execute_error_log_read' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'annotations'  => array(
						// Note: readonly should be true, but Abilities API has a bug where
						// GET request input params aren't JSON-decoded. Using POST workaround.
						// See: https://github.com/WordPress/abilities-api/issues/XXX
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => true,
					),
				),
			)
		);
	}

	/**
	 * Execute error-log-read ability.
	 *
	 * @param array $input Input parameters.
	 * @return array
	 */
	public function execute_error_log_read( array $input = array() ): array {
		$lines         = isset( $input['lines'] ) ? absint( $input['lines'] ) : 50;
		$lines         = min( $lines, 500 ); // Cap at 500.
		$log_path      = Utils::get_debug_log_path();
		$debug_enabled = Utils::is_debug_log_enabled();

		if ( ! file_exists( $log_path ) || ! is_readable( $log_path ) ) {
			return array(
				'entries'       => array(),
				'file_exists'   => false,
				'debug_enabled' => $debug_enabled,
				'total_lines'   => 0,
			);
		}

		// Read file and get last N lines.
		$file_content = file_get_contents( $log_path );
		if ( false === $file_content ) {
			return array(
				'entries'       => array(),
				'file_exists'   => true,
				'debug_enabled' => $debug_enabled,
				'total_lines'   => 0,
			);
		}

		$all_lines   = explode( "\n", $file_content );
		$total_lines = count( $all_lines );
		$entries     = array_slice( $all_lines, -$lines );
		$entries     = array_filter( $entries ); // Remove empty lines.
		$entries     = array_values( $entries ); // Re-index.

		return array(
			'entries'       => $entries,
			'file_exists'   => true,
			'debug_enabled' => $debug_enabled,
			'total_lines'   => $total_lines,
		);
	}

	/**
	 * Register cache-flush ability.
	 */
	private function register_cache_flush(): void {
		wp_register_ability(
			'wp-neural-admin/cache-flush',
			array(
				'label'               => __( 'Flush Cache', 'wp-neural-admin' ),
				'description'         => __( 'Flush the WordPress object cache.', 'wp-neural-admin' ),
				'category'            => 'sre-tools',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'success' => array(
							'type'        => 'boolean',
							'description' => __( 'Whether the cache was successfully flushed.', 'wp-neural-admin' ),
						),
						'message' => array(
							'type'        => 'string',
							'description' => __( 'Status message.', 'wp-neural-admin' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'execute_cache_flush' ),
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
			)
		);
	}

	/**
	 * Execute cache-flush ability.
	 *
	 * @param array $input Input parameters.
	 * @return array
	 */
	public function execute_cache_flush( array $input = array() ): array {
		$result = wp_cache_flush();

		return array(
			'success' => $result,
			'message' => $result
				? __( 'Object cache flushed successfully.', 'wp-neural-admin' )
				: __( 'Failed to flush object cache.', 'wp-neural-admin' ),
		);
	}

	/**
	 * Register db-optimize ability.
	 */
	private function register_db_optimize(): void {
		wp_register_ability(
			'wp-neural-admin/db-optimize',
			array(
				'label'               => __( 'Optimize Database', 'wp-neural-admin' ),
				'description'         => __( 'Optimize WordPress database tables.', 'wp-neural-admin' ),
				'category'            => 'sre-tools',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'success'          => array(
							'type'        => 'boolean',
							'description' => __( 'Whether the optimization was successful.', 'wp-neural-admin' ),
						),
						'tables_optimized' => array(
							'type'        => 'integer',
							'description' => __( 'Number of tables optimized.', 'wp-neural-admin' ),
						),
						'tables'           => array(
							'type'        => 'array',
							'items'       => array( 'type' => 'string' ),
							'description' => __( 'List of optimized table names.', 'wp-neural-admin' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'execute_db_optimize' ),
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
			)
		);
	}

	/**
	 * Execute db-optimize ability.
	 *
	 * @param array $input Input parameters.
	 * @return array
	 */
	public function execute_db_optimize( array $input = array() ): array {
		global $wpdb;

		$tables           = $wpdb->get_results( 'SHOW TABLES', ARRAY_N );
		$optimized_tables = array();

		foreach ( $tables as $table ) {
			$table_name = $table[0];
			// Only optimize tables with our prefix for safety.
			if ( 0 === strpos( $table_name, $wpdb->prefix ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->query( $wpdb->prepare( 'OPTIMIZE TABLE %i', $table_name ) );
				$optimized_tables[] = $table_name;
			}
		}

		return array(
			'success'          => count( $optimized_tables ) > 0,
			'tables_optimized' => count( $optimized_tables ),
			'tables'           => $optimized_tables,
		);
	}

	/**
	 * Register plugin-list ability.
	 */
	private function register_plugin_list(): void {
		wp_register_ability(
			'wp-neural-admin/plugin-list',
			array(
				'label'               => __( 'List Plugins', 'wp-neural-admin' ),
				'description'         => __( 'Get a list of all installed plugins with their status.', 'wp-neural-admin' ),
				'category'            => 'sre-tools',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'plugins' => array(
							'type'        => 'array',
							'items'       => array(
								'type'       => 'object',
								'properties' => array(
									'name'        => array( 'type' => 'string' ),
									'slug'        => array( 'type' => 'string' ),
									'version'     => array( 'type' => 'string' ),
									'active'      => array( 'type' => 'boolean' ),
									'description' => array( 'type' => 'string' ),
								),
							),
							'description' => __( 'List of installed plugins.', 'wp-neural-admin' ),
						),
						'total'   => array(
							'type'        => 'integer',
							'description' => __( 'Total number of plugins.', 'wp-neural-admin' ),
						),
						'active'  => array(
							'type'        => 'integer',
							'description' => __( 'Number of active plugins.', 'wp-neural-admin' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'execute_plugin_list' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'annotations'  => array(
						// Note: readonly should be true, but Abilities API has a bug where
						// GET request input params aren't JSON-decoded. Using POST workaround.
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => true,
					),
				),
			)
		);
	}

	/**
	 * Execute plugin-list ability.
	 *
	 * @param array $input Input parameters.
	 * @return array
	 */
	public function execute_plugin_list( array $input = array() ): array {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all_plugins    = get_plugins();
		$active_plugins = get_option( 'active_plugins', array() );
		$plugins        = array();
		$active_count   = 0;

		foreach ( $all_plugins as $plugin_file => $plugin_data ) {
			$is_active = in_array( $plugin_file, $active_plugins, true );
			if ( $is_active ) {
				++$active_count;
			}

			$plugins[] = array(
				'name'        => $plugin_data['Name'],
				'slug'        => $plugin_file,
				'version'     => $plugin_data['Version'],
				'active'      => $is_active,
				'description' => wp_strip_all_tags( $plugin_data['Description'] ),
			);
		}

		return array(
			'plugins' => $plugins,
			'total'   => count( $plugins ),
			'active'  => $active_count,
		);
	}

	/**
	 * Register plugin-deactivate ability.
	 */
	private function register_plugin_deactivate(): void {
		wp_register_ability(
			'wp-neural-admin/plugin-deactivate',
			array(
				'label'               => __( 'Deactivate Plugin', 'wp-neural-admin' ),
				'description'         => __( 'Deactivate a specific plugin by its slug.', 'wp-neural-admin' ),
				'category'            => 'sre-tools',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'plugin' => array(
							'type'        => 'string',
							'description' => __( 'The plugin file path (slug) to deactivate.', 'wp-neural-admin' ),
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
							'description' => __( 'Whether the plugin was successfully deactivated.', 'wp-neural-admin' ),
						),
						'message' => array(
							'type'        => 'string',
							'description' => __( 'Status message.', 'wp-neural-admin' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'execute_plugin_deactivate' ),
				'permission_callback' => function () {
					return current_user_can( 'deactivate_plugins' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => true,
						'idempotent'  => true,
						'instructions' => __( 'This will deactivate the specified plugin. The site may behave differently after deactivation.', 'wp-neural-admin' ),
					),
				),
			)
		);
	}

	/**
	 * Execute plugin-deactivate ability.
	 *
	 * @param array $input Input parameters.
	 * @return array
	 */
	public function execute_plugin_deactivate( array $input = array() ): array {
		if ( empty( $input['plugin'] ) ) {
			return array(
				'success' => false,
				'message' => __( 'No plugin specified.', 'wp-neural-admin' ),
			);
		}

		$plugin = sanitize_text_field( $input['plugin'] );

		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		// Check if plugin exists.
		$all_plugins = get_plugins();
		if ( ! isset( $all_plugins[ $plugin ] ) ) {
			return array(
				'success' => false,
				'message' => sprintf(
					/* translators: %s: Plugin slug */
					__( 'Plugin "%s" not found.', 'wp-neural-admin' ),
					$plugin
				),
			);
		}

		// Check if already inactive.
		if ( ! is_plugin_active( $plugin ) ) {
			return array(
				'success' => true,
				'message' => sprintf(
					/* translators: %s: Plugin name */
					__( 'Plugin "%s" is already inactive.', 'wp-neural-admin' ),
					$all_plugins[ $plugin ]['Name']
				),
			);
		}

		// Deactivate the plugin.
		deactivate_plugins( $plugin );

		// Verify deactivation.
		if ( is_plugin_active( $plugin ) ) {
			return array(
				'success' => false,
				'message' => sprintf(
					/* translators: %s: Plugin name */
					__( 'Failed to deactivate plugin "%s".', 'wp-neural-admin' ),
					$all_plugins[ $plugin ]['Name']
				),
			);
		}

		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: Plugin name */
				__( 'Plugin "%s" has been deactivated.', 'wp-neural-admin' ),
				$all_plugins[ $plugin ]['Name']
			),
		);
	}

	/**
	 * Register site-health ability.
	 */
	private function register_site_health(): void {
		wp_register_ability(
			'wp-neural-admin/site-health',
			array(
				'label'               => __( 'Site Health Info', 'wp-neural-admin' ),
				'description'         => __( 'Get comprehensive site health information.', 'wp-neural-admin' ),
				'category'            => 'sre-tools',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'wordpress_version' => array( 'type' => 'string' ),
						'php_version'       => array( 'type' => 'string' ),
						'mysql_version'     => array( 'type' => 'string' ),
						'site_url'          => array( 'type' => 'string' ),
						'home_url'          => array( 'type' => 'string' ),
						'is_multisite'      => array( 'type' => 'boolean' ),
						'active_theme'      => array(
							'type'       => 'object',
							'properties' => array(
								'name'    => array( 'type' => 'string' ),
								'version' => array( 'type' => 'string' ),
							),
						),
						'debug_mode'        => array( 'type' => 'boolean' ),
						'memory_limit'      => array( 'type' => 'string' ),
						'max_upload_size'   => array( 'type' => 'string' ),
						'server_software'   => array( 'type' => 'string' ),
					),
				),
				'execute_callback'    => array( $this, 'execute_site_health' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
				'meta'                => array(
					'show_in_rest' => true,
					'annotations'  => array(
						// Note: readonly should be true, but Abilities API has a bug where
						// GET request input params aren't JSON-decoded. Using POST workaround.
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => true,
					),
				),
			)
		);
	}

	/**
	 * Execute site-health ability.
	 *
	 * @param array $input Input parameters.
	 * @return array
	 */
	public function execute_site_health( array $input = array() ): array {
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
}
