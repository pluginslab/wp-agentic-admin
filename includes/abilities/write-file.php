<?php
/**
 * Write File Ability
 *
 * Edits WordPress files with backup and confirmation.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the write-file ability.
 *
 * @return void
 */
function wp_agentic_admin_register_write_file(): void {
	register_agentic_ability(
		'wp-agentic-admin/write-file',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Write File', 'wp-agentic-admin' ),
			'description'         => __( 'Edit WordPress files with automatic backup.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(
					'file_path' => '',
					'content'   => '',
					'mode'      => 'replace',
				),
				'properties'           => array(
					'file_path' => array(
						'type'        => 'string',
						'description' => __( 'File path relative to WordPress root.', 'wp-agentic-admin' ),
					),
					'content'   => array(
						'type'        => 'string',
						'description' => __( 'Content to write.', 'wp-agentic-admin' ),
					),
					'mode'      => array(
						'type'        => 'string',
						'enum'        => array( 'replace', 'append', 'prepend' ),
						'default'     => 'replace',
						'description' => __( 'Write mode: replace, append, or prepend.', 'wp-agentic-admin' ),
					),
				),
				'required'             => array( 'file_path', 'content' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the write succeeded.', 'wp-agentic-admin' ),
					),
					'message' => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'backup'  => array(
						'type'        => 'string',
						'description' => __( 'Backup file path.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_write_file',
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
		// JS configuration for chat interface.
		array(
			'keywords'       => array( 'write', 'edit', 'modify', 'change', 'fix', 'add line', 'add code', 'enable debug', 'update file', 'functions.php', 'wp-config', '.htaccess' ),
			'initialMessage' => __( "I'll edit that file...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the write-file ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_write_file( array $input = array() ): array {
	$file_path = isset( $input['file_path'] ) ? sanitize_text_field( $input['file_path'] ) : '';
	$content   = isset( $input['content'] ) ? $input['content'] : '';
	$mode      = isset( $input['mode'] ) ? sanitize_text_field( $input['mode'] ) : 'replace';

	if ( empty( $file_path ) || '' === $content ) {
		return array(
			'success' => false,
			'message' => 'File path and content are required.',
		);
	}

	// Resolve to absolute path.
	$abs_path = realpath( ABSPATH . ltrim( $file_path, '/' ) );

	// For new files, check parent directory.
	if ( false === $abs_path ) {
		$parent = realpath( dirname( ABSPATH . ltrim( $file_path, '/' ) ) );
		if ( false === $parent || 0 !== strpos( $parent, realpath( ABSPATH ) ) ) {
			return array(
				'success' => false,
				'message' => 'File path is outside the WordPress directory.',
			);
		}
		$abs_path = $parent . '/' . basename( $file_path );
	} elseif ( 0 !== strpos( $abs_path, realpath( ABSPATH ) ) ) {
		return array(
			'success' => false,
			'message' => 'File path is outside the WordPress directory.',
		);
	}

	// Create backup if file exists.
	$backup_path = '';
	if ( file_exists( $abs_path ) ) {
		$backup_path = $abs_path . '.bak.' . time();
		if ( ! copy( $abs_path, $backup_path ) ) {
			return array(
				'success' => false,
				'message' => 'Failed to create backup.',
			);
		}
	}

	// Apply content based on mode.
	$existing = file_exists( $abs_path ) ? file_get_contents( $abs_path ) : '';

	switch ( $mode ) {
		case 'append':
			$final = $existing . "\n" . $content;
			break;
		case 'prepend':
			$final = $content . "\n" . $existing;
			break;
		default:
			$final = $content;
	}

	// Write the file.
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	$result = file_put_contents( $abs_path, $final );

	if ( false === $result ) {
		return array(
			'success' => false,
			'message' => 'Failed to write file.',
			'backup'  => $backup_path,
		);
	}

	return array(
		'success' => true,
		'message' => sprintf( 'File %s successfully (%s mode).', $file_path, $mode ),
		'backup'  => $backup_path ? str_replace( realpath( ABSPATH ), '', $backup_path ) : '',
	);
}
