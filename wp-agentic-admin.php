<?php
// phpcs:ignore WordPress.Files.FileName.InvalidClassFileName -- This is the main plugin file, not a class file.
/**
 * Plugin Name: WP Agentic Admin
 * Plugin URI: https://pluginslab.com/wp-agentic-admin
 * Description: A privacy-first AI Site Reliability Engineer running entirely in the browser. Uses WebAssembly and WebGPU to execute Small Language Models locally, transforming WP-Admin into a natural language command center via the WordPress Abilities API.
 * Version: 0.1.0
 * Author: Pluginslab
 * Author URI: https://pluginslab.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-agentic-admin
 * Domain Path: /languages
 * Requires at least: 6.9
 * Requires PHP: 8.2
 * Tested up to: 6.9
 *
 * @package WP_Agentic_Admin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WPAgenticAdmin' ) ) {

	/**
	 * Main plugin class for WP Agentic Admin.
	 *
	 * @since 0.1.0
	 */
	final class WPAgenticAdmin {

		/**
		 * Constructor - sets up the plugin initialization.
		 *
		 * @since 0.1.0
		 */
		public function __construct() {
			add_action( 'plugins_loaded', array( $this, 'init' ), 1 );
		}

		/**
		 * Initialize the plugin.
		 *
		 * Checks dependencies, defines constants, loads text domain,
		 * and initializes all plugin components.
		 *
		 * @since 0.1.0
		 * @return void
		 */
		public function init() {
			// Check for Abilities API dependency.
			if ( ! $this->check_dependencies() ) {
				return;
			}

			$this->define_constants();
			$this->load_textdomain();

			// Load functions first (provides register_agentic_ability API).
			require_once WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/functions-abilities.php';

			require_once WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-utils.php';
			require_once WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-settings.php';
			require_once WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-admin-page.php';
			require_once WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-abilities.php';

			// Initialize Utility Hooks (Cache Invalidation).
			if ( class_exists( '\\WPAgenticAdmin\\Utils' ) ) {
				\WPAgenticAdmin\Utils::init_hooks();
			}

			if ( class_exists( '\\WPAgenticAdmin\\Settings' ) ) {
				\WPAgenticAdmin\Settings::get_instance();
			}

			if ( class_exists( '\\WPAgenticAdmin\\Admin_Page' ) ) {
				\WPAgenticAdmin\Admin_Page::get_instance();
			}

			if ( class_exists( '\\WPAgenticAdmin\\Abilities' ) ) {
				\WPAgenticAdmin\Abilities::get_instance();
			}
		}

		/**
		 * Check for required dependencies.
		 *
		 * The Abilities API is built into WordPress 6.9+.
		 *
		 * @since 0.1.0
		 * @return bool True if dependencies are met, false otherwise.
		 */
		private function check_dependencies(): bool {
			// Abilities API is built into WordPress 6.9+.
			if ( ! function_exists( 'wp_register_ability' ) ) {
				add_action( 'admin_notices', array( $this, 'abilities_api_missing_notice' ) );
				return false;
			}

			return true;
		}

		/**
		 * Admin notice for missing Abilities API.
		 *
		 * @since 0.1.0
		 * @return void
		 */
		public function abilities_api_missing_notice(): void {
			?>
			<div class="notice notice-error">
				<p>
					<?php
					printf(
					/* translators: %s: Plugin name */
						esc_html__( '%s requires WordPress 6.9 or higher for the Abilities API.', 'wp-agentic-admin' ),
						'<strong>WP Agentic Admin</strong>'
					);
					?>
				</p>
			</div>
			<?php
		}

		/**
		 * Define plugin constants.
		 *
		 * @since 0.1.0
		 * @return void
		 */
		private function define_constants(): void {
			define( 'WP_AGENTIC_ADMIN_VERSION', '0.1.0' );
			define( 'WP_AGENTIC_ADMIN_FILE', __FILE__ );
			define( 'WP_AGENTIC_ADMIN_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
			define( 'WP_AGENTIC_ADMIN_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
		}

		/**
		 * Load plugin text domain for translations.
		 *
		 * @since 0.1.0
		 * @return void
		 */
		private function load_textdomain(): void {
			load_plugin_textdomain(
				'wp-agentic-admin',
				false,
				dirname( plugin_basename( __FILE__ ) ) . '/languages'
			);
		}

		/**
		 * Activation hook
		 */
		public static function activate(): void {
			// Migrate old options if they exist
			self::migrate_from_agentic_to_agentic();

			update_option( 'wp_agentic_admin_version', '0.1.0' );
			flush_rewrite_rules();
		}

		/**
		 * Deactivation hook
		 */
		public static function deactivate(): void {
			delete_transient( 'wp_agentic_admin_cache' );
			flush_rewrite_rules();
		}

		/**
		 * Migrate old options from WP Agentic Admin to WP Agentic Admin.
		 *
		 * @since 2.0.0
		 * @return void
		 */
		private static function migrate_from_agentic_to_agentic(): void {
			// Migrate settings
			$old_settings = get_option( 'wp_agentic_admin_settings' );
			if ( $old_settings && ! get_option( 'wp_agentic_admin_settings' ) ) {
				update_option( 'wp_agentic_admin_settings', $old_settings );
			}

			// Migrate version
			$old_version = get_option( 'wp_agentic_admin_version' );
			if ( $old_version && ! get_option( 'wp_agentic_admin_version' ) ) {
				update_option( 'wp_agentic_admin_version', $old_version );
			}

			// Migrate transients
			$old_cache = get_transient( 'wp_agentic_admin_cache' );
			if ( $old_cache && ! get_transient( 'wp_agentic_admin_cache' ) ) {
				set_transient( 'wp_agentic_admin_cache', $old_cache, DAY_IN_SECONDS );
			}

			$old_post_types = get_transient( 'wp_agentic_admin_post_types' );
			if ( $old_post_types && ! get_transient( 'wp_agentic_admin_post_types' ) ) {
				set_transient( 'wp_agentic_admin_post_types', $old_post_types, DAY_IN_SECONDS );
			}
		}
	}

	register_activation_hook( __FILE__, array( 'WPAgenticAdmin', 'activate' ) );
	register_deactivation_hook( __FILE__, array( 'WPAgenticAdmin', 'deactivate' ) );

	new WPAgenticAdmin();
}
