<?php
/**
 * Admin Bar class
 *
 * Adds an AI chat sidebar toggle to the WordPress admin bar
 * and enqueues the sidebar on all wp-admin pages.
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 */

namespace AgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin Bar class.
 *
 * Adds a toggle icon to the admin bar and enqueues the
 * chat sidebar scripts on all wp-admin pages.
 *
 * @since 0.9.6, restored in 2.0.0-beta.3
 */
class Admin_Bar {

	/**
	 * Singleton instance.
	 *
	 * @var Admin_Bar|null
	 */
	private static ?Admin_Bar $instance = null;

	/**
	 * Get the singleton instance.
	 *
	 * @return Admin_Bar
	 */
	public static function get_instance(): Admin_Bar {
		if ( null === self::$instance ) {
			self::$instance = new Admin_Bar();
		}
		return self::$instance;
	}

	/**
	 * Initialize the class.
	 */
	public function __construct() {
		add_action( 'admin_bar_menu', array( $this, 'add_toggle_node' ), 999 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'admin_footer', array( $this, 'render_sidebar_container' ) );
	}

	/**
	 * Add the sidebar toggle icon to the admin bar.
	 *
	 * @param \WP_Admin_Bar $wp_admin_bar The admin bar instance.
	 */
	public function add_toggle_node( \WP_Admin_Bar $wp_admin_bar ): void {
		if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// No toggle on the plugin's own page, where the sidebar isn't loaded.
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && 'toplevel_page_agentic-admin' === $screen->id ) {
			return;
		}

		$wp_admin_bar->add_node(
			array(
				'id'     => 'agentic-admin-sidebar-toggle',
				'parent' => 'top-secondary',
				'title'  => '<span class="ab-icon" style="font-family:dashicons !important;display:inline-flex !important;align-items:center;justify-content:center;margin:0 3px;" aria-hidden="true">&#xf197;</span><span class="screen-reader-text">' . esc_html__( 'AI Assistant', 'agentic-admin' ) . '</span>',
				'href'   => '#',
				'meta'   => array(
					'class' => 'agentic-admin-toggle',
					'title' => __( 'AI Assistant', 'agentic-admin' ),
				),
			)
		);
	}

	/**
	 * Enqueue sidebar scripts and styles on all admin pages.
	 *
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_scripts( string $hook ): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Skip on the plugin's own settings page — the full app is already loaded.
		if ( 'toplevel_page_agentic-admin' === $hook ) {
			return;
		}

		$asset_file = AGENTIC_ADMIN_PLUGIN_DIR . 'build-extensions/admin-sidebar.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;
		$deps  = isset( $asset['dependencies'] ) ? (array) $asset['dependencies'] : array( 'wp-element' );
		$ver   = isset( $asset['version'] ) ? $asset['version'] : AGENTIC_ADMIN_VERSION;

		// Enqueue WordPress components styles.
		wp_enqueue_style( 'wp-components' );

		// Enqueue sidebar styles.
		$css_file = AGENTIC_ADMIN_PLUGIN_DIR . 'build-extensions/admin-sidebar.css';
		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				'agentic-admin-sidebar-style',
				AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/admin-sidebar.css',
				array( 'wp-components', 'dashicons' ),
				filemtime( $css_file )
			);
		}

		// Register and enqueue sidebar script.
		wp_register_script(
			'agentic-admin-sidebar',
			AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/admin-sidebar.js',
			$deps,
			$ver,
			true
		);

		// Localize with the same data as the admin page.
		wp_localize_script(
			'agentic-admin-sidebar',
			'agenticAdmin',
			Admin_Page::get_localized_data()
		);

		wp_enqueue_script( 'agentic-admin-sidebar' );
	}

	/**
	 * Render the sidebar container in the admin footer.
	 */
	public function render_sidebar_container(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Don't render on the plugin page — the full app handles it.
		$screen = get_current_screen();
		if ( $screen && 'toplevel_page_agentic-admin' === $screen->id ) {
			return;
		}
		?>
		<div id="agentic-admin-sidebar"></div>
		<div id="agentic-admin-sidebar-overlay" class="agentic-admin-sidebar-overlay"></div>
		<?php
	}
}
