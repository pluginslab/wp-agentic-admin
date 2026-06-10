<?php
/**
 * Agentic Admin - Main Plugin File
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 * @since   0.1.0
 */

// phpcs:ignore WordPress.Files.FileName.InvalidClassFileName -- This is the main plugin file, not a class file.
/**
 * Plugin Name: Agentic Admin
 * Plugin URI: https://github.com/pluginslab/wp-agentic-admin
 * Description: A privacy-first AI Site Reliability Engineer running entirely in the browser. Uses WebAssembly and WebGPU to execute Small Language Models locally, transforming wp-admin into a natural language command center via the WordPress Abilities API.
 * Version: 0.11.0
 * Author: Marcel Schmitz
 * Author URI: https://profiles.wordpress.org/schmitzoide/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: agentic-admin
 * Requires at least: 6.9
 * Requires PHP: 8.2
 * Tested up to: 7.0
 *
 * @package AgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'AgenticAdmin' ) ) {

	/**
	 * Main plugin class for Agentic Admin.
	 *
	 * @since 0.1.0
	 */
	final class AgenticAdmin {

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

			// Migrate legacy option keys on upgrade. The activation hook does not
			// fire on WordPress.org auto-updates, so this also runs on every load
			// (cheap and idempotent: the old option is deleted once migrated).
			self::maybe_migrate_settings();

			// Translations: WordPress 4.6+ loads them automatically for plugins
			// hosted on WordPress.org, so no explicit load_plugin_textdomain()
			// call is needed here.

			// Load functions first (provides agentic_admin_register_ability API).
			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/functions-abilities.php';

			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-utils.php';
			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-settings.php';
			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-admin-page.php';
			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-abilities.php';
			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-llm-proxy.php';
			require_once AGENTIC_ADMIN_PLUGIN_DIR . 'includes/class-connectors.php';

			// Initialize Utility Hooks (Cache Invalidation).
			if ( class_exists( '\\AgenticAdmin\\Utils' ) ) {
				\AgenticAdmin\Utils::init_hooks();
			}

			if ( class_exists( '\\AgenticAdmin\\Settings' ) ) {
				\AgenticAdmin\Settings::get_instance();
			}

			if ( class_exists( '\\AgenticAdmin\\Admin_Page' ) ) {
				\AgenticAdmin\Admin_Page::get_instance();
			}

			if ( class_exists( '\\AgenticAdmin\\Abilities' ) ) {
				\AgenticAdmin\Abilities::get_instance();
			}

			// Initialize LLM Proxy for external provider support.
			if ( class_exists( '\\AgenticAdmin\\LLM_Proxy' ) ) {
				\AgenticAdmin\LLM_Proxy::init();
			}

			// Initialize Connectors REST endpoint (WP 7.0+).
			if ( class_exists( '\\AgenticAdmin\\Connectors' ) ) {
				\AgenticAdmin\Connectors::init();
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
						esc_html__( '%s requires WordPress 6.9 or higher for the Abilities API.', 'agentic-admin' ),
						'<strong>Agentic Admin</strong>'
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
			define( 'AGENTIC_ADMIN_VERSION', '0.11.0' );
			define( 'AGENTIC_ADMIN_FILE', __FILE__ );
			define( 'AGENTIC_ADMIN_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
			define( 'AGENTIC_ADMIN_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
		}

		/**
		 * Migrate settings from the legacy option key.
		 *
		 * The settings option key was renamed `wp_agentic_admin_settings` →
		 * `agentic_admin_settings` during the de-branding rename. Without this,
		 * upgrading users would silently lose their saved settings (model
		 * selection, endpoint URL, API keys, etc.).
		 *
		 * Idempotent: only copies when the old option exists and the new one
		 * does not, then removes the old key so subsequent calls short-circuit.
		 *
		 * @since 0.11.0
		 * @return void
		 */
		private static function maybe_migrate_settings(): void {
			$old = get_option( 'wp_agentic_admin_settings' );
			if ( false !== $old && false === get_option( 'agentic_admin_settings' ) ) {
				update_option( 'agentic_admin_settings', $old );
				delete_option( 'wp_agentic_admin_settings' );
			}
		}

		/**
		 * Activation hook
		 */
		public static function activate(): void {
			update_option( 'agentic_admin_version', '0.11.0' );
			self::maybe_migrate_settings();
			flush_rewrite_rules();
		}

		/**
		 * Deactivation hook
		 */
		public static function deactivate(): void {
			delete_transient( 'agentic_admin_cache' );
			flush_rewrite_rules();
		}
	}

	register_activation_hook( __FILE__, array( 'AgenticAdmin', 'activate' ) );
	register_deactivation_hook( __FILE__, array( 'AgenticAdmin', 'deactivate' ) );

	new AgenticAdmin();
}
