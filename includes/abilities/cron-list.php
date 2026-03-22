<?php
/**
 * Cron List Ability
 *
 * Lists all scheduled WordPress cron events.
 * Similar to WP-CLI: wp cron event list
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the cron-list ability.
 *
 * @return void
 */
function wp_agentic_admin_register_cron_list(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/cron-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Cron Events', 'wp-agentic-admin' ),
			'description'         => __( 'List all scheduled WordPress cron events and their next run times.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'show_overdue' => array(
						'type'        => 'boolean',
						'description' => __( 'Highlight overdue cron events.', 'wp-agentic-admin' ),
						'default'     => true,
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'       => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the operation was successful.', 'wp-agentic-admin' ),
					),
					'message'       => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'total_events'  => array(
						'type'        => 'integer',
						'description' => __( 'Total number of cron events.', 'wp-agentic-admin' ),
					),
					'overdue_count' => array(
						'type'        => 'integer',
						'description' => __( 'Number of overdue events.', 'wp-agentic-admin' ),
					),
					'events'        => array(
						'type'        => 'array',
						'description' => __( 'List of cron events.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_cron_list',
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
			'keywords'       => array( 'cron', 'scheduled', 'tasks', 'events', 'jobs', 'wp-cron', 'schedule', 'background' ),
			'initialMessage' => __( 'Fetching scheduled cron events...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the cron-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_cron_list( array $input = array() ): array {
	$show_overdue = isset( $input['show_overdue'] ) ? (bool) $input['show_overdue'] : true;
	$crons        = _get_cron_array();
	$events       = array();
	$overdue      = 0;
	$current_time = time();

	if ( empty( $crons ) ) {
		return array(
			'success'       => true,
			'message'       => __( 'No cron events scheduled.', 'wp-agentic-admin' ),
			'total_events'  => 0,
			'overdue_count' => 0,
			'events'        => array(),
		);
	}

	// Flatten the cron array into a list of events.
	foreach ( $crons as $timestamp => $hooks ) {
		foreach ( $hooks as $hook => $events_data ) {
			foreach ( $events_data as $key => $event ) {
				$is_overdue = $timestamp < $current_time;

				if ( $is_overdue ) {
					++$overdue;
				}

				// Get human-readable schedule name.
				$schedule_name = $event['schedule'];
				if ( $schedule_name ) {
					$schedules = wp_get_schedules();
					if ( isset( $schedules[ $schedule_name ] ) ) {
						$schedule_name = $schedules[ $schedule_name ]['display'];
					}
				} else {
					$schedule_name = __( 'One-time', 'wp-agentic-admin' );
				}

				$events[] = array(
					'hook'          => $hook,
					'next_run'      => gmdate( 'Y-m-d H:i:s', $timestamp ),
					'next_run_diff' => human_time_diff( $timestamp, $current_time ),
					'schedule'      => $schedule_name,
					'interval'      => isset( $event['interval'] ) ? $event['interval'] : null,
					'is_overdue'    => $is_overdue,
					'args'          => $event['args'],
				);
			}
		}
	}

	// Sort by next run time.
	usort(
		$events,
		function ( $a, $b ) {
			return strtotime( $a['next_run'] ) - strtotime( $b['next_run'] );
		}
	);

	$total = count( $events );

	// Build message.
	if ( $overdue > 0 && $show_overdue ) {
		$message = sprintf(
			/* translators: 1: total events, 2: overdue count */
			__( 'Found %1$d scheduled cron events. %2$d are overdue and may need attention.', 'wp-agentic-admin' ),
			$total,
			$overdue
		);
	} else {
		$message = sprintf(
			/* translators: %d: total events */
			_n(
				'Found %d scheduled cron event.',
				'Found %d scheduled cron events.',
				$total,
				'wp-agentic-admin'
			),
			$total
		);
	}

	return array(
		'success'       => true,
		'message'       => $message,
		'total_events'  => $total,
		'overdue_count' => $overdue,
		'events'        => $events,
	);
}
