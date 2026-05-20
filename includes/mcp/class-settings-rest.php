<?php
/**
 * MCP settings REST endpoint
 *
 * GET/POST routes the React settings tab uses to read and write the MCP
 * endpoint toggles + third-party allowlist. Both require manage_options
 * (an authenticated subscriber is NOT enough — settings are admin only).
 *
 * Distinct from class-rest-endpoint.php, which handles MCP wire traffic.
 *
 * CSRF note: WP REST automatically enforces a valid `X-WP-Nonce` header for
 * cookie-authenticated requests via `rest_cookie_check_errors`. App-password
 * (Basic-auth) requests bypass nonce by design — they're already proving
 * possession of a long-lived credential bound to the user, not relying on
 * the browser session. We deliberately do NOT add a second nonce check here;
 * the React tab sends the nonce, WP enforces it, and CLI / scripted access
 * via app passwords keeps working without ceremony.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since   0.12.0
 */

namespace WPAgenticAdmin\MCP;

use WP_REST_Request;
use WP_REST_Response;
use WPAgenticAdmin\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin-only REST endpoint for the MCP settings UI.
 *
 * @since 0.12.0
 */
class Settings_Rest {

	private const REST_NAMESPACE = 'wp-agentic-admin/v1';
	private const REST_ROUTE     = '/mcp-settings';

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( static::class, 'register_routes' ) );
	}

	/**
	 * Register the settings routes.
	 *
	 * @return void
	 */
	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			self::REST_ROUTE,
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( static::class, 'get_settings' ),
					'permission_callback' => array( static::class, 'check_permission' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( static::class, 'save_settings' ),
					'permission_callback' => array( static::class, 'check_permission' ),
				),
			)
		);
	}

	/**
	 * Permission callback: require manage_options.
	 *
	 * @return bool
	 */
	public static function check_permission(): bool {
		return current_user_can( 'manage_options' );
	}

	/**
	 * GET /mcp-settings — return current settings + third-party catalog.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_settings(): WP_REST_Response {
		$settings = Settings::get_instance();
		$registry = new Ability_Registry( $settings );

		$third_party = array();
		foreach ( $registry->get_third_party_abilities() as $name => $ability ) {
			$meta          = $ability->get_meta() ?? array();
			$annotations   = isset( $meta['annotations'] ) && is_array( $meta['annotations'] )
				? $meta['annotations']
				: array();
			$third_party[] = array(
				'name'         => $name,
				'label'        => (string) $ability->get_label(),
				'description'  => (string) $ability->get_description(),
				'sourcePlugin' => $registry->source_plugin( $name ),
				'readonly'     => isset( $annotations['readonly'] ) && true === $annotations['readonly'],
			);
		}

		return new WP_REST_Response(
			array(
				'enabled'     => (bool) $settings->get_field( 'agentic_admin_mcp_enabled', 0 ),
				'exposeOwn'   => (bool) $settings->get_field( 'agentic_admin_mcp_expose_own', 1 ),
				'exposeThird' => (bool) $settings->get_field( 'agentic_admin_mcp_expose_third', 0 ),
				'allowlist'   => (array) $settings->get_field( 'agentic_admin_mcp_allowlist', array() ),
				'endpointUrl' => esc_url_raw( rest_url( 'wp-agentic-admin/v1/mcp' ) ),
				'thirdParty'  => $third_party,
			),
			200
		);
	}

	/**
	 * POST /mcp-settings — validate + save.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function save_settings( WP_REST_Request $request ): WP_REST_Response {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$settings = Settings::get_instance();

		if ( array_key_exists( 'enabled', $body ) ) {
			$settings->update_field( 'agentic_admin_mcp_enabled', $body['enabled'], 'checkbox' );
		}
		if ( array_key_exists( 'exposeOwn', $body ) ) {
			$settings->update_field( 'agentic_admin_mcp_expose_own', $body['exposeOwn'], 'checkbox' );
		}
		if ( array_key_exists( 'exposeThird', $body ) ) {
			$settings->update_field( 'agentic_admin_mcp_expose_third', $body['exposeThird'], 'checkbox' );
		}
		if ( array_key_exists( 'allowlist', $body ) ) {
			$settings->update_field( 'agentic_admin_mcp_allowlist', $body['allowlist'], 'ability_list' );
		}

		$settings->save();

		// Return the canonical state so the UI can resync.
		return self::get_settings();
	}
}
