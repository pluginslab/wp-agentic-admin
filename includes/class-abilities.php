<?php
/**
 * Abilities class
 *
 * Loads and registers SRE abilities using the extensible registration API.
 * Third-party plugins can register their own abilities by hooking into
 * the 'wp_agentic_admin_register_abilities' action.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

namespace WPAgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Abilities registration class.
 *
 * Registers all WordPress Abilities for the Agentic Admin plugin.
 *
 * @since 0.1.0
 */
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
		// Register category with WP Abilities API.
		\add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );

		// Load individual ability files.
		$this->load_ability_files();

		// Register our core abilities when appropriate.
		\add_action( 'wp_abilities_api_init', array( $this, 'register_core_abilities' ) );
	}

	/**
	 * Register the SRE tools category.
	 */
	public function register_category(): void {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		\wp_register_ability_category(
			'sre-tools',
			array(
				'label'       => \__( 'SRE Tools', 'wp-agentic-admin' ),
				'description' => \__( 'Site Reliability Engineering tools for diagnostics and maintenance.', 'wp-agentic-admin' ),
			)
		);
	}

	/**
	 * Load all ability files from the abilities directory.
	 */
	private function load_ability_files(): void {
		$abilities_dir = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/abilities/';

		// Check if directory exists.
		if ( ! is_dir( $abilities_dir ) ) {
			return;
		}

		// Load shared helper functions first.
		$shared_helpers = $abilities_dir . 'shared/plugin-helpers.php';
		if ( file_exists( $shared_helpers ) ) {
			require_once $shared_helpers;
		}

		// Load all PHP files from the abilities directory.
		$ability_files = glob( $abilities_dir . '*.php' );

		if ( ! $ability_files ) {
			return;
		}

		foreach ( $ability_files as $file ) {
			require_once $file;
		}
	}

	/**
	 * Register core abilities and fire action for third-party plugins.
	 *
	 * This is called on 'wp_abilities_api_init' to ensure the WP Abilities API
	 * is ready. Third-party plugins should hook into 'wp_agentic_admin_register_abilities'
	 * to register their own abilities.
	 */
	public function register_core_abilities(): void {
		// Register our core abilities.
		// Each function is defined in its respective file in includes/abilities/.
		if ( function_exists( 'wp_agentic_admin_register_error_log_read' ) ) {
			wp_agentic_admin_register_error_log_read();
		}

		if ( function_exists( 'wp_agentic_admin_register_cache_flush' ) ) {
			wp_agentic_admin_register_cache_flush();
		}

		if ( function_exists( 'wp_agentic_admin_register_db_optimize' ) ) {
			wp_agentic_admin_register_db_optimize();
		}

		if ( function_exists( 'wp_agentic_admin_register_plugin_list' ) ) {
			wp_agentic_admin_register_plugin_list();
		}

		if ( function_exists( 'wp_agentic_admin_register_plugin_deactivate' ) ) {
			wp_agentic_admin_register_plugin_deactivate();
		}

		if ( function_exists( 'wp_agentic_admin_register_plugin_activate' ) ) {
			wp_agentic_admin_register_plugin_activate();
		}

		if ( function_exists( 'wp_agentic_admin_register_site_health' ) ) {
			wp_agentic_admin_register_site_health();
		}

		// WP-CLI-inspired abilities.
		if ( function_exists( 'wp_agentic_admin_register_transient_flush' ) ) {
			wp_agentic_admin_register_transient_flush();
		}

		if ( function_exists( 'wp_agentic_admin_register_cron_list' ) ) {
			wp_agentic_admin_register_cron_list();
		}

		if ( function_exists( 'wp_agentic_admin_register_rewrite_flush' ) ) {
			wp_agentic_admin_register_rewrite_flush();
		}

		if ( function_exists( 'wp_agentic_admin_register_rewrite_list' ) ) {
			wp_agentic_admin_register_rewrite_list();
		}

		if ( function_exists( 'wp_agentic_admin_register_revision_cleanup' ) ) {
			wp_agentic_admin_register_revision_cleanup();
		}

		if ( function_exists( 'wp_agentic_admin_register_theme_list' ) ) {
			wp_agentic_admin_register_theme_list();
		}

		if ( function_exists( 'wp_agentic_admin_register_user_list' ) ) {
			wp_agentic_admin_register_user_list();
		}

		if ( function_exists( 'wp_agentic_admin_register_update_check' ) ) {
			wp_agentic_admin_register_update_check();
		}

		if ( function_exists( 'wp_agentic_admin_register_disk_usage' ) ) {
			wp_agentic_admin_register_disk_usage();
		}

		if ( function_exists( 'wp_agentic_admin_register_comment_stats' ) ) {
			wp_agentic_admin_register_comment_stats();
		}

		if ( function_exists( 'wp_agentic_admin_register_security_scan' ) ) {
			wp_agentic_admin_register_security_scan();
		}

		if ( function_exists( 'wp_agentic_admin_register_post_list' ) ) {
			wp_agentic_admin_register_post_list();
		}

		if ( function_exists( 'wp_agentic_admin_register_error_log_search' ) ) {
			wp_agentic_admin_register_error_log_search();
		}

		if ( function_exists( 'wp_agentic_admin_register_opcode_cache_status' ) ) {
			wp_agentic_admin_register_opcode_cache_status();
		}

		if ( function_exists( 'wp_agentic_admin_register_backup_check' ) ) {
			wp_agentic_admin_register_backup_check();
		}

		/**
		 * Fires after core abilities are registered.
		 *
		 * Third-party plugins can use this action to register their own abilities
		 * using the register_agentic_ability() function.
		 *
		 * @since 0.1.0
		 *
		 * @example
		 * add_action( 'wp_agentic_admin_register_abilities', function() {
		 *     register_agentic_ability(
		 *         'my-plugin/my-ability',
		 *         array(
		 *             'label'            => 'My Ability',
		 *             'description'      => 'Does something awesome.',
		 *             'category'         => 'sre-tools',
		 *             'execute_callback' => 'my_execute_function',
		 *             // ... more PHP config
		 *         ),
		 *         array(
		 *             'keywords'       => array( 'my', 'ability' ),
		 *             'initialMessage' => 'Running my ability...',
		 *         )
		 *     );
		 * });
		 */
		\do_action( 'wp_agentic_admin_register_abilities' );
	}
}
