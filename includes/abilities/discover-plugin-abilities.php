<?php
/**
 * Discover Abilities
 *
 * Discovers abilities registered by other plugins via the WP Abilities API.
 * Returns a compact summary to avoid polluting the LLM context window.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the discover-plugin-abilities ability.
 *
 * @return void
 */
function wp_agentic_admin_register_discover_plugin_abilities(): void {
	register_agentic_ability(
		'wp-agentic-admin/discover-plugin-abilities',
		array(
			'label'               => __( 'Discover Plugin Abilities', 'wp-agentic-admin' ),
			'description'         => __( 'Discover abilities registered by other plugins on this WordPress site.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => (object) array(),
				'properties'           => array(
					'category' => array(
						'type'        => 'string',
						'default'     => '',
						'description' => __( 'Optional category to filter abilities by.', 'wp-agentic-admin' ),
					),
					'search'   => array(
						'type'        => 'string',
						'default'     => '',
						'description' => __( 'Optional search term to filter abilities.', 'wp-agentic-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'abilities' => array(
						'type'        => 'array',
						'description' => __( 'List of discovered plugin abilities.', 'wp-agentic-admin' ),
					),
					'total'     => array(
						'type'        => 'integer',
						'description' => __( 'Total number of discovered abilities.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_discover_plugin_abilities',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'    => true,
					'destructive' => false,
					'idempotent'  => true,
				),
			),
		),
		array(
			'keywords'       => array( 'discover', 'find abilities', 'plugin abilities', 'other plugins abilities', 'available tools', 'what can' ),
			'initialMessage' => __( 'Discovering abilities from other plugins...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the discover-plugin-abilities ability.
 *
 * Queries the WP Abilities API registry to find abilities registered
 * by other plugins (excluding our own wp-agentic-admin/* abilities).
 *
 * @param array $input Input parameters.
 * @return array Discovered abilities in compact format.
 */
/**
 * Get plugin icon URLs keyed by namespace prefix.
 *
 * Matches ability namespaces (e.g. "wpforms") to installed plugin slugs
 * and pulls icon URLs from the WordPress.org update cache.
 *
 * @return array<string, string> Map of namespace => icon URL.
 */
function wp_agentic_admin_get_plugin_icons(): array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$icons   = array();
	$plugins = get_plugins();
	$updates = get_site_transient( 'update_plugins' );

	// Build a lookup of plugin slug => icon URL from the updates transient.
	$icon_lookup = array();
	if ( $updates ) {
		foreach ( array( 'response', 'no_update' ) as $group ) {
			if ( empty( $updates->$group ) ) {
				continue;
			}
			foreach ( $updates->$group as $file => $data ) {
				$data = (object) $data;
				if ( ! empty( $data->icons ) ) {
					$icon_data = (array) $data->icons;
					// Prefer svg, then 2x, then 1x, then default.
					$url = $icon_data['svg'] ?? $icon_data['2x'] ?? $icon_data['1x'] ?? $icon_data['default'] ?? '';
					if ( $url ) {
						$slug                 = $data->slug ?? dirname( $file );
						$icon_lookup[ $slug ] = $url;
					}
				}
			}
		}
	}

	// Map each installed plugin's slug to its icon.
	foreach ( $plugins as $file => $plugin_data ) {
		$slug = dirname( $file );
		if ( '.' === $slug ) {
			$slug = basename( $file, '.php' );
		}
		if ( isset( $icon_lookup[ $slug ] ) ) {
			// Use the slug as the namespace key (e.g. "wpforms-lite" => icon).
			$icons[ $slug ] = $icon_lookup[ $slug ];
		}
	}

	return $icons;
}

function wp_agentic_admin_execute_discover_plugin_abilities( $input = array() ): array {
	$input = (array) $input;
	if ( ! function_exists( 'wp_get_abilities' ) ) {
		return array(
			'success'   => false,
			'message'   => 'WP Abilities API is not available (WordPress 6.9+ required).',
			'abilities' => array(),
			'total'     => 0,
		);
	}

	// Some plugins (e.g. WooCommerce) only register abilities during MCP/REST requests.
	// Re-fire the registration action so they get a chance to register here too.
	// This is safe because wp_register_ability() deduplicates by name.
	do_action( 'wp_agentic_admin_discover_abilities' );

	$all_abilities = wp_get_abilities();
	$plugin_icons  = wp_agentic_admin_get_plugin_icons();
	$category      = isset( $input['category'] ) ? $input['category'] : '';
	$search        = isset( $input['search'] ) ? strtolower( $input['search'] ) : '';

	// Our own namespaces to exclude — we already have these as native tools.
	$own_namespaces = array( 'wp-agentic-admin/', 'core/' );

	$external = array();

	foreach ( $all_abilities as $name => $ability ) {
		// $ability is a WP_Ability object — use public getter methods.
		$id = $ability->get_name();

		if ( empty( $id ) ) {
			continue;
		}

		// Skip our own abilities.
		$is_own = false;
		foreach ( $own_namespaces as $ns ) {
			if ( strpos( $id, $ns ) === 0 ) {
				$is_own = true;
				break;
			}
		}
		if ( $is_own ) {
			continue;
		}

		$label       = $ability->get_label();
		$description = $ability->get_description();
		$cat         = $ability->get_category();
		$meta        = $ability->get_meta();
		$schema      = $ability->get_input_schema();

		// Skip abilities not shown in REST.
		$show_in_rest = $meta['show_in_rest'] ?? false;
		if ( ! $show_in_rest ) {
			continue;
		}

		// Category filter.
		if ( ! empty( $category ) && $cat !== $category ) {
			continue;
		}

		// Search filter.
		if ( ! empty( $search ) ) {
			$haystack = strtolower( $id . ' ' . $label . ' ' . $description );
			if ( strpos( $haystack, $search ) === false ) {
				continue;
			}
		}

		// Build compact representation — only what the LLM needs to call it.
		$compact = array(
			'id'          => $id,
			'label'       => $label,
			'description' => $description,
		);

		// Resolve plugin icon by matching ability namespace to plugin slugs.
		$namespace = explode( '/', $id )[0];
		foreach ( $plugin_icons as $slug => $icon_url ) {
			// Match: exact slug, slug starts with namespace, or namespace starts with slug.
			if ( $slug === $namespace || strpos( $slug, $namespace ) === 0 || strpos( $namespace, $slug ) === 0 ) {
				$compact['icon'] = $icon_url;
				break;
			}
		}

		// Include input_schema properties so the LLM knows what args to pass.
		$properties = $schema['properties'] ?? array();
		if ( ! empty( $properties ) ) {
			$params = array();
			foreach ( $properties as $prop_name => $prop_schema ) {
				$param = array(
					'type' => $prop_schema['type'] ?? 'string',
				);
				if ( ! empty( $prop_schema['description'] ) ) {
					$param['description'] = $prop_schema['description'];
				}
				if ( isset( $prop_schema['enum'] ) ) {
					$param['enum'] = $prop_schema['enum'];
				}
				if ( isset( $prop_schema['default'] ) ) {
					$param['default'] = $prop_schema['default'];
				}
				$params[ $prop_name ] = $param;
			}
			$compact['parameters'] = $params;

			// Note required fields.
			if ( ! empty( $schema['required'] ) ) {
				$compact['required'] = $schema['required'];
			}
		}

		// Include annotations so we know if it's readonly/destructive.
		$annotations = $meta['annotations'] ?? array();
		if ( ! empty( $annotations ) ) {
			$compact['readonly']    = ! empty( $annotations['readonly'] ) || ! empty( $annotations['isReadOnly'] );
			$compact['destructive'] = ! empty( $annotations['destructive'] );
		}

		$external[] = $compact;
	}

	return array(
		'success'   => true,
		'message'   => sprintf(
			/* translators: %d: number of abilities */
			__( 'Found %d plugin abilities from other plugins.', 'wp-agentic-admin' ),
			count( $external )
		),
		'abilities' => $external,
		'total'     => count( $external ),
	);
}
