<?php
/**
 * MCP REST endpoint
 *
 * Registers POST /wp-json/wp-agentic-admin/v1/mcp when the MCP endpoint
 * is enabled in settings. Adapts WP_REST_Request into the JSON-RPC payload
 * shape that JsonRpc_Server understands.
 *
 * The route is registered only when enabled, so an unauthenticated request
 * to a disabled endpoint returns HTTP 404 (not 401 or 403) — the route
 * simply does not exist.
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
 * REST endpoint for the MCP server.
 *
 * @since 0.12.0
 */
class Rest_Endpoint {

	/**
	 * REST namespace.
	 */
	private const REST_NAMESPACE = 'wp-agentic-admin/v1';

	/**
	 * REST route.
	 */
	private const REST_ROUTE = '/mcp';

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( static::class, 'maybe_register_routes' ) );
	}

	/**
	 * Conditionally register the REST route based on the enable toggle.
	 *
	 * @return void
	 */
	public static function maybe_register_routes(): void {
		if ( ! self::registry()->is_endpoint_enabled() ) {
			return;
		}
		register_rest_route(
			self::REST_NAMESPACE,
			self::REST_ROUTE,
			array(
				'methods'             => 'POST',
				'callback'            => array( static::class, 'handle_request' ),
				'permission_callback' => array( static::class, 'check_permission' ),
			)
		);
	}

	/**
	 * Permission callback — require an authenticated WordPress user.
	 *
	 * App-password Basic auth runs in `determine_current_user` and will have
	 * populated the current user by the time this fires. We deliberately do
	 * NOT require manage_options here — per-ability `permission_callback`
	 * runs inside JsonRpc_Server::handle_tools_call() and is responsible for
	 * per-tool authorization.
	 *
	 * @return bool
	 */
	public static function check_permission(): bool {
		return is_user_logged_in();
	}

	/**
	 * Handle an MCP HTTP request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function handle_request( WP_REST_Request $request ): WP_REST_Response {
		// MCP responses are user-scoped tool lists and ability outputs — never safe to
		// cache, even briefly. Belt-and-braces against misconfigured intermediaries.
		nocache_headers();

		$payload = $request->get_json_params();
		if ( null === $payload ) {
			$body = $request->get_body();
			if ( '' !== $body ) {
				$decoded = json_decode( $body, true );
				if ( is_array( $decoded ) ) {
					$payload = $decoded;
				}
			}
		}

		if ( null === $payload || ! is_array( $payload ) ) {
			return new WP_REST_Response(
				array(
					'jsonrpc' => '2.0',
					'id'      => null,
					'error'   => array(
						'code'    => -32700,
						'message' => 'Parse error: request body must be a JSON object.',
					),
				),
				200
			);
		}

		$server   = new JsonRpc_Server( self::registry() );
		$response = $server->handle( $payload );

		// Notifications: JsonRpc_Server returns an empty array; respond 204 No Content.
		if ( empty( $response ) ) {
			return new WP_REST_Response( null, 204 );
		}

		return new WP_REST_Response( $response, 200 );
	}

	/**
	 * Build a fresh Ability_Registry for this request.
	 *
	 * Settings::get_instance() is the singleton already loaded by the main
	 * plugin file; we just wrap it.
	 *
	 * @return Ability_Registry
	 */
	private static function registry(): Ability_Registry {
		return new Ability_Registry( Settings::get_instance() );
	}
}
