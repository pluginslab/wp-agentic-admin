<?php
/**
 * MCP JSON-RPC server
 *
 * Pure dispatch layer for the MCP endpoint. Handles the four request
 * methods supported in v1 (initialize, ping, tools/list, tools/call) and
 * returns valid JSON-RPC 2.0 envelopes. No HTTP concerns live here —
 * the REST endpoint adapts WP_REST_Request into the array shape this
 * class accepts.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since   0.12.0
 */

namespace WPAgenticAdmin\MCP;

use Throwable;
use WP_Ability;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * JSON-RPC dispatch for the MCP endpoint.
 *
 * @since 0.12.0
 */
class JsonRpc_Server {

	/**
	 * MCP protocol version advertised in `initialize` responses.
	 *
	 * Matches the version Automattic's wordpress-mcp implements (see their
	 * includes/schemas/mcp-2025-06-18.json — the wire format is stable
	 * across the 2025 series for tools/list and tools/call).
	 */
	private const PROTOCOL_VERSION = '2025-03-26';

	/**
	 * JSON-RPC error codes.
	 *
	 * -32700 / -32600 / -32601 / -32602 / -32603 are reserved by JSON-RPC 2.0.
	 * -32001 is a custom code used here for permission denied (anything in
	 * the -32000…-32099 range is reserved for server-defined errors).
	 */
	private const ERR_PARSE             = -32700;
	private const ERR_INVALID_REQUEST   = -32600;
	private const ERR_METHOD_NOT_FOUND  = -32601;
	private const ERR_INVALID_PARAMS    = -32602;
	private const ERR_INTERNAL          = -32603;
	private const ERR_PERMISSION_DENIED = -32001;

	/**
	 * Ability registry instance.
	 *
	 * @var Ability_Registry
	 */
	private Ability_Registry $registry;

	/**
	 * Constructor.
	 *
	 * @param Ability_Registry $registry Ability registry.
	 */
	public function __construct( Ability_Registry $registry ) {
		$this->registry = $registry;
	}

	/**
	 * Handle a single JSON-RPC request payload.
	 *
	 * Returns the JSON-RPC envelope (success or error) as an array. For
	 * notifications (no "id" field), returns an empty array — the caller
	 * MUST treat that as "send no response body".
	 *
	 * @param mixed $payload Decoded JSON-RPC request payload.
	 * @return array
	 */
	public function handle( $payload ): array {
		if ( ! is_array( $payload ) ) {
			return $this->error( null, self::ERR_INVALID_REQUEST, 'Request payload must be a JSON object.' );
		}

		$id     = $payload['id'] ?? null;
		$method = isset( $payload['method'] ) && is_string( $payload['method'] ) ? $payload['method'] : '';
		$params = isset( $payload['params'] ) && is_array( $payload['params'] ) ? $payload['params'] : array();

		if ( '' === $method ) {
			return $this->error( $id, self::ERR_INVALID_REQUEST, 'Missing or invalid "method" field.' );
		}

		// Notifications (no id) — JSON-RPC requires no response.
		$is_notification = ! array_key_exists( 'id', $payload );

		try {
			switch ( $method ) {
				case 'initialize':
					$result = $this->handle_initialize();
					break;
				case 'notifications/initialized':
					// Client telling us it's ready; no response expected.
					return array();
				case 'ping':
					$result = new \stdClass();
					break;
				case 'tools/list':
					$result = $this->handle_tools_list();
					break;
				case 'tools/call':
					return $this->handle_tools_call( $id, $params );
				default:
					return $this->error( $id, self::ERR_METHOD_NOT_FOUND, sprintf( 'Method not found: %s', $method ) );
			}
		} catch ( Throwable $e ) {
			return $this->error( $id, self::ERR_INTERNAL, 'Internal server error.' );
		}

		if ( $is_notification ) {
			return array();
		}

		return $this->success( $id, $result );
	}

	/**
	 * Handle `initialize` — return serverInfo + capabilities.
	 *
	 * @return array
	 */
	private function handle_initialize(): array {
		return array(
			'protocolVersion' => self::PROTOCOL_VERSION,
			'serverInfo'      => array(
				'name'    => 'Agentic Admin MCP Server',
				'version' => defined( 'WP_AGENTIC_ADMIN_VERSION' ) ? WP_AGENTIC_ADMIN_VERSION : '0.0.0',
			),
			'capabilities'    => array(
				'tools' => array(
					'list' => true,
					'call' => true,
				),
			),
		);
	}

	/**
	 * Handle `tools/list` — enumerate exposed abilities as MCP tools.
	 *
	 * @return array
	 */
	private function handle_tools_list(): array {
		$tools = array();
		foreach ( $this->registry->get_exposed_abilities() as $ability ) {
			$tools[] = $this->registry->to_mcp_tool( $ability );
		}
		return array( 'tools' => $tools );
	}

	/**
	 * Handle `tools/call` — resolve, permission-check, execute.
	 *
	 * @param mixed $id     Request id for the response envelope.
	 * @param array $params { name: string, arguments?: array }.
	 * @return array JSON-RPC envelope.
	 */
	private function handle_tools_call( $id, array $params ): array {
		$name = isset( $params['name'] ) && is_string( $params['name'] ) ? $params['name'] : '';
		if ( '' === $name ) {
			return $this->error( $id, self::ERR_INVALID_PARAMS, 'Missing required parameter: name.' );
		}

		$ability = $this->registry->resolve_tool_name( $name );
		if ( null === $ability ) {
			return $this->error( $id, self::ERR_METHOD_NOT_FOUND, sprintf( 'Unknown tool: %s', $name ) );
		}

		$input = array();
		if ( isset( $params['arguments'] ) && is_array( $params['arguments'] ) ) {
			$input = $params['arguments'];
		}

		if ( true !== $ability->check_permissions( $input ) ) {
			return $this->error( $id, self::ERR_PERMISSION_DENIED, 'Permission denied.' );
		}

		try {
			$result = $ability->execute( $input );
		} catch ( Throwable $e ) {
			return $this->success(
				$id,
				array(
					'content' => array(
						array(
							'type' => 'text',
							'text' => sprintf( 'Error executing %s.', $ability->get_name() ),
						),
					),
					'isError' => true,
				)
			);
		}

		if ( $result instanceof WP_Error ) {
			return $this->success(
				$id,
				array(
					'content' => array(
						array(
							'type' => 'text',
							'text' => sprintf( 'Error: %s', $result->get_error_message() ),
						),
					),
					'isError' => true,
				)
			);
		}

		$text = wp_json_encode( $result );
		if ( false === $text ) {
			$text = '';
		}

		return $this->success(
			$id,
			array(
				'content' => array(
					array(
						'type' => 'text',
						'text' => $text,
					),
				),
				'isError' => false,
			)
		);
	}

	/**
	 * Build a JSON-RPC success envelope.
	 *
	 * @param mixed $id     Request id.
	 * @param mixed $result Result payload.
	 * @return array
	 */
	private function success( $id, $result ): array {
		return array(
			'jsonrpc' => '2.0',
			'id'      => $id,
			'result'  => $result,
		);
	}

	/**
	 * Build a JSON-RPC error envelope.
	 *
	 * @param mixed  $id      Request id.
	 * @param int    $code    JSON-RPC error code.
	 * @param string $message Error message.
	 * @return array
	 */
	private function error( $id, int $code, string $message ): array {
		return array(
			'jsonrpc' => '2.0',
			'id'      => $id,
			'error'   => array(
				'code'    => $code,
				'message' => $message,
			),
		);
	}
}
