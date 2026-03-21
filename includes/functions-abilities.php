<?php
/**
 * Agentic Abilities Registration API
 *
 * Public functions for registering agentic abilities.
 * This API allows both WP-Agentic-Admin and third-party plugins
 * to register abilities that the AI assistant can use.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Global storage for registered agentic abilities.
 *
 * @var array
 */
global $wp_agentic_abilities;
$wp_agentic_abilities = array();

/**
 * Register a agentic ability.
 *
 * This function registers an ability with both the WordPress Abilities API
 * (for backend execution) and stores the JS configuration for frontend use.
 *
 * @since 0.1.0
 *
 * @param string $id         Unique ability identifier (e.g., 'wp-agentic-admin/cache-flush').
 * @param array  $php_args   PHP configuration for the WordPress Abilities API.
 *                           See wp_register_ability() for available options.
 * @param array  $js_args    Optional. JavaScript configuration for the chat interface.
 *                           - keywords:            (array)  Words/phrases that trigger this ability.
 *                           - initialMessage:      (string) Message shown while ability executes.
 *                           - requiresConfirmation:(bool)   Whether to show confirmation modal.
 *                           - confirmationMessage: (string) Custom confirmation message.
 * @return bool True on success, false on failure.
 */
function wp_agentic_admin_register_ability( string $id, array $php_args, array $js_args = array() ): bool {
	global $wp_agentic_abilities;

	// Validate ID format.
	if ( empty( $id ) || ! preg_match( '/^[a-z0-9-]+\/[a-z0-9-]+$/', $id ) ) {
		_doing_it_wrong(
			__FUNCTION__,
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- __() is a translation function, output is escaped by _doing_it_wrong()
			sprintf(
				/* translators: %s: ability ID */
				__( 'Invalid ability ID format: %s. Must be in format "namespace/ability-name".', 'wp-agentic-admin' ),
				$id
			),
			'1.0.0'
		);
		return false;
	}

	// Register with WordPress Abilities API if available.
	if ( function_exists( 'wp_register_ability' ) ) {
		wp_register_ability( $id, $php_args );
	}

	// Store JS configuration for later use.
	$wp_agentic_abilities[ $id ] = array(
		'id'  => $id,
		'php' => $php_args,
		'js'  => wp_parse_args(
			$js_args,
			array(
				'keywords'             => array(),
				'initialMessage'       => __( 'Working on it...', 'wp-agentic-admin' ),
				'requiresConfirmation' => false,
				'confirmationMessage'  => '',
			)
		),
	);

	return true;
}

/**
 * Unregister a agentic ability.
 *
 * @since 0.1.0
 *
 * @param string $id Ability identifier.
 * @return bool True if ability was unregistered, false if it didn't exist.
 */
function wp_agentic_admin_unregister_ability( string $id ): bool {
	global $wp_agentic_abilities;

	if ( ! isset( $wp_agentic_abilities[ $id ] ) ) {
		return false;
	}

	unset( $wp_agentic_abilities[ $id ] );

	// Also unregister from WordPress Abilities API if available.
	if ( function_exists( 'wp_unregister_ability' ) ) {
		wp_unregister_ability( $id );
	}

	return true;
}

/**
 * Get all registered agentic abilities.
 *
 * @since 0.1.0
 *
 * @return array Array of registered abilities.
 */
function wp_agentic_admin_get_abilities(): array {
	global $wp_agentic_abilities;
	return $wp_agentic_abilities ?? array();
}

/**
 * Get a specific agentic ability.
 *
 * @since 0.1.0
 *
 * @param string $id Ability identifier.
 * @return array|null Ability configuration or null if not found.
 */
function wp_agentic_admin_get_ability( string $id ): ?array {
	global $wp_agentic_abilities;
	return $wp_agentic_abilities[ $id ] ?? null;
}

/**
 * Get JS configurations for all registered abilities.
 *
 * This is used to pass ability configurations to the frontend.
 * Includes annotations from PHP config for operation type display.
 *
 * @since 0.1.0
 *
 * @return array Array of JS configurations keyed by ability ID.
 */
function wp_agentic_admin_get_abilities_js_config(): array {
	global $wp_agentic_abilities;

	$js_configs = array();

	foreach ( $wp_agentic_abilities as $id => $ability ) {
		$js_config = $ability['js'];

		// Include annotations from PHP config for operation type display.
		if ( isset( $ability['php']['meta']['annotations'] ) ) {
			$js_config['annotations'] = $ability['php']['meta']['annotations'];
		}

		// Include label and description from PHP config.
		if ( isset( $ability['php']['label'] ) ) {
			$js_config['phpLabel'] = $ability['php']['label'];
		}
		if ( isset( $ability['php']['description'] ) ) {
			$js_config['description'] = $ability['php']['description'];
		}

		$js_configs[ $id ] = $js_config;
	}

	return $js_configs;
}

/**
 * Check if a agentic ability is registered.
 *
 * @since 0.1.0
 *
 * @param string $id Ability identifier.
 * @return bool True if ability exists.
 */
function wp_agentic_admin_ability_exists( string $id ): bool {
	global $wp_agentic_abilities;
	return isset( $wp_agentic_abilities[ $id ] );
}
