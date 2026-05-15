<?php
/**
 * Comment Stats Ability
 *
 * Shows comment counts by status.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the comment-stats ability.
 *
 * @return void
 */
function agentic_admin_register_comment_stats(): void {
	agentic_admin_register_ability(
		'wp-agentic-admin/comment-stats',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Comment Statistics', 'agentic-admin' ),
			'description'         => __( 'Show comment counts by status.', 'agentic-admin' ),
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
					'total'    => array(
						'type'        => 'integer',
						'description' => __( 'Total comments.', 'agentic-admin' ),
					),
					'approved' => array(
						'type'        => 'integer',
						'description' => __( 'Approved comments.', 'agentic-admin' ),
					),
					'pending'  => array(
						'type'        => 'integer',
						'description' => __( 'Pending comments.', 'agentic-admin' ),
					),
					'spam'     => array(
						'type'        => 'integer',
						'description' => __( 'Spam comments.', 'agentic-admin' ),
					),
					'trash'    => array(
						'type'        => 'integer',
						'description' => __( 'Trashed comments.', 'agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'agentic_admin_execute_comment_stats',
			'permission_callback' => function () {
				return current_user_can( 'moderate_comments' );
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
			'keywords'       => array( 'comment', 'comments', 'spam', 'pending', 'moderation' ),
			'initialMessage' => __( "I'll check your comment statistics...", 'agentic-admin' ),
		)
	);
}

/**
 * Execute the comment-stats ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function agentic_admin_execute_comment_stats( array $input = array() ): array {
	$counts = wp_count_comments();

	return array(
		'total'    => (int) $counts->total_comments,
		'approved' => (int) $counts->approved,
		'pending'  => (int) $counts->moderated,
		'spam'     => (int) $counts->spam,
		'trash'    => (int) $counts->trash,
	);
}
