<?php
/**
 * Connectors — REST API endpoint exposing the WP 7.0 AI Connector list.
 *
 * Reads wp_get_connectors() (introduced in WP 7.0), filters to ai_provider
 * connectors, and returns the slim subset the model-picker UI needs to
 * render the dropdown of "connected" AI provider plugins.
 *
 * Endpoint:
 *   GET /wp-agentic-admin/v1/connectors
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since   0.13.0
 */

namespace WPAgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Connectors REST endpoint.
 *
 * @since 0.13.0
 */
class Connectors {

	/**
	 * Initialize hooks.
	 */
	public static function init(): void {
		\add_action( 'rest_api_init', array( static::class, 'register_routes' ) );
	}

	/**
	 * Register REST API routes.
	 */
	public static function register_routes(): void {
		\register_rest_route(
			'wp-agentic-admin/v1',
			'/connectors',
			array(
				'methods'             => 'GET',
				'callback'            => array( static::class, 'list_connectors' ),
				'permission_callback' => array( static::class, 'check_permission' ),
			)
		);
	}

	/**
	 * Admin-only permission check.
	 *
	 * @return bool
	 */
	public static function check_permission(): bool {
		return \current_user_can( 'manage_options' );
	}

	/**
	 * GET /v1/connectors — list AI provider connectors.
	 *
	 * @return \WP_REST_Response
	 */
	public static function list_connectors(): \WP_REST_Response {
		$out = array(
			'wp_supports_connectors' => function_exists( '\\wp_get_connectors' ),
			'options_url'            => \admin_url( 'options-connectors.php' ),
			'connectors'             => array(),
		);

		if ( ! function_exists( '\\wp_get_connectors' ) ) {
			return new \WP_REST_Response( $out, 200 );
		}

		$all = \wp_get_connectors();
		$ai_registry = null;
		if ( class_exists( '\\WordPress\\AiClient\\AiClient' ) ) {
			try {
				$ai_registry = \WordPress\AiClient\AiClient::defaultRegistry();
			} catch ( \Exception $e ) {
				$ai_registry = null;
			}
		}

		foreach ( $all as $id => $data ) {
			if ( ! isset( $data['type'] ) || 'ai_provider' !== $data['type'] ) {
				continue;
			}

			$is_connected = false;
			if ( null !== $ai_registry ) {
				try {
					$is_connected = $ai_registry->hasProvider( $id )
						&& $ai_registry->isProviderConfigured( $id );
				} catch ( \Exception $e ) {
					$is_connected = false;
				}
			}

			$out['connectors'][] = array(
				'id'           => $id,
				'name'         => $data['name'] ?? $id,
				'description'  => $data['description'] ?? '',
				'logo_url'     => $data['logo_url'] ?? null,
				'is_connected' => $is_connected,
			);
		}

		return new \WP_REST_Response( $out, 200 );
	}
}
