<?php
/**
 * Admin Page class
 *
 * Handles the main Agentic Admin page in WP-Admin.
 *
 * @package WPAgenticAdmin
 */

namespace WPAgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin Page class.
 *
 * Handles the main Agentic Admin page in WP-Admin.
 *
 * @since 0.1.0
 */
class Admin_Page {

	/**
	 * Singleton instance.
	 *
	 * @var Admin_Page|null
	 */
	private static ?Admin_Page $instance = null;

	/**
	 * Get the singleton instance.
	 *
	 * @return Admin_Page
	 */
	public static function get_instance(): Admin_Page {
		if ( null === self::$instance ) {
			self::$instance = new Admin_Page();
		}
		return self::$instance;
	}

	/**
	 * Initialize the class.
	 */
	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Add the top-level admin menu.
	 */
	public function add_admin_menu(): void {
		add_menu_page(
			__( 'WP Agentic Admin', 'wp-agentic-admin' ),
			__( 'WP Agentic Admin', 'wp-agentic-admin' ),
			'manage_options',
			'wp-agentic-admin',
			array( $this, 'render_page' ),
			'dashicons-superhero-alt',
			3
		);
	}

	/**
	 * Enqueue scripts and styles for the admin page.
	 *
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_scripts( string $hook ): void {
		// Only load on our admin page.
		if ( 'toplevel_page_wp-agentic-admin' !== $hook ) {
			return;
		}

		$asset_file = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'build-extensions/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;
		$deps  = isset( $asset['dependencies'] ) ? (array) $asset['dependencies'] : array( 'wp-element' );
		$ver   = isset( $asset['version'] ) ? $asset['version'] : WP_AGENTIC_ADMIN_VERSION;

		// Enqueue WordPress components styles.
		wp_enqueue_style( 'wp-components' );

		// Enqueue our styles.
		$css_file = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'build-extensions/index.css';
		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				'wp-agentic-admin-style',
				WP_AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/index.css',
				array( 'wp-components' ),
				filemtime( $css_file )
			);
		}

		// Register and enqueue our script.
		wp_register_script(
			'wp-agentic-admin',
			WP_AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/index.js',
			$deps,
			$ver,
			true
		);

		// Localize script with data.
		wp_localize_script(
			'wp-agentic-admin',
			'wpAgenticAdmin',
			$this->get_localized_data()
		);

		wp_enqueue_script( 'wp-agentic-admin' );
	}

	/**
	 * Check if permalinks are configured for REST API usage.
	 *
	 * @return bool True if permalinks are properly configured.
	 */
	private function has_pretty_permalinks(): bool {
		return ! empty( get_option( 'permalink_structure' ) );
	}

	/**
	 * Get data to pass to JavaScript.
	 *
	 * @return array
	 */
	private function get_localized_data(): array {
		$settings = Settings::get_instance();

		// Get JS configurations for registered abilities.
		$abilities_js_config = array();
		if ( function_exists( 'get_agentic_abilities_js_config' ) ) {
			$abilities_js_config = get_agentic_abilities_js_config();
		}

		return array(
			'restUrl'             => esc_url_raw( rest_url( 'wp-abilities/v1' ) ),
			'nonce'               => wp_create_nonce( 'wp_rest' ),
			'userId'              => get_current_user_id(),
			'pluginUrl'           => esc_url( WP_AGENTIC_ADMIN_PLUGIN_URL ),
			'swUrl'               => esc_url( WP_AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/sw-loader.php' ),
			'version'             => WP_AGENTIC_ADMIN_VERSION,
			'hasPrettyPermalinks' => $this->has_pretty_permalinks(),
			'permalinksUrl'       => esc_url( admin_url( 'options-permalink.php' ) ),
			'settings'            => array(
				'modelId'            => $settings->get_field( 'wp_agentic_admin_model_id', 'Qwen2.5-7B-Instruct-q4f16_1-MLC' ),
				'confirmDestructive' => (bool) $settings->get_field( 'wp_agentic_admin_confirm_destructive', 1 ),
				'maxLogLines'        => (int) $settings->get_field( 'wp_agentic_admin_max_log_lines', 100 ),
			),
			'browserRequirements' => Utils::get_browser_requirements(),
			'abilities'           => $abilities_js_config,
			'i18n'                => array(
				'loading'            => __( 'Loading AI model...', 'wp-agentic-admin' ),
				'ready'              => __( 'AI assistant ready', 'wp-agentic-admin' ),
				'error'              => __( 'An error occurred', 'wp-agentic-admin' ),
				'noWebGPU'           => __( 'Your browser does not support WebGPU. Please use Chrome 113+ or Edge 113+.', 'wp-agentic-admin' ),
				'confirmAction'      => __( 'Confirm action', 'wp-agentic-admin' ),
				'cancel'             => __( 'Cancel', 'wp-agentic-admin' ),
				'execute'            => __( 'Execute', 'wp-agentic-admin' ),
				'placeholder'        => __( 'Describe your issue or what you want to do...', 'wp-agentic-admin' ),
				'send'               => __( 'Send', 'wp-agentic-admin' ),
				'permalinksRequired' => __( 'Pretty permalinks are required for Agentic Admin to work. Please update your permalink settings.', 'wp-agentic-admin' ),
				'updatePermalinks'   => __( 'Update Permalinks', 'wp-agentic-admin' ),
			),
		);
	}

	/**
	 * Render the admin page.
	 */
	public function render_page(): void {
		// Permission check.
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'wp-agentic-admin' ) );
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<div id="wp-agentic-admin-root">
				<noscript>
					<div class="notice notice-error">
						<p><?php esc_html_e( 'JavaScript is required to use Agentic Admin.', 'wp-agentic-admin' ); ?></p>
					</div>
				</noscript>
			</div>
		</div>
		<?php
	}
}
