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
	 * Maximum number of messages accepted per chat-completion request.
	 *
	 * Caps long histories before they're forwarded to a paid provider.
	 */
	private const MAX_MESSAGES = 50;

	/**
	 * Maximum total prompt characters accepted per chat-completion request.
	 *
	 * Rough guard against an admin (or a compromised admin) driving
	 * unbounded paid-provider spend through this endpoint.
	 */
	private const MAX_TOTAL_CHARS = 100000;

	/**
	 * Maximum chat-completion requests per user per minute.
	 */
	private const RATE_LIMIT_PER_MINUTE = 30;

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

		$all         = \wp_get_connectors();
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
	 *  - No tool/function calling support yet.
	 *
	 * Guards: enforces MAX_MESSAGES, MAX_TOTAL_CHARS, and a per-user
	 * RATE_LIMIT_PER_MINUTE via a transient. These cap potential paid-
	 * provider spend triggered through this endpoint.
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

		if ( count( $messages ) > self::MAX_MESSAGES ) {
			return new \WP_Error(
				'wpaa_too_many_messages',
				sprintf( 'Too many messages: limit is %d per request.', self::MAX_MESSAGES ),
				array( 'status' => 413 )
			);
		}

		$total_chars = 0;
		foreach ( $messages as $msg ) {
			if ( is_array( $msg ) && isset( $msg['content'] ) ) {
				$total_chars += strlen( (string) $msg['content'] );
			}
		}
		if ( $total_chars > self::MAX_TOTAL_CHARS ) {
			return new \WP_Error(
				'wpaa_payload_too_large',
				sprintf( 'Combined message content exceeds %d characters.', self::MAX_TOTAL_CHARS ),
				array( 'status' => 413 )
			);
		}

		$rate_limit_error = self::check_rate_limit();
		if ( null !== $rate_limit_error ) {
			return $rate_limit_error;
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

			$result = self::generate_with_structured_messages( $messages, $model );
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
	 * Generate a text result through the AI Client using structured
	 * roles so the connector can preserve user / assistant turns and
	 * pass any system instruction as a top-level model directive.
	 *
	 * Falls back to a single concatenated prompt only if the AI Client
	 * structural builder isn't available at runtime.
	 *
	 * @param array<int,array<string,mixed>> $messages OpenAI-style chat messages.
	 * @param mixed|null                     $model    Optional resolved AI Client model.
	 * @return mixed The generated AI Client text result.
	 */
	private static function generate_with_structured_messages( array $messages, $model ) {
		$system_instructions = array();
		$turns               = array();

		foreach ( $messages as $msg ) {
			if ( ! is_array( $msg ) || ! isset( $msg['content'] ) ) {
				continue;
			}
			$role    = isset( $msg['role'] ) ? (string) $msg['role'] : 'user';
			$content = (string) $msg['content'];

			if ( 'system' === $role ) {
				$system_instructions[] = $content;
				continue;
			}
			$turns[] = array(
				'role'    => $role,
				'content' => $content,
			);
		}

		// History must start with a user turn (most providers — Anthropic
		// in particular — reject leading assistant turns). Drop synthetic
		// assistant-led messages like the welcome card until the first
		// real user message.
		while ( ! empty( $turns ) && 'user' !== $turns[0]['role'] ) {
			array_shift( $turns );
		}

		$structural_supported = class_exists( '\\WordPress\\AiClient\\AiClient' )
			&& class_exists( '\\WordPress\\AiClient\\Messages\\DTO\\Message' )
			&& class_exists( '\\WordPress\\AiClient\\Messages\\DTO\\MessagePart' )
			&& class_exists( '\\WordPress\\AiClient\\Messages\\Enums\\MessageRoleEnum' );

		if ( ! $structural_supported || empty( $turns ) ) {
			// Final fallback: lossy concatenation. Only reached when the
			// AI Client builder classes are missing or the message list
			// had no user/assistant turns at all.
			$prompt = self::flatten_messages_lossy(
				array_merge(
					array_map(
						static function ( $s ) {
							return array(
								'role'    => 'system',
								'content' => $s,
							);
						},
						$system_instructions
					),
					$turns
				)
			);
			return null === $model
				? \WordPress\AiClient\AiClient::generateTextResult( $prompt )
				: \WordPress\AiClient\AiClient::generateTextResult( $prompt, $model );
		}

		$role_enum    = '\\WordPress\\AiClient\\Messages\\Enums\\MessageRoleEnum';
		$messages_dto = array();
		foreach ( $turns as $turn ) {
			$enum_role      = 'assistant' === $turn['role']
				? $role_enum::model()
				: $role_enum::user();
			$messages_dto[] = new \WordPress\AiClient\Messages\DTO\Message(
				$enum_role,
				array( new \WordPress\AiClient\Messages\DTO\MessagePart( $turn['content'] ) )
			);
		}

		// Use the latest turn as the active prompt and pass the rest as history,
		// matching PromptBuilder's expected shape.
		$latest  = array_pop( $messages_dto );
		$history = $messages_dto;

		$builder = \WordPress\AiClient\AiClient::prompt();
		foreach ( $latest->getParts() as $part ) {
			$builder = $builder->withMessageParts( $part );
		}
		if ( ! empty( $history ) ) {
			$builder = $builder->withHistory( ...$history );
		}
		if ( ! empty( $system_instructions ) ) {
			$builder = $builder->usingSystemInstruction(
				implode( "\n\n", $system_instructions )
			);
		}
		if ( null !== $model ) {
			$builder = $builder->usingModel( $model );
		}

		return $builder->generateTextResult();
	}

	/**
	 * Concatenate messages into a single prompt as a last-resort fallback
	 * when the structural Message DTOs are unavailable.
	 *
	 * @param array $messages OpenAI-style chat messages.
	 * @return string
	 */
	private static function flatten_messages_lossy( array $messages ): string {
		$lines = array();
		foreach ( $messages as $msg ) {
			if ( ! is_array( $msg ) || ! isset( $msg['content'] ) ) {
				continue;
			}
			$role    = isset( $msg['role'] ) ? ucfirst( (string) $msg['role'] ) : 'User';
			$lines[] = $role . ': ' . (string) $msg['content'];
		}
		return implode( "\n\n", $lines );
	}

	/**
	 * Per-user rate limit for chat completions.
	 *
	 * Caps at RATE_LIMIT_PER_MINUTE requests per user per rolling 60s
	 * window via a transient counter. Returns a WP_Error 429 when the
	 * cap is exceeded, null otherwise.
	 *
	 * @return \WP_Error|null
	 */
	private static function check_rate_limit(): ?\WP_Error {
		$user_id = \get_current_user_id();
		if ( ! $user_id ) {
			return null;
		}

		$key   = 'wpaa_conn_rl_' . $user_id;
		$count = (int) \get_transient( $key );

		if ( $count >= self::RATE_LIMIT_PER_MINUTE ) {
			return new \WP_Error(
				'wpaa_rate_limited',
				sprintf(
					'Connector chat completions are rate-limited to %d requests per minute.',
					self::RATE_LIMIT_PER_MINUTE
				),
				array( 'status' => 429 )
			);
		}

		\set_transient( $key, $count + 1, MINUTE_IN_SECONDS );
		return null;
	}
}
