<?php
/**
 * Settings class
 *
 * Handles the registration, rendering, and saving of plugin settings.
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 */

namespace AgenticAdmin;

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

		add_action( 'init', array( $this, 'register_model_source_setting' ) );

		// UX: Add settings link to plugin list table.
		add_filter(
			'plugin_action_links_' . plugin_basename( AGENTIC_ADMIN_FILE ),
			array( $this, 'add_settings_link' )
		);
	}

	/**
	 * Load settings from the database.
	 *
	 * @return void
	 */
	private function init_settings(): void {
		$this->settings = get_option( 'agentic_admin_settings', array() );
	}

	/**
	 * Add "Settings" link to plugins page.
	 *
	 * @param array $links Existing links.
	 * @return array
	 */
	public function add_settings_link( array $links ): array {
		$settings_link = '<a href="admin.php?page=agentic-admin">' . __( 'Settings', 'agentic-admin' ) . '</a>';
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
				'label'  => __( 'AI Model', 'agentic-admin' ),
				'fields' => array(
					'agentic_admin_model_id' => array(
						'label'       => __( 'Model', 'agentic-admin' ),
						'type'        => 'select',
						'options'     => array(
							'Qwen2.5-7B-Instruct-q4f16_1-MLC' => 'Qwen 2.5 7B F16 (Recommended)',
							'Qwen2.5-7B-Instruct-q4f32_1-MLC' => 'Qwen 2.5 7B F32 (No shader-f16 needed)',
							'Qwen3-1.7B-q4f16_1-MLC' => 'Qwen 3 1.7B F16 (Lightweight)',
							'Qwen3-1.7B-q4f32_1-MLC' => 'Qwen 3 1.7B F32 (Lightweight, no shader-f16 needed)',
						),
						'default'     => 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
						'description' => __( 'Select the AI model to use. Larger models are more capable but slower.', 'agentic-admin' ),
					),
				),
			),
			'behavior' => array(
				'label'  => __( 'Behavior', 'agentic-admin' ),
				'fields' => array(
					'agentic_admin_confirm_destructive' => array(
						'label'       => __( 'Confirm destructive actions', 'agentic-admin' ),
						'type'        => 'checkbox',
						'default'     => 1,
						'description' => __( 'Always ask for confirmation before executing destructive abilities.', 'agentic-admin' ),
					),
					'agentic_admin_max_log_lines'       => array(
						'label'       => __( 'Max log lines', 'agentic-admin' ),
						'type'        => 'number',
						'default'     => 100,
						'description' => __( 'Maximum number of log lines to read at once.', 'agentic-admin' ),
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
	 * Register the model source option.
	 *
	 * The local engine downloads model files only from the addresses the
	 * site owner enters here. The plugin ships no default. Exposed through
	 * the core /wp/v2/settings endpoint, which requires manage_options.
	 *
	 * @return void
	 */
	public function register_model_source_setting(): void {
		register_setting(
			'agentic_admin',
			'agentic_admin_model_source',
			array(
				'type'              => 'object',
				'description'       => __( 'Where the local AI engine downloads model files from.', 'agentic-admin' ),
				'default'           => array(
					'weights_url' => '',
					'library_url' => '',
				),
				'sanitize_callback' => array( __CLASS__, 'sanitize_model_source' ),
				'show_in_rest'      => array(
					'schema' => array(
						'type'                 => 'object',
						'properties'           => array(
							'weights_url' => array( 'type' => 'string' ),
							'library_url' => array( 'type' => 'string' ),
						),
						'additionalProperties' => false,
					),
				),
			)
		);
	}

	/**
	 * Sanitize the model source option.
	 *
	 * @param mixed $value Raw value.
	 * @return array{weights_url: string, library_url: string}
	 */
	public static function sanitize_model_source( $value ): array {
		$value = is_array( $value ) ? $value : array();
		$clean = array();

		foreach ( array( 'weights_url', 'library_url' ) as $key ) {
			$url           = isset( $value[ $key ] ) ? esc_url_raw( trim( (string) $value[ $key ] ), array( 'https', 'http' ) ) : '';
			$clean[ $key ] = '' === $url ? '' : trailingslashit( $url );
		}

		return $clean;
	}

	/**
	 * Get the configured model source.
	 *
	 * @return array{weights_url: string, library_url: string}
	 */
	public static function get_model_source(): array {
		return self::sanitize_model_source( get_option( 'agentic_admin_model_source', array() ) );
	}

	/**
	 * Save settings to database.
	 *
	 * @return void
	 */
	public function save(): void {
		update_option( 'agentic_admin_settings', $this->settings );
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
