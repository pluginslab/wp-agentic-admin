<?php
/**
 * Disk Usage Ability
 *
 * Checks wp-content disk usage breakdown.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the disk-usage ability.
 *
 * @return void
 */
function wp_agentic_admin_register_disk_usage(): void {
	register_agentic_ability(
		'wp-agentic-admin/disk-usage',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Check Disk Usage', 'wp-agentic-admin' ),
			'description'         => __( 'Check wp-content disk usage for uploads, plugins, and themes.', 'wp-agentic-admin' ),
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
					'directories' => array(
						'type'        => 'array',
						'description' => __( 'Size breakdown by directory.', 'wp-agentic-admin' ),
					),
					'total'       => array(
						'type'        => 'string',
						'description' => __( 'Total wp-content size.', 'wp-agentic-admin' ),
					),
					'total_bytes' => array(
						'type'        => 'integer',
						'description' => __( 'Total size in bytes.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_disk_usage',
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
			'keywords'       => array( 'disk', 'storage', 'space', 'size', 'usage' ),
			'initialMessage' => __( "I'll check your disk usage...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Calculate directory size with depth limit.
 *
 * @param string $dir   Directory path.
 * @param int    $depth Max recursion depth.
 * @return int Size in bytes.
 */
function wp_agentic_admin_dir_size( string $dir, int $depth = 10 ): int {
	$size = 0;

	if ( $depth < 0 || ! is_dir( $dir ) || ! is_readable( $dir ) ) {
		return $size;
	}

	$iterator = new DirectoryIterator( $dir );

	foreach ( $iterator as $item ) {
		if ( $item->isDot() ) {
			continue;
		}

		if ( $item->isFile() ) {
			$size += $item->getSize();
		} elseif ( $item->isDir() ) {
			$size += wp_agentic_admin_dir_size( $item->getPathname(), $depth - 1 );
		}
	}

	return $size;
}

/**
 * Format bytes into human-readable string.
 *
 * @param int $bytes Byte count.
 * @return string Formatted size.
 */
function wp_agentic_admin_format_bytes( int $bytes ): string {
	$units = array( 'B', 'KB', 'MB', 'GB' );
	$i     = 0;
	$size  = (float) $bytes;

	while ( $size >= 1024 && $i < count( $units ) - 1 ) {
		$size /= 1024;
		++$i;
	}

	return round( $size, 2 ) . ' ' . $units[ $i ];
}

/**
 * Execute the disk-usage ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_disk_usage( array $input = array() ): array {
	$wp_content = WP_CONTENT_DIR;
	$dirs       = array(
		'uploads' => $wp_content . '/uploads',
		'plugins' => $wp_content . '/plugins',
		'themes'  => $wp_content . '/themes',
		'cache'   => $wp_content . '/cache',
	);

	$directories = array();
	$total_bytes = 0;

	foreach ( $dirs as $name => $path ) {
		if ( is_dir( $path ) ) {
			$size          = wp_agentic_admin_dir_size( $path );
			$total_bytes  += $size;
			$directories[] = array(
				'name'  => $name,
				'path'  => $path,
				'bytes' => $size,
				'size'  => wp_agentic_admin_format_bytes( $size ),
			);
		}
	}

	return array(
		'directories' => $directories,
		'total'       => wp_agentic_admin_format_bytes( $total_bytes ),
		'total_bytes' => $total_bytes,
	);
}
