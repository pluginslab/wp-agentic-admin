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

		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
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
							'Qwen2.5-7B-Instruct-q4f16_1-MLC'     => 'Qwen 2.5 7B (Recommended)',
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
	 * Register REST API routes for settings updates from the JS app.
	 *
	 * @return void
	 */
	public function register_rest_routes(): void {
		register_rest_route(
			'wp-agentic-admin/v1',
			'/settings',
			array(
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => array( $this, 'update_settings_rest' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
				'args'                => array(
					'feedback_optin' => array(
						'type'              => 'boolean',
						'sanitize_callback' => 'rest_sanitize_boolean',
					),
				),
			)
		);
	}

	/**
	 * Handle REST settings update request.
	 *
	 * Only whitelisted fields are accepted.
	 *
	 * @param \WP_REST_Request $request Incoming request.
	 * @return \WP_REST_Response
	 */
	public function update_settings_rest( \WP_REST_Request $request ): \WP_REST_Response {
		$allowed = array( 'feedback_optin' );
		$updated = false;

		foreach ( $allowed as $key ) {
			if ( $request->has_param( $key ) ) {
				$this->settings[ $key ] = rest_sanitize_boolean( $request->get_param( $key ) );
				$updated                = true;
			}
		}

		if ( $updated ) {
			$this->save();
		}

		return new \WP_REST_Response( array( 'success' => true ), 200 );
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
