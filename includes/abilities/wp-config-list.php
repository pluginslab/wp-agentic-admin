<?php
/**
 * WP-Config Constants List Ability
 *
 * Lists the constants defined in wp-config.php without ever returning
 * credentials, authentication keys, or salts.
 *
 * The file is only tokenized to learn which constant NAMES it defines.
 * Values come from the running WordPress constants, and are read only for
 * names that are not sensitive. Sensitive constants are reported as
 * redacted without their value ever being read.
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the wp-config-list ability.
 *
 * @return void
 */
function agentic_admin_register_wp_config_list(): void {
	agentic_admin_register_ability(
		'agentic-admin/wp-config-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List wp-config constants', 'agentic-admin' ),
			'description'         => __( 'List the constants defined in wp-config.php. Credentials, authentication keys, and salts are never returned.', 'agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(),
				'properties'           => array(),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'      => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the operation was successful.', 'agentic-admin' ),
					),
					'message'      => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'agentic-admin' ),
					),
					'constants'    => array(
						'type'        => 'array',
						'description' => __( 'Constants as name/value pairs. Sensitive values are replaced by [REDACTED].', 'agentic-admin' ),
					),
					'total'        => array(
						'type'        => 'integer',
						'description' => __( 'Number of constants found.', 'agentic-admin' ),
					),
					'was_redacted' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether any sensitive constants were withheld.', 'agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'agentic_admin_execute_wp_config_list',
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
		// JS configuration for chat interface.
		array(
			'keywords'       => array( 'constants', 'defined', 'define', 'wp-config', 'configuration', 'WP_DEBUG', 'config constants', 'wp-config constants' ),
			'initialMessage' => __( "I'll list the wp-config.php constants...", 'agentic-admin' ),
		)
	);
}

/**
 * Execute the wp-config-list ability.
 *
 * @param array $input Input parameters (unused).
 * @return array
 */
function agentic_admin_execute_wp_config_list( array $input = array() ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Abilities API signature.
	$config_file = agentic_admin_locate_wp_config();

	if ( '' === $config_file ) {
		return array(
			'success' => false,
			'message' => __( 'Could not locate wp-config.php.', 'agentic-admin' ),
		);
	}

	$names        = agentic_admin_wp_config_define_names( $config_file );
	$constants    = array();
	$was_redacted = false;

	foreach ( $names as $name ) {
		if ( agentic_admin_is_sensitive_constant( $name ) ) {
			$value        = '[REDACTED]';
			$was_redacted = true;
		} elseif ( defined( $name ) ) {
			$value = agentic_admin_format_constant_value( constant( $name ) );
		} else {
			$value = __( '(not defined at runtime)', 'agentic-admin' );
		}

		$constants[] = array(
			'name'  => $name,
			'value' => $value,
		);
	}

	return array(
		'success'      => true,
		'message'      => sprintf(
			/* translators: %d: number of constants */
			_n( '%d constant defined in wp-config.php.', '%d constants defined in wp-config.php.', count( $constants ), 'agentic-admin' ),
			count( $constants )
		),
		'constants'    => $constants,
		'total'        => count( $constants ),
		'was_redacted' => $was_redacted,
	);
}

/**
 * Locate wp-config.php the same way wp-load.php does: in the WordPress
 * directory, or one level above it when that directory is not itself
 * another WordPress install.
 *
 * @return string Absolute path, or an empty string when not found.
 */
function agentic_admin_locate_wp_config(): string {
	$wp_dir = untrailingslashit( wp_normalize_path( ABSPATH ) );

	if ( file_exists( $wp_dir . '/wp-config.php' ) ) {
		return $wp_dir . '/wp-config.php';
	}

	$parent = dirname( $wp_dir );
	if ( file_exists( $parent . '/wp-config.php' ) && ! file_exists( $parent . '/wp-settings.php' ) ) {
		return $parent . '/wp-config.php';
	}

	return '';
}

/**
 * Collect the constant names passed to define() in a PHP file.
 *
 * Uses the PHP tokenizer so only literal names are collected. Values in the
 * file are never extracted.
 *
 * @param string $file Absolute path to the PHP file.
 * @return string[] Unique constant names in file order.
 */
function agentic_admin_wp_config_define_names( string $file ): array {
	$source = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file, tokenized only.
	if ( false === $source ) {
		return array();
	}

	$tokens = token_get_all( $source );
	unset( $source );

	$names = array();
	$count = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		$token = $tokens[ $i ];
		if ( ! is_array( $token ) || ! in_array( $token[0], array( T_STRING, T_NAME_FULLY_QUALIFIED ), true ) || 'define' !== strtolower( ltrim( $token[1], '\\' ) ) ) {
			continue;
		}

		// Next significant tokens must be "(" then a literal string name.
		$j = agentic_admin_next_significant_token( $tokens, $i + 1 );
		if ( null === $j || '(' !== $tokens[ $j ] ) {
			continue;
		}
		$j = agentic_admin_next_significant_token( $tokens, $j + 1 );
		if ( null === $j || ! is_array( $tokens[ $j ] ) || T_CONSTANT_ENCAPSED_STRING !== $tokens[ $j ][0] ) {
			continue;
		}

		$name = substr( $tokens[ $j ][1], 1, -1 );
		if ( preg_match( '/^[A-Za-z_][A-Za-z0-9_]*$/', $name ) ) {
			$names[ $name ] = true;
		}
	}

	return array_keys( $names );
}

/**
 * Find the index of the next token that is not whitespace or a comment.
 *
 * @param array $tokens Token list from token_get_all().
 * @param int   $start  Index to start from.
 * @return int|null Token index, or null at end of input.
 */
function agentic_admin_next_significant_token( array $tokens, int $start ): ?int {
	$count = count( $tokens );
	for ( $i = $start; $i < $count; $i++ ) {
		if ( is_array( $tokens[ $i ] ) && in_array( $tokens[ $i ][0], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
			continue;
		}
		return $i;
	}
	return null;
}

/**
 * Whether a constant holds a credential, key, salt, or similar secret.
 *
 * @param string $name Constant name.
 * @return bool
 */
function agentic_admin_is_sensitive_constant( string $name ): bool {
	$upper = strtoupper( $name );

	if ( in_array( $upper, array( 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST' ), true ) ) {
		return true;
	}

	return (bool) preg_match( '/(KEY|SALT|SECRET|TOKEN|PASS|PASSWORD|PASSWD|AUTH|CREDENTIAL|PRIVATE|LICENSE)/', $upper );
}

/**
 * Format a constant's runtime value for display.
 *
 * @param mixed $value Constant value.
 * @return string
 */
function agentic_admin_format_constant_value( $value ): string {
	if ( is_bool( $value ) ) {
		return $value ? 'true' : 'false';
	}
	if ( null === $value ) {
		return 'null';
	}
	if ( is_scalar( $value ) ) {
		return (string) $value;
	}
	return (string) wp_json_encode( $value );
}
