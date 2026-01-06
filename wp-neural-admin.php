<?php
/**
 * Plugin Name: WP Neural Admin
 * Plugin URI: https://pluginslab.com/wp-neural-admin
 * Description: A privacy-first AI Site Reliability Engineer running entirely in the browser. Uses WebAssembly and WebGPU to execute Small Language Models locally, transforming WP-Admin into a natural language command center via the WordPress Abilities API.
 * Version: 1.0.0
 * Author: Pluginslab
 * Author URI: https://pluginslab.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-neural-admin
 * Domain Path: /languages
 * Requires at least: 6.9
 * Requires PHP: 8.2
 * Tested up to: 6.9
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WPNeuralAdmin' ) ) {

	final class WPNeuralAdmin {

		public function __construct() {
			add_action( 'plugins_loaded', array( $this, 'init' ), 1 );
		}

		public function init() {
			// Check for Abilities API dependency.
			if ( ! $this->check_dependencies() ) {
				return;
			}

			$this->define_constants();
			$this->load_textdomain();

			// Load functions first (provides register_neural_ability API).
			require_once WP_NEURAL_ADMIN_PLUGIN_DIR . 'includes/functions-abilities.php';

			require_once WP_NEURAL_ADMIN_PLUGIN_DIR . 'includes/class-utils.php';
			require_once WP_NEURAL_ADMIN_PLUGIN_DIR . 'includes/class-settings.php';
			require_once WP_NEURAL_ADMIN_PLUGIN_DIR . 'includes/class-admin-page.php';
			require_once WP_NEURAL_ADMIN_PLUGIN_DIR . 'includes/class-abilities.php';

			// Initialize Utility Hooks (Cache Invalidation).
			if ( class_exists( '\\WPNeuralAdmin\\Utils' ) ) {
				\WPNeuralAdmin\Utils::init_hooks();
			}

			if ( class_exists( '\\WPNeuralAdmin\\Settings' ) ) {
				\WPNeuralAdmin\Settings::get_instance();
			}

			if ( class_exists( '\\WPNeuralAdmin\\Admin_Page' ) ) {
				\WPNeuralAdmin\Admin_Page::get_instance();
			}

			if ( class_exists( '\\WPNeuralAdmin\\Abilities' ) ) {
				\WPNeuralAdmin\Abilities::get_instance();
			}
		}

		/**
		 * Check for required dependencies.
		 *
		 * The Abilities API is built into WordPress 6.9+.
		 *
		 * @return bool
		 */
		private function check_dependencies(): bool {
			// Abilities API is built into WordPress 6.9+
			if ( ! function_exists( 'wp_register_ability' ) ) {
				add_action( 'admin_notices', array( $this, 'abilities_api_missing_notice' ) );
				return false;
			}

			return true;
		}

		/**
		 * Admin notice for missing Abilities API.
		 */
		public function abilities_api_missing_notice(): void {
			?>
			<div class="notice notice-error">
				<p>
					<?php
					printf(
						/* translators: %s: Plugin name */
						esc_html__( '%s requires WordPress 6.9 or higher for the Abilities API.', 'wp-neural-admin' ),
						'<strong>WP Neural Admin</strong>'
					);
					?>
				</p>
			</div>
			<?php
		}

		private function define_constants(): void {
			define( 'WP_NEURAL_ADMIN_VERSION', '1.0.0' );
			define( 'WP_NEURAL_ADMIN_FILE', __FILE__ );
			define( 'WP_NEURAL_ADMIN_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
			define( 'WP_NEURAL_ADMIN_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
		}

		private function load_textdomain(): void {
			load_plugin_textdomain(
				'wp-neural-admin',
				false,
				dirname( plugin_basename( __FILE__ ) ) . '/languages'
			);
		}

		/**
		 * Activation hook
		 */
		public static function activate(): void {
			update_option( 'wp_neural_admin_version', '1.0.0' );
			flush_rewrite_rules();
		}

		/**
		 * Deactivation hook
		 */
		public static function deactivate(): void {
			delete_transient( 'wp_neural_admin_cache' );
			flush_rewrite_rules();
		}
	}

	register_activation_hook( __FILE__, array( 'WPNeuralAdmin', 'activate' ) );
	register_deactivation_hook( __FILE__, array( 'WPNeuralAdmin', 'deactivate' ) );

	new WPNeuralAdmin();
}
