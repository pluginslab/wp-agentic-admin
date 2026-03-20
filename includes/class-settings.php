<?php
/**
 * Settings class
 *
 * Handles the registration, rendering, and saving of plugin settings.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

namespace WPAgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Settings management class.
 *
 * Handles plugin settings registration and retrieval.
 *
 * @since 0.1.0
 */
class Settings {

	/**
	 * Holds the plugin settings.
	 *
	 * @var array
	 */
	private array $settings = array();

	/**
	 * Singleton instance.
	 *
	 * @var Settings|null
	 */
	private static ?Settings $instance = null;

	/**
	 * Get the singleton instance.
	 *
	 * @return Settings
	 */
	public static function get_instance(): Settings {
		if ( null === self::$instance ) {
			self::$instance = new Settings();
		}
		return self::$instance;
	}

	/**
	 * Initialize the class.
	 */
	public function __construct() {
		$this->init_settings();

		// UX: Add settings link to plugin list table.
		add_filter(
			'plugin_action_links_' . plugin_basename( WP_AGENTIC_ADMIN_FILE ),
			array( $this, 'add_settings_link' )
		);
	}

	/**
	 * Load settings from the database.
	 *
	 * @return void
	 */
	private function init_settings(): void {
		$this->settings = get_option( 'wp_agentic_admin_settings', array() );
	}

	/**
	 * Add "Settings" link to plugins page.
	 *
	 * @param array $links Existing links.
	 * @return array
	 */
	public function add_settings_link( array $links ): array {
		$settings_link = '<a href="admin.php?page=wp-agentic-admin">' . __( 'Settings', 'wp-agentic-admin' ) . '</a>';
		array_unshift( $links, $settings_link );
		return $links;
	}

	/**
	 * Define the configuration for settings fields.
	 *
	 * @return array
	 */
	public function get_settings_config(): array {
		return array(
			'model'    => array(
				'label'  => __( 'AI Model', 'wp-agentic-admin' ),
				'fields' => array(
					'wp_agentic_admin_model_id' => array(
						'label'       => __( 'Model', 'wp-agentic-admin' ),
						'type'        => 'select',
						'options'     => array(
							'Qwen2.5-7B-Instruct-q4f16_1-MLC' => 'Qwen 2.5 7B F16 (Recommended)',
							'Qwen2.5-7B-Instruct-q4f32_1-MLC' => 'Qwen 2.5 7B F32 (No shader-f16 needed)',
							'Qwen3-1.7B-q4f16_1-MLC'          => 'Qwen 3 1.7B F16 (Lightweight)',
							'Qwen3-1.7B-q4f32_1-MLC'          => 'Qwen 3 1.7B F32 (Lightweight, no shader-f16 needed)',
						),
						'default'     => 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
						'description' => __( 'Select the AI model to use. Larger models are more capable but slower.', 'wp-agentic-admin' ),
					),
				),
			),
			'behavior' => array(
				'label'  => __( 'Behavior', 'wp-agentic-admin' ),
				'fields' => array(
					'wp_agentic_admin_confirm_destructive' => array(
						'label'       => __( 'Confirm destructive actions', 'wp-agentic-admin' ),
						'type'        => 'checkbox',
						'default'     => 1,
						'description' => __( 'Always ask for confirmation before executing destructive abilities.', 'wp-agentic-admin' ),
					),
					'wp_agentic_admin_max_log_lines'       => array(
						'label'       => __( 'Max log lines', 'wp-agentic-admin' ),
						'type'        => 'number',
						'default'     => 100,
						'description' => __( 'Maximum number of log lines to read at once.', 'wp-agentic-admin' ),
					),
				),
			),
		);
	}

	/**
	 * Get a settings field value.
	 *
	 * @param string $field   Field name.
	 * @param mixed  $default Default value if field doesn't exist.
	 * @return mixed
	 */
	public function get_field( string $field, $default = '' ) {
		return $this->settings[ $field ] ?? $default;
	}

	/**
	 * Update a field with type-specific sanitization.
	 *
	 * @param string $field Field name.
	 * @param mixed  $value Raw value.
	 * @param string $type  Data type (text, email, int, key, url, html, checkbox, select).
	 * @return void
	 */
	public function update_field( string $field, $value, string $type = 'text' ): void {
		switch ( $type ) {
			case 'email':
				$cleaned = sanitize_email( (string) $value );
				break;
			case 'int':
			case 'number':
				$cleaned = absint( $value );
				break;
			case 'url':
				$cleaned = esc_url_raw( (string) $value );
				break;
			case 'key':
				$cleaned = sanitize_key( $value );
				break;
			case 'html':
				$cleaned = wp_kses_post( (string) $value );
				break;
			case 'textarea':
				$cleaned = sanitize_textarea_field( (string) $value );
				break;
			case 'checkbox':
				$cleaned = (int) ( ! empty( $value ) );
				break;
			case 'select':
				$cleaned = sanitize_text_field( (string) $value );
				break;
			case 'text':
			default:
				$cleaned = sanitize_text_field( (string) $value );
				break;
		}
		$this->settings[ $field ] = $cleaned;
	}

	/**
	 * Save settings to database.
	 *
	 * @return void
	 */
	public function save(): void {
		update_option( 'wp_agentic_admin_settings', $this->settings );
	}

	/**
	 * Get all settings.
	 *
	 * @return array
	 */
	public function get_all(): array {
		return $this->settings;
	}
}
