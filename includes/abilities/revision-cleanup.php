<?php
/**
 * Revision Cleanup Ability
 *
 * Deletes old post revisions to clean up the database.
 * Similar to WP-CLI: wp post delete $(wp post list --post_type=revision --format=ids)
 *
 * @package WPAgenticAdmin
 * @since 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the revision-cleanup ability.
 *
 * @return void
 */
function wp_agentic_admin_register_revision_cleanup(): void {
	register_agentic_ability(
		'wp-agentic-admin/revision-cleanup',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Clean Up Revisions', 'wp-agentic-admin' ),
			'description'         => __( 'Delete old post revisions to reduce database size.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'keep_last' => array(
						'type'        => 'integer',
						'description' => __( 'Number of revisions to keep per post. Set to 0 to delete all revisions.', 'wp-agentic-admin' ),
						'default'     => 3,
						'minimum'     => 0,
						'maximum'     => 100,
					),
					'dry_run'   => array(
						'type'        => 'boolean',
						'description' => __( 'If true, only report what would be deleted without actually deleting.', 'wp-agentic-admin' ),
						'default'     => false,
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'         => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the operation was successful.', 'wp-agentic-admin' ),
					),
					'message'         => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'deleted_count'   => array(
						'type'        => 'integer',
						'description' => __( 'Number of revisions deleted.', 'wp-agentic-admin' ),
					),
					'total_revisions' => array(
						'type'        => 'integer',
						'description' => __( 'Total revisions before cleanup.', 'wp-agentic-admin' ),
					),
					'kept_count'      => array(
						'type'        => 'integer',
						'description' => __( 'Number of revisions kept.', 'wp-agentic-admin' ),
					),
					'dry_run'         => array(
						'type'        => 'boolean',
						'description' => __( 'Whether this was a dry run.', 'wp-agentic-admin' ),
					),
					'space_saved'     => array(
						'type'        => 'string',
						'description' => __( 'Estimated space saved.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_revision_cleanup',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => array(
					'readonly'    => false,
					'destructive' => true, // This deletes data.
					'idempotent'  => false,
				),
			),
		),
		// JS configuration for chat interface.
		array(
			'keywords'       => array( 'revision', 'revisions', 'cleanup', 'clean', 'delete', 'post', 'database', 'bloat', 'space' ),
			'initialMessage' => __( 'Analyzing post revisions...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the revision-cleanup ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_revision_cleanup( array $input = array() ): array {
	global $wpdb;

	$keep_last = isset( $input['keep_last'] ) ? absint( $input['keep_last'] ) : 3;
	$dry_run   = isset( $input['dry_run'] ) ? (bool) $input['dry_run'] : false;

	// Get all posts that have revisions.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$posts_with_revisions = $wpdb->get_col(
		"SELECT DISTINCT post_parent FROM {$wpdb->posts} 
		WHERE post_type = 'revision' AND post_parent > 0"
	);

	// Count total revisions.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$total_revisions = (int) $wpdb->get_var(
		"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision'"
	);

	if ( 0 === $total_revisions ) {
		return array(
			'success'         => true,
			'message'         => __( 'No revisions found. Your database is already clean!', 'wp-agentic-admin' ),
			'deleted_count'   => 0,
			'total_revisions' => 0,
			'kept_count'      => 0,
			'dry_run'         => $dry_run,
			'space_saved'     => '0 B',
		);
	}

	$revisions_to_delete = array();
	$space_estimate      = 0;

	foreach ( $posts_with_revisions as $post_id ) {
		// Get revisions for this post, ordered by date (newest first).
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$revisions = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ID, post_content FROM {$wpdb->posts} 
				WHERE post_type = 'revision' AND post_parent = %d 
				ORDER BY post_date DESC",
				$post_id
			)
		);

		// Skip the first N revisions (keep_last), mark rest for deletion.
		$count = 0;
		foreach ( $revisions as $revision ) {
			++$count;
			if ( $count > $keep_last ) {
				$revisions_to_delete[] = $revision->ID;
				// Estimate space: rough approximation based on content length.
				$space_estimate += strlen( $revision->post_content );
			}
		}
	}

	$delete_count = count( $revisions_to_delete );
	$kept_count   = $total_revisions - $delete_count;

	if ( 0 === $delete_count ) {
		$message = sprintf(
			/* translators: 1: total revisions, 2: keep_last setting */
			__( 'Found %1$d revisions. All posts have %2$d or fewer revisions, nothing to delete.', 'wp-agentic-admin' ),
			$total_revisions,
			$keep_last
		);

		return array(
			'success'         => true,
			'message'         => $message,
			'deleted_count'   => 0,
			'total_revisions' => $total_revisions,
			'kept_count'      => $total_revisions,
			'dry_run'         => $dry_run,
			'space_saved'     => '0 B',
		);
	}

	// Format space saved.
	$space_saved = size_format( $space_estimate );

	if ( $dry_run ) {
		$message = sprintf(
			/* translators: 1: delete count, 2: total revisions, 3: space saved */
			__( 'Dry run: Would delete %1$d of %2$d revisions (estimated %3$s). Run without dry_run to actually delete.', 'wp-agentic-admin' ),
			$delete_count,
			$total_revisions,
			$space_saved
		);
	} else {
		// Actually delete the revisions.
		$deleted = 0;
		foreach ( $revisions_to_delete as $revision_id ) {
			// wp_delete_post_revision returns the revision object or false/null.
			$result = wp_delete_post_revision( $revision_id );
			if ( $result ) {
				++$deleted;
			}
		}

		$message = sprintf(
			/* translators: 1: deleted count, 2: total revisions, 3: kept count, 4: space saved */
			__( 'Deleted %1$d revisions. Kept %3$d most recent revisions per post. Estimated space saved: %4$s.', 'wp-agentic-admin' ),
			$deleted,
			$total_revisions,
			$kept_count,
			$space_saved
		);

		$delete_count = $deleted;
	}

	return array(
		'success'         => true,
		'message'         => $message,
		'deleted_count'   => $delete_count,
		'total_revisions' => $total_revisions,
		'kept_count'      => $kept_count,
		'dry_run'         => $dry_run,
		'space_saved'     => $space_saved,
	);
}
