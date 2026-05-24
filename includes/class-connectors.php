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

		\register_rest_route(
			'wp-agentic-admin/v1',
			'/connectors/chat/completions',
			array(
				'methods'             => 'POST',
				'callback'            => array( static::class, 'chat_completion' ),
				'permission_callback' => array( static::class, 'check_permission' ),
				'args'                => array(
					'connector_id' => array(
						'required' => true,
						'type'     => 'string',
					),
					'model_id'     => array(
						'required' => false,
						'type'     => 'string',
						'default'  => '',
					),
					'messages'     => array(
						'required' => true,
						'type'     => 'array',
					),
				),
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

			$models = array();
			if ( $is_connected && null !== $ai_registry ) {
				try {
					$provider_class = $ai_registry->getProviderClassName( $id );
					if ( $provider_class && method_exists( $provider_class, 'modelMetadataDirectory' ) ) {
						$directory = $provider_class::modelMetadataDirectory();
						foreach ( $directory->listModelMetadata() as $meta ) {
							$models[] = array(
								'id'   => $meta->getId(),
								'name' => $meta->getName(),
							);
						}
					}
				} catch ( \Exception $e ) {
					$models = array();
				}
			}

			$out['connectors'][] = array(
				'id'           => $id,
				'name'         => $data['name'] ?? $id,
				'description'  => $data['description'] ?? '',
				'logo_url'     => $data['logo_url'] ?? null,
				'is_connected' => $is_connected,
				'models'       => $models,
			);
		}

		return new \WP_REST_Response( $out, 200 );
	}

	/**
	 * POST /v1/connectors/chat/completions — proxy a chat completion through
	 * the AI Client to a configured connector's provider.
	 *
	 * KNOWN LIMITATIONS (documented for honesty, will be addressed in follow-up):
	 *  - Non-streaming only. AI Client doesn't expose a streaming API for
	 *    text generation, so this returns the full assistant message at once.
	 *  - Lossy prompt flattening: messages array is concatenated into a
	 *    single string ("role: content") rather than passed structurally.
	 *  - No tool/function calling support yet.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function chat_completion( \WP_REST_Request $request ) {
		if ( ! class_exists( '\\WordPress\\AiClient\\AiClient' ) ) {
			return new \WP_Error(
				'wpaa_no_ai_client',
				'WP AI Client is not available (requires WordPress 7.0+).',
				array( 'status' => 501 )
			);
		}

		$connector_id = (string) $request->get_param( 'connector_id' );
		$model_id     = (string) $request->get_param( 'model_id' );
		$messages     = (array) $request->get_param( 'messages' );

		if ( '' === $connector_id || empty( $messages ) ) {
			return new \WP_Error(
				'wpaa_bad_request',
				'connector_id and messages are required.',
				array( 'status' => 400 )
			);
		}

		try {
			$registry = \WordPress\AiClient\AiClient::defaultRegistry();
			if ( ! $registry->hasProvider( $connector_id ) ) {
				return new \WP_Error(
					'wpaa_unknown_connector',
					sprintf( 'Connector "%s" is not registered with the AI Client.', $connector_id ),
					array( 'status' => 404 )
				);
			}
			if ( ! $registry->isProviderConfigured( $connector_id ) ) {
				return new \WP_Error(
					'wpaa_unconfigured_connector',
					sprintf( 'Connector "%s" is not configured (missing API key).', $connector_id ),
					array( 'status' => 400 )
				);
			}

			// Flatten messages → single prompt string (lossy).
			$prompt = self::flatten_messages( $messages );

			// Resolve a specific model if requested; fall back to AI Client
			// auto-discovery if none provided or resolution fails.
			$model = null;
			if ( '' !== $model_id ) {
				try {
					$provider = $registry->getProviderModel( $connector_id, $model_id );
					$model    = $provider;
				} catch ( \Exception $e ) {
					$model = null;
				}
			}

			$result = null === $model
				? \WordPress\AiClient\AiClient::generateTextResult( $prompt )
				: \WordPress\AiClient\AiClient::generateTextResult( $prompt, $model );
			$text   = method_exists( $result, 'toText' ) ? $result->toText() : (string) $result;

			// Return an OpenAI-shaped non-streaming response so the existing
			// chat orchestrator code path can consume it without changes.
			$response = array(
				'id'      => 'chatcmpl-' . wp_generate_uuid4(),
				'object'  => 'chat.completion',
				'created' => time(),
				'model'   => $connector_id,
				'choices' => array(
					array(
						'index'         => 0,
						'message'       => array(
							'role'    => 'assistant',
							'content' => $text,
						),
						'finish_reason' => 'stop',
					),
				),
			);

			return new \WP_REST_Response( $response, 200 );
		} catch ( \Exception $e ) {
			return new \WP_Error(
				'wpaa_connector_error',
				$e->getMessage(),
				array( 'status' => 500 )
			);
		}
	}

	/**
	 * Flatten an OpenAI-style messages array into a single prompt string.
	 *
	 * Lossy: roles become "User:" / "Assistant:" / "System:" prefixes. The
	 * structural metadata (tool calls, role identity for multi-turn) is
	 * lost. Acceptable for a v0 connector POC; should be replaced with
	 * PromptBuilder structural calls once the AI Client exposes them.
	 *
	 * @param array $messages OpenAI-style chat messages.
	 * @return string
	 */
	private static function flatten_messages( array $messages ): string {
		$lines = array();
		foreach ( $messages as $msg ) {
			if ( ! is_array( $msg ) || ! isset( $msg['content'] ) ) {
				continue;
			}
			$role  = isset( $msg['role'] ) ? ucfirst( (string) $msg['role'] ) : 'User';
			$lines[] = $role . ': ' . (string) $msg['content'];
		}
		return implode( "\n\n", $lines );
	}
}
