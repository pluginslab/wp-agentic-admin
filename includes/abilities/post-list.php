<?php
/**
 * Post List Ability
 *
 * Lists recent WordPress posts.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the post-list ability.
 *
 * @return void
 */
function wp_agentic_admin_register_post_list(): void {
	register_agentic_ability(
		'wp-agentic-admin/post-list',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'List Posts', 'wp-agentic-admin' ),
			'description'         => __( 'List recent WordPress posts with their status.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(
					'status'    => 'any',
					'post_type' => 'post',
					'count'     => 10,
				),
				'properties'           => array(
					'status'    => array(
						'type'        => 'string',
						'default'     => 'any',
						'description' => __( 'Post status filter.', 'wp-agentic-admin' ),
					),
					'post_type' => array(
						'type'        => 'string',
						'default'     => 'post',
						'description' => __( 'Post type filter.', 'wp-agentic-admin' ),
					),
					'count'     => array(
						'type'        => 'integer',
						'default'     => 10,
						'description' => __( 'Number of posts to return.', 'wp-agentic-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'posts' => array(
						'type'        => 'array',
						'description' => __( 'List of posts.', 'wp-agentic-admin' ),
					),
					'total' => array(
						'type'        => 'integer',
						'description' => __( 'Number of posts returned.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_post_list',
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
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
			'keywords'       => array( 'post', 'posts', 'articles', 'content', 'drafts', 'published' ),
			'initialMessage' => __( "I'll fetch your recent posts...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the post-list ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_post_list( array $input = array() ): array {
	$status    = isset( $input['status'] ) ? sanitize_text_field( $input['status'] ) : 'any';
	$post_type = isset( $input['post_type'] ) ? sanitize_text_field( $input['post_type'] ) : 'post';
	$count     = isset( $input['count'] ) ? min( absint( $input['count'] ), 50 ) : 10;

	$wp_posts = get_posts(
		array(
			'post_type'      => $post_type,
			'post_status'    => $status,
			'posts_per_page' => $count,
			'orderby'        => 'date',
			'order'          => 'DESC',
		)
	);

	$posts = array();

	foreach ( $wp_posts as $post ) {
		$author  = get_userdata( $post->post_author );
		$posts[] = array(
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'status'    => $post->post_status,
			'author'    => $author ? $author->display_name : 'Unknown',
			'date'      => $post->post_date,
			'post_type' => $post->post_type,
		);
	}

	return array(
		'posts' => $posts,
		'total' => count( $posts ),
	);
}
