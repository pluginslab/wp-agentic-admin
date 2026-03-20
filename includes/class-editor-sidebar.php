<?php
/**
 * Editor Sidebar class
 *
 * Enqueues the AI chat sidebar plugin for the Gutenberg block editor.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

namespace WPAgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Editor Sidebar class.
 *
 * Registers and enqueues the editor plugin that provides
 * an AI chat sidebar in the block editor.
 *
 * @since 0.9.6
 */
class Editor_Sidebar {

	/**
	 * Singleton instance.
	 *
	 * @var Editor_Sidebar|null
	 */
	private static ?Editor_Sidebar $instance = null;

	/**
	 * Get the singleton instance.
	 *
	 * @return Editor_Sidebar
	 */
	public static function get_instance(): Editor_Sidebar {
		if ( null === self::$instance ) {
			self::$instance = new Editor_Sidebar();
		}
		return self::$instance;
	}

	/**
	 * Initialize the class.
	 */
	public function __construct() {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Enqueue scripts and styles for the block editor sidebar.
	 */
	public function enqueue_scripts(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$asset_file = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'build-extensions/editor.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;
		$deps  = isset( $asset['dependencies'] ) ? (array) $asset['dependencies'] : array( 'wp-plugins', 'wp-editor', 'wp-element' );
		$ver   = isset( $asset['version'] ) ? $asset['version'] : WP_AGENTIC_ADMIN_VERSION;

		// Enqueue WordPress components styles.
		wp_enqueue_style( 'wp-components' );

		// Enqueue editor sidebar styles.
		$css_file = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'build-extensions/editor.css';
		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				'wp-agentic-admin-editor-style',
				WP_AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/editor.css',
				array( 'wp-components' ),
				filemtime( $css_file )
			);
		}

		// Register and enqueue the editor script.
		wp_register_script(
			'wp-agentic-admin-editor',
			WP_AGENTIC_ADMIN_PLUGIN_URL . 'build-extensions/editor.js',
			$deps,
			$ver,
			true
		);

		// Localize with the same data as the admin page.
		wp_localize_script(
			'wp-agentic-admin-editor',
			'wpAgenticAdmin',
			Admin_Page::get_localized_data()
		);

		wp_enqueue_script( 'wp-agentic-admin-editor' );
	}
}
