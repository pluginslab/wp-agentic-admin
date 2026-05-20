<?php
/**
 * MCP Ability Registry
 *
 * Discovers, filters, and maps WordPress Abilities API entries into the
 * MCP tool surface for the v1 read-only endpoint.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since   0.12.0
 */

namespace WPAgenticAdmin\MCP;

use WP_Ability;
use WPAgenticAdmin\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Ability discovery + MCP tool mapping for the MCP endpoint.
 *
 * @since 0.12.0
 */
class Ability_Registry {

	/**
	 * Plugin settings instance.
	 *
	 * @var Settings
	 */
	private Settings $settings;

	/**
	 * Constructor.
	 *
	 * @param Settings $settings Plugin settings instance.
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Whether the MCP endpoint is enabled in settings.
	 *
	 * @return bool
	 */
	public function is_endpoint_enabled(): bool {
		return (bool) $this->settings->get_field( 'agentic_admin_mcp_enabled', 0 );
	}

	/**
	 * Get the abilities currently exposed via MCP, keyed by ability name.
	 *
	 * Applies the v1 read-only filter and the user's expose-own /
	 * expose-third-party / allowlist settings.
	 *
	 * @return array<string, WP_Ability>
	 */
	public function get_exposed_abilities(): array {
		if ( ! function_exists( 'wp_get_abilities' ) ) {
			return array();
		}

		$all          = wp_get_abilities();
		$expose_own   = (bool) $this->settings->get_field( 'agentic_admin_mcp_expose_own', 1 );
		$expose_third = (bool) $this->settings->get_field( 'agentic_admin_mcp_expose_third', 0 );
		$allowlist    = (array) $this->settings->get_field( 'agentic_admin_mcp_allowlist', array() );
		$exposed      = array();

		foreach ( $all as $name => $ability ) {
			if ( ! $ability instanceof WP_Ability ) {
				continue;
			}
			if ( ! $this->is_readonly( $ability ) ) {
				continue;
			}
			$is_own = $this->is_own_ability( $name );
			if ( $is_own && $expose_own ) {
				$exposed[ $name ] = $ability;
				continue;
			}
			if ( ! $is_own && $expose_third && in_array( $name, $allowlist, true ) ) {
				$exposed[ $name ] = $ability;
			}
		}

		return $exposed;
	}

	/**
	 * Get all third-party abilities (everything not prefixed with wp-agentic-admin/).
	 *
	 * Used by the settings page to render the allowlist checkbox list. Returned
	 * regardless of the expose-third setting — the UI decides what to show.
	 *
	 * @return array<string, WP_Ability>
	 */
	public function get_third_party_abilities(): array {
		if ( ! function_exists( 'wp_get_abilities' ) ) {
			return array();
		}
		$out = array();
		foreach ( wp_get_abilities() as $name => $ability ) {
			if ( ! $ability instanceof WP_Ability ) {
				continue;
			}
			if ( $this->is_own_ability( $name ) ) {
				continue;
			}
			$out[ $name ] = $ability;
		}
		return $out;
	}

	/**
	 * Map a WP_Ability into an MCP tool descriptor.
	 *
	 * @param WP_Ability $ability Ability to map.
	 * @return array
	 */
	public function to_mcp_tool( WP_Ability $ability ): array {
		$meta        = $ability->get_meta() ?? array();
		$annotations = isset( $meta['annotations'] ) && is_array( $meta['annotations'] )
			? $meta['annotations']
			: array();

		$input_schema = $ability->get_input_schema();
		if ( ! is_array( $input_schema ) || empty( $input_schema ) ) {
			$input_schema = array(
				'type'       => 'object',
				'properties' => array(),
			);
		}

		return array(
			'name'        => $this->encode_name( $ability->get_name() ),
			'description' => (string) $ability->get_description(),
			'inputSchema' => $input_schema,
			'annotations' => array(
				'title'           => (string) $ability->get_label(),
				'readOnlyHint'    => true,
				'destructiveHint' => (bool) ( $annotations['destructive'] ?? false ),
				'idempotentHint'  => (bool) ( $annotations['idempotent'] ?? false ),
			),
		);
	}

	/**
	 * Resolve an MCP tool name back to a currently-exposed WP_Ability.
	 *
	 * Returns null if the tool name does not correspond to any currently
	 * exposed ability. Callers must treat null as "method not found".
	 *
	 * @param string $tool_name MCP tool name.
	 * @return WP_Ability|null
	 */
	public function resolve_tool_name( string $tool_name ): ?WP_Ability {
		foreach ( $this->get_exposed_abilities() as $name => $ability ) {
			if ( $this->encode_name( $name ) === $tool_name ) {
				return $ability;
			}
		}
		return null;
	}

	/**
	 * Source-plugin label for the settings UI grouping.
	 *
	 * For our own abilities returns "Agentic Admin". For third-party abilities
	 * we use the namespace segment of the ID (best-effort attribution; the
	 * WordPress Abilities API does not currently expose a source-plugin field).
	 *
	 * @param string $ability_name Full ability name (e.g. "woocommerce/list-orders").
	 * @return string
	 */
	public function source_plugin( string $ability_name ): string {
		if ( $this->is_own_ability( $ability_name ) ) {
			return 'Agentic Admin';
		}
		$slash = strpos( $ability_name, '/' );
		if ( false === $slash ) {
			return 'Unknown';
		}
		return substr( $ability_name, 0, $slash );
	}

	/**
	 * Encode an ability name (which contains "/") into an MCP-safe tool name.
	 *
	 * MCP tool names must match ^[a-zA-Z0-9_-]+$. WordPress ability IDs are
	 * "namespace/name". We replace the slash with a double underscore so the
	 * mapping is reversible by inspection and human-readable.
	 *
	 * @param string $ability_name Full ability name.
	 * @return string
	 */
	public function encode_name( string $ability_name ): string {
		return str_replace( '/', '__', $ability_name );
	}

	/**
	 * Whether the ability ID belongs to this plugin.
	 *
	 * @param string $ability_name Ability ID.
	 * @return bool
	 */
	private function is_own_ability( string $ability_name ): bool {
		return str_starts_with( $ability_name, 'wp-agentic-admin/' );
	}

	/**
	 * Read-only filter per the v1 spec.
	 *
	 * Absent or non-true readonly annotation excludes the ability. This is
	 * deliberately conservative: an ability that has not declared itself
	 * read-only will not be exposed over MCP in v1.
	 *
	 * @param WP_Ability $ability Ability to check.
	 * @return bool
	 */
	private function is_readonly( WP_Ability $ability ): bool {
		$meta = $ability->get_meta() ?? array();
		return isset( $meta['annotations']['readonly'] )
			&& true === $meta['annotations']['readonly'];
	}
}
