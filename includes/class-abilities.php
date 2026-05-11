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

		$diff_helpers = $abilities_dir . 'shared/diff-helpers.php';
		if ( file_exists( $diff_helpers ) ) {
			require_once $diff_helpers;
		}

		// Load all PHP files from the abilities directory.
		$ability_files = glob( $abilities_dir . '*.php' );

		if ( ! $ability_files ) {
			return;
		}

		foreach ( $ability_files as $file ) {
			require_once $file;
		}

		// Load abilities from subdirectories.
		$security_dir = $abilities_dir . 'security/';
		if ( is_dir( $security_dir ) ) {
			$security_files = glob( $security_dir . '*.php' );
			if ( $security_files ) {
				foreach ( $security_files as $file ) {
					require_once $file;
				}
			}
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
		require_once WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/abilities-manifest.php';

		foreach ( wp_agentic_admin_resolve_enabled_abilities() as $slug => $register_fn ) {
			if ( function_exists( $register_fn ) ) {
				$register_fn();
			} else {
				// Surface manifest/code drift to developers without halting boot.
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_trigger_error
				\trigger_error(
					sprintf(
						'wp-agentic-admin: enabled ability "%s" has no registrar function %s().',
						\esc_html( $slug ),
						\esc_html( $register_fn )
					),
					E_USER_WARNING
				);
			}
		}

		/**
		 * Fires after core abilities are registered.
		 *
		 * Third-party plugins can use this action to register their own abilities
		 * using the wp_agentic_admin_register_ability() function.
		 *
		 * @since 0.1.0
		 *
		 * @example
		 * add_action( 'wp_agentic_admin_register_abilities', function() {
		 *     wp_agentic_admin_register_ability(
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
