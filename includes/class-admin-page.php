<?php
/**
 * Admin Page class
 *
 * Handles the main Neural Admin page in WP-Admin.
 *
 * @package WPNeuralAdmin
 */

namespace WPNeuralAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
			__( 'Neural Admin', 'wp-neural-admin' ),
			__( 'Neural Admin', 'wp-neural-admin' ),
			'manage_options',
			'wp-neural-admin',
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
		if ( 'toplevel_page_wp-neural-admin' !== $hook ) {
			return;
		}

		$asset_file = WP_NEURAL_ADMIN_PLUGIN_DIR . 'build-extensions/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;
		$deps  = isset( $asset['dependencies'] ) ? (array) $asset['dependencies'] : array( 'wp-element' );
		$ver   = isset( $asset['version'] ) ? $asset['version'] : WP_NEURAL_ADMIN_VERSION;

		// Enqueue WordPress components styles.
		wp_enqueue_style( 'wp-components' );

		// Enqueue our styles.
		$css_file = WP_NEURAL_ADMIN_PLUGIN_DIR . 'build-extensions/index.css';
		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				'wp-neural-admin-style',
				WP_NEURAL_ADMIN_PLUGIN_URL . 'build-extensions/index.css',
				array( 'wp-components' ),
				filemtime( $css_file )
			);
		}

		// Register and enqueue our script.
		wp_register_script(
			'wp-neural-admin',
			WP_NEURAL_ADMIN_PLUGIN_URL . 'build-extensions/index.js',
			$deps,
			$ver,
			true
		);

		// Localize script with data.
		wp_localize_script(
			'wp-neural-admin',
			'wpNeuralAdmin',
			$this->get_localized_data()
		);

		wp_enqueue_script( 'wp-neural-admin' );
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

		return array(
			'restUrl'             => esc_url_raw( rest_url( 'wp-abilities/v1' ) ),
			'nonce'               => wp_create_nonce( 'wp_rest' ),
			'userId'              => get_current_user_id(),
			'pluginUrl'           => esc_url( WP_NEURAL_ADMIN_PLUGIN_URL ),
			'version'             => WP_NEURAL_ADMIN_VERSION,
			'hasPrettyPermalinks' => $this->has_pretty_permalinks(),
			'permalinksUrl'       => esc_url( admin_url( 'options-permalink.php' ) ),
			'settings'            => array(
				'modelId'            => $settings->get_field( 'wp_neural_admin_model_id', 'Phi-3.5-mini-instruct-q4f16_1-MLC' ),
				'confirmDestructive' => (bool) $settings->get_field( 'wp_neural_admin_confirm_destructive', 1 ),
				'maxLogLines'        => (int) $settings->get_field( 'wp_neural_admin_max_log_lines', 100 ),
			),
			'browserRequirements' => Utils::get_browser_requirements(),
			'i18n'                => array(
				'loading'           => __( 'Loading AI model...', 'wp-neural-admin' ),
				'ready'             => __( 'AI assistant ready', 'wp-neural-admin' ),
				'error'             => __( 'An error occurred', 'wp-neural-admin' ),
				'noWebGPU'          => __( 'Your browser does not support WebGPU. Please use Chrome 113+ or Edge 113+.', 'wp-neural-admin' ),
				'confirmAction'     => __( 'Confirm action', 'wp-neural-admin' ),
				'cancel'            => __( 'Cancel', 'wp-neural-admin' ),
				'execute'           => __( 'Execute', 'wp-neural-admin' ),
				'placeholder'       => __( 'Describe your issue or what you want to do...', 'wp-neural-admin' ),
				'send'              => __( 'Send', 'wp-neural-admin' ),
				'permalinksRequired' => __( 'Pretty permalinks are required for Neural Admin to work. Please update your permalink settings.', 'wp-neural-admin' ),
				'updatePermalinks'  => __( 'Update Permalinks', 'wp-neural-admin' ),
			),
		);
	}

	/**
	 * Render the admin page.
	 */
	public function render_page(): void {
		// Permission check.
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'wp-neural-admin' ) );
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<div id="wp-neural-admin-root">
				<noscript>
					<div class="notice notice-error">
						<p><?php esc_html_e( 'JavaScript is required to use Neural Admin.', 'wp-neural-admin' ); ?></p>
					</div>
				</noscript>
				<div class="wp-neural-admin-loading">
					<span class="spinner is-active"></span>
					<p><?php esc_html_e( 'Loading Neural Admin...', 'wp-neural-admin' ); ?></p>
				</div>
			</div>
		</div>
		<?php
	}
}
