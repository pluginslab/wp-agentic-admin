<?php
/**
 * LLM Proxy — REST API endpoint for external LLM providers
 *
 * Proxies requests from the browser to external OpenAI-compatible endpoints,
 * avoiding CORS issues. All requests require a valid WP REST nonce.
 *
 * Endpoints:
 *   GET  /agentic-admin/v1/llm-proxy/models?endpoint_url=...
 *   POST /agentic-admin/v1/llm-proxy/chat/completions
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 * @since   0.10.0
 */

namespace AgenticAdmin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * LLM Proxy class.
 *
 * @since 0.10.0
 */
class LLM_Proxy {

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
			'agentic-admin/v1',
			'/llm-proxy/models',
			array(
				'methods'             => 'GET',
				'callback'            => array( static::class, 'proxy_models' ),
				'permission_callback' => array( static::class, 'check_permission' ),
				'args'                => array(
					'endpoint_url' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'esc_url_raw',
					),
					'api_key'      => array(
						'required' => false,
						'type'     => 'string',
						'default'  => '',
					),
				),
			)
		);

		\register_rest_route(
			'agentic-admin/v1',
			'/llm-proxy/chat/completions',
			array(
				'methods'             => 'POST',
				'callback'            => array( static::class, 'proxy_chat_completions' ),
				'permission_callback' => array( static::class, 'check_permission' ),
			)
		);
	}

	/**
	 * Permission check — admin only.
	 *
	 * @return bool
	 */
	public static function check_permission(): bool {
		return \current_user_can( 'manage_options' );
	}

	/**
	 * Proxy GET /v1/models to the external endpoint.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function proxy_models( \WP_REST_Request $request ) {
		$endpoint_url = \untrailingslashit( $request->get_param( 'endpoint_url' ) );
		$api_key      = $request->get_param( 'api_key' );
		$url          = $endpoint_url . '/v1/models';

		$headers = array(
			'Accept' => 'application/json',
		);
		if ( ! empty( $api_key ) ) {
			$headers['Authorization'] = 'Bearer ' . $api_key;
		}

		$response = \wp_remote_get(
			$url,
			array(
				'headers' => $headers,
				'timeout' => 60,
			)
		);

		if ( \is_wp_error( $response ) ) {
			return new \WP_Error(
				'llm_proxy_error',
				sprintf( 'Failed to fetch models from %s: %s', $url, $response->get_error_message() ),
				array( 'status' => 502 )
			);
		}

		$code = \wp_remote_retrieve_response_code( $response );
		$body = \wp_remote_retrieve_body( $response );

		return new \WP_REST_Response( json_decode( $body, true ), $code );
	}

	/**
	 * Proxy POST /v1/chat/completions to the external endpoint.
	 *
	 * For non-streaming requests, returns the full response.
	 * For streaming requests, outputs SSE directly and exits.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error|void
	 */
	public static function proxy_chat_completions( \WP_REST_Request $request ) {
		$body         = $request->get_json_params();
		$endpoint_url = isset( $body['endpoint_url'] ) ? \untrailingslashit( \esc_url_raw( $body['endpoint_url'] ) ) : '';
		$api_key      = isset( $body['api_key'] ) ? \sanitize_text_field( $body['api_key'] ) : '';
		$is_streaming = ! empty( $body['stream'] );

		if ( empty( $endpoint_url ) ) {
			return new \WP_Error(
				'llm_proxy_missing_url',
				'endpoint_url is required in the request body.',
				array( 'status' => 400 )
			);
		}

		// Remove proxy-specific fields before forwarding.
		unset( $body['endpoint_url'], $body['api_key'] );

		$url     = $endpoint_url . '/v1/chat/completions';
		$headers = array(
			'Content-Type' => 'application/json',
		);
		if ( ! empty( $api_key ) ) {
			$headers['Authorization'] = 'Bearer ' . $api_key;
		}

		if ( ! $is_streaming ) {
			return self::proxy_non_streaming( $url, $headers, $body );
		}

		return self::proxy_streaming( $url, $headers, $body );
	}

	/**
	 * Handle non-streaming proxy request.
	 *
	 * @param string $url     Target URL.
	 * @param array  $headers Request headers.
	 * @param array  $body    Request body.
	 * @return \WP_REST_Response|\WP_Error
	 */
	private static function proxy_non_streaming( string $url, array $headers, array $body ) {
		$response = \wp_remote_post(
			$url,
			array(
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
				'timeout' => 300, // 5 minutes for slow LLMs
			)
		);

		if ( \is_wp_error( $response ) ) {
			return new \WP_Error(
				'llm_proxy_error',
				sprintf( 'Failed to connect to %s: %s', $url, $response->get_error_message() ),
				array( 'status' => 502 )
			);
		}

		$code          = \wp_remote_retrieve_response_code( $response );
		$response_body = \wp_remote_retrieve_body( $response );

		return new \WP_REST_Response( json_decode( $response_body, true ), $code );
	}

	/**
	 * Handle streaming proxy request — pass-through SSE.
	 *
	 * The WordPress HTTP API buffers the full response, so we fetch the
	 * complete SSE body and emit it to the browser in standard SSE format.
	 *
	 * @param string $url     Target URL.
	 * @param array  $headers Request headers.
	 * @param array  $body    Request body.
	 */
	private static function proxy_streaming( string $url, array $headers, array $body ): void {
		// Disable output buffering for streaming.
		while ( ob_get_level() ) {
			ob_end_clean();
		}

		// Set SSE headers.
		header( 'Content-Type: text/event-stream' );
		header( 'Cache-Control: no-cache' );
		header( 'Connection: keep-alive' );
		header( 'X-Accel-Buffering: no' );

		// The WordPress HTTP API buffers rather than streams the response, so we
		// fetch the complete SSE body and emit it as-is in standard SSE format.
		$wp_headers = array(
			'Content-Type' => 'application/json',
			'Accept'       => 'text/event-stream',
		);
		if ( isset( $headers['Authorization'] ) ) {
			$wp_headers['Authorization'] = $headers['Authorization'];
		}

		$response = \wp_remote_post(
			$url,
			array(
				'headers' => $wp_headers,
				'body'    => wp_json_encode( $body ),
				'timeout' => 300,
			)
		);

		if ( \is_wp_error( $response ) ) {
			header( 'Content-Type: application/json', true, 502 );
			echo wp_json_encode(
				array(
					'error' => 'LLM proxy request failed: ' . $response->get_error_message(),
					'url'   => $url,
				)
			);
			exit;
		}

		$response_body = \wp_remote_retrieve_body( $response );
		echo $response_body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		if ( ob_get_level() ) {
			ob_flush();
		}
		flush();

		exit;
	}
}
