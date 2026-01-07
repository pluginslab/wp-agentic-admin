<?php
/**
 * Neural Abilities Registration API
 *
 * Public functions for registering neural abilities.
 * This API allows both WP-Neural-Admin and third-party plugins
 * to register abilities that the AI assistant can use.
 *
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Global storage for registered neural abilities.
 *
 * @var array
 */
global $wp_neural_abilities;
$wp_neural_abilities = array();

/**
 * Register a neural ability.
 *
 * This function registers an ability with both the WordPress Abilities API
 * (for backend execution) and stores the JS configuration for frontend use.
 *
 * @since 1.0.0
 *
 * @param string $id         Unique ability identifier (e.g., 'wp-neural-admin/cache-flush').
 * @param array  $php_args   PHP configuration for the WordPress Abilities API.
 *                           See wp_register_ability() for available options.
 * @param array  $js_args    Optional. JavaScript configuration for the chat interface.
 *                           - keywords:            (array)  Words/phrases that trigger this ability.
 *                           - initialMessage:      (string) Message shown while ability executes.
 *                           - requiresConfirmation:(bool)   Whether to show confirmation modal.
 *                           - confirmationMessage: (string) Custom confirmation message.
 * @return bool True on success, false on failure.
 */
function register_neural_ability( string $id, array $php_args, array $js_args = array() ): bool {
	global $wp_neural_abilities;

	// Validate ID format.
	if ( empty( $id ) || ! preg_match( '/^[a-z0-9-]+\/[a-z0-9-]+$/', $id ) ) {
		_doing_it_wrong(
			__FUNCTION__,
			sprintf(
				/* translators: %s: ability ID */
				__( 'Invalid ability ID format: %s. Must be in format "namespace/ability-name".', 'wp-neural-admin' ),
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
	$wp_neural_abilities[ $id ] = array(
		'id'      => $id,
		'php'     => $php_args,
		'js'      => wp_parse_args(
			$js_args,
			array(
				'keywords'             => array(),
				'initialMessage'       => __( 'Working on it...', 'wp-neural-admin' ),
				'requiresConfirmation' => false,
				'confirmationMessage'  => '',
			)
		),
	);

	return true;
}

/**
 * Unregister a neural ability.
 *
 * @since 1.0.0
 *
 * @param string $id Ability identifier.
 * @return bool True if ability was unregistered, false if it didn't exist.
 */
function unregister_neural_ability( string $id ): bool {
	global $wp_neural_abilities;

	if ( ! isset( $wp_neural_abilities[ $id ] ) ) {
		return false;
	}

	unset( $wp_neural_abilities[ $id ] );

	// Also unregister from WordPress Abilities API if available.
	if ( function_exists( 'wp_unregister_ability' ) ) {
		wp_unregister_ability( $id );
	}

	return true;
}

/**
 * Get all registered neural abilities.
 *
 * @since 1.0.0
 *
 * @return array Array of registered abilities.
 */
function get_neural_abilities(): array {
	global $wp_neural_abilities;
	return $wp_neural_abilities ?? array();
}

/**
 * Get a specific neural ability.
 *
 * @since 1.0.0
 *
 * @param string $id Ability identifier.
 * @return array|null Ability configuration or null if not found.
 */
function get_neural_ability( string $id ): ?array {
	global $wp_neural_abilities;
	return $wp_neural_abilities[ $id ] ?? null;
}

/**
 * Get JS configurations for all registered abilities.
 *
 * This is used to pass ability configurations to the frontend.
 * Includes annotations from PHP config for operation type display.
 *
 * @since 1.0.0
 *
 * @return array Array of JS configurations keyed by ability ID.
 */
function get_neural_abilities_js_config(): array {
	global $wp_neural_abilities;

	$js_configs = array();

	foreach ( $wp_neural_abilities as $id => $ability ) {
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
 * Check if a neural ability is registered.
 *
 * @since 1.0.0
 *
 * @param string $id Ability identifier.
 * @return bool True if ability exists.
 */
function neural_ability_exists( string $id ): bool {
	global $wp_neural_abilities;
	return isset( $wp_neural_abilities[ $id ] );
}
