<?php
/**
 * Run Plugin Ability
 *
 * Generic proxy to execute any ability discovered via discover-plugin-abilities.
 * This allows the LLM to call abilities from other plugins dynamically.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the run-plugin-ability ability.
 *
 * @return void
 */
function wp_agentic_admin_register_run_plugin_ability(): void {
	register_agentic_ability(
		'wp-agentic-admin/run-plugin-ability',
		array(
			'label'               => __( 'Run Plugin Ability', 'wp-agentic-admin' ),
			'description'         => __( 'Run an ability from another plugin by its ID.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'ability_id' => array(
						'type'        => 'string',
						'description' => __( 'The full ability ID to execute (e.g. "my-plugin/my-ability").', 'wp-agentic-admin' ),
					),
					'args'       => array(
						'type'                 => 'object',
						'default'              => (object) array(),
						'description'          => __( 'Arguments to pass to the ability (based on its input_schema).', 'wp-agentic-admin' ),
						'additionalProperties' => true,
					),
				),
				'required'             => array( 'ability_id' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success' => array( 'type' => 'boolean' ),
					'result'  => array( 'type' => 'object' ),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_run_plugin_ability',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'    => false,
					'destructive' => false,
					'idempotent'  => false,
				),
			),
		),
		array(
			'keywords'             => array( 'execute plugin', 'run ability', 'call ability', 'use ability' ),
			'initialMessage'       => __( 'Executing plugin ability...', 'wp-agentic-admin' ),
			'requiresConfirmation' => true,
		)
	);
}

/**
 * Execute a plugin ability by ID.
 *
 * Acts as a proxy — looks up the ability in the WP Abilities registry
 * and calls its execute_callback with the provided args.
 *
 * @param array $input Input parameters with ability_id and args.
 * @return array Execution result.
 */
function wp_agentic_admin_run_plugin_ability( $input = array() ): array {
	$input = (array) $input;
	$ability_id = isset( $input['ability_id'] ) ? $input['ability_id'] : '';
	$args       = isset( $input['args'] ) ? $input['args'] : array();

	if ( empty( $ability_id ) ) {
		return array(
			'success' => false,
			'message' => 'ability_id is required.',
		);
	}

	// Validate format.
	if ( ! preg_match( '/^[a-z0-9-]+\/[a-z0-9-]+$/', $ability_id ) ) {
		return array(
			'success' => false,
			'message' => 'Invalid ability_id format. Expected "namespace/ability-name".',
		);
	}

	if ( ! function_exists( 'wp_get_ability' ) ) {
		return array(
			'success' => false,
			'message' => 'WP Abilities API is not available (WordPress 6.9+ required).',
		);
	}

	$ability = wp_get_ability( $ability_id );

	if ( ! $ability ) {
		return array(
			'success'    => false,
			'ability_id' => $ability_id,
			'message'    => sprintf( 'Ability "%s" not found.', $ability_id ),
		);
	}

	// Use WP_Ability::execute() which handles validation, permissions, and execution.
	try {
		$result = $ability->execute( $args );

		if ( is_wp_error( $result ) ) {
			return array(
				'success'    => false,
				'ability_id' => $ability_id,
				'message'    => sprintf( 'Error from "%s": %s', $ability_id, $result->get_error_message() ),
			);
		}

		return array(
			'success'    => true,
			'ability_id' => $ability_id,
			'message'    => sprintf( 'Successfully executed "%s".', $ability_id ),
			'result'     => $result,
		);
	} catch ( \Throwable $e ) {
		return array(
			'success'    => false,
			'ability_id' => $ability_id,
			'message'    => sprintf( 'Error executing "%s": %s', $ability_id, $e->getMessage() ),
		);
	}
}
