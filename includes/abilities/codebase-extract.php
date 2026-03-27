<?php
/**
 * Codebase Extract Ability
 *
 * Extracts code chunks from the active theme and plugins for local RAG indexing.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the codebase-extract ability.
 *
 * @return void
 */
function wp_agentic_admin_register_codebase_extract(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/codebase-extract',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Extract Codebase', 'wp-agentic-admin' ),
			'description'         => __( 'Extract code chunks from active theme and plugins for indexing.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(
					'offset' => 0,
					'limit'  => 50,
				),
				'properties'           => array(
					'offset' => array(
						'type'        => 'integer',
						'default'     => 0,
						'description' => __( 'File offset for pagination.', 'wp-agentic-admin' ),
					),
					'limit'  => array(
						'type'        => 'integer',
						'default'     => 50,
						'description' => __( 'Max files per page.', 'wp-agentic-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'chunks'      => array(
						'type'        => 'array',
						'description' => __( 'Code chunks with path, line range, and content.', 'wp-agentic-admin' ),
					),
					'total_files' => array(
						'type'        => 'integer',
						'description' => __( 'Total number of scannable files.', 'wp-agentic-admin' ),
					),
					'has_more'    => array(
						'type'        => 'boolean',
						'description' => __( 'Whether more pages are available.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_codebase_extract',
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
			'keywords'       => array( 'extract', 'codebase', 'code', 'source' ),
			'initialMessage' => __( 'Extracting code from your site...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Collect all scannable files from active theme and plugins.
 *
 * @return string[] Array of absolute file paths.
 */
function wp_agentic_admin_collect_code_files(): array {
	$files = array();

	// Skip directories.
	$skip_dirs = array( 'node_modules', 'vendor', 'build', 'dist', '.git', 'tests', 'test' );

	// Skip file patterns.
	$skip_patterns = array( '.min.js', '.min.css', '.map', '.lock' );

	// Allowed extensions.
	$extensions = array( 'php', 'js' );

	// Max file size: 100KB.
	$max_size = 100 * 1024;

	// 1. Active theme.
	$theme_dir = get_stylesheet_directory();
	if ( is_dir( $theme_dir ) ) {
		$files = array_merge(
			$files,
			wp_agentic_admin_scan_directory( $theme_dir, $extensions, $skip_dirs, $skip_patterns, $max_size )
		);
	}

	// 2. Active plugins (exclude wp-agentic-admin itself).
	$active_plugins = get_option( 'active_plugins', array() );
	$plugins_dir    = WP_PLUGIN_DIR;

	foreach ( $active_plugins as $plugin_file ) {
		$plugin_slug = dirname( $plugin_file );

		// Skip single-file plugins (no directory).
		if ( '.' === $plugin_slug ) {
			// Include the single file directly.
			$single_file = $plugins_dir . '/' . $plugin_file;
			if ( file_exists( $single_file ) && filesize( $single_file ) <= $max_size ) {
				$files[] = $single_file;
			}
			continue;
		}

		// Skip ourselves.
		if ( 'wp-agentic-admin' === $plugin_slug ) {
			continue;
		}

		$plugin_dir = $plugins_dir . '/' . $plugin_slug;
		if ( is_dir( $plugin_dir ) ) {
			$files = array_merge(
				$files,
				wp_agentic_admin_scan_directory( $plugin_dir, $extensions, $skip_dirs, $skip_patterns, $max_size )
			);
		}
	}

	sort( $files );
	return $files;
}

/**
 * Recursively scan a directory for code files.
 *
 * @param string   $dir           Directory to scan.
 * @param string[] $extensions    Allowed file extensions.
 * @param string[] $skip_dirs     Directory names to skip.
 * @param string[] $skip_patterns File name patterns to skip.
 * @param int      $max_size      Maximum file size in bytes.
 * @param int      $depth         Current recursion depth.
 * @return string[] Array of file paths.
 */
function wp_agentic_admin_scan_directory(
	string $dir,
	array $extensions,
	array $skip_dirs,
	array $skip_patterns,
	int $max_size,
	int $depth = 0
): array {
	$files = array();

	if ( $depth > 8 || ! is_dir( $dir ) || ! is_readable( $dir ) ) {
		return $files;
	}

	$iterator = new DirectoryIterator( $dir );

	foreach ( $iterator as $item ) {
		if ( $item->isDot() ) {
			continue;
		}

		$name = $item->getFilename();

		if ( $item->isDir() ) {
			if ( in_array( $name, $skip_dirs, true ) ) {
				continue;
			}
			$files = array_merge(
				$files,
				wp_agentic_admin_scan_directory(
					$item->getPathname(),
					$extensions,
					$skip_dirs,
					$skip_patterns,
					$max_size,
					$depth + 1
				)
			);
			continue;
		}

		if ( ! $item->isFile() ) {
			continue;
		}

		// Check extension.
		$ext = strtolower( $item->getExtension() );
		if ( ! in_array( $ext, $extensions, true ) ) {
			continue;
		}

		// Check skip patterns.
		$skip = false;
		foreach ( $skip_patterns as $pattern ) {
			if ( str_ends_with( $name, $pattern ) ) {
				$skip = true;
				break;
			}
		}
		if ( $skip ) {
			continue;
		}

		// Check size.
		if ( $item->getSize() > $max_size ) {
			continue;
		}

		$files[] = $item->getPathname();
	}

	return $files;
}

/**
 * Chunk a file's content by function/class boundaries.
 *
 * @param string $file_path Absolute path to the file.
 * @param string $base_path Base path to strip for relative paths.
 * @return array Array of chunk arrays with path, start_line, end_line, content, type.
 */
function wp_agentic_admin_chunk_file( string $file_path, string $base_path ): array {
	global $wp_filesystem;
	if ( ! $wp_filesystem ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
	}
	$content = $wp_filesystem->get_contents( $file_path );
	if ( false === $content ) {
		return array();
	}

	$relative_path = str_replace( $base_path, '', $file_path );
	$relative_path = ltrim( $relative_path, '/' );
	$lines         = explode( "\n", $content );
	$total_lines   = count( $lines );

	// For small files (< 50 lines), return as a single chunk.
	if ( $total_lines < 50 ) {
		return array(
			array(
				'path'       => $relative_path,
				'start_line' => 1,
				'end_line'   => $total_lines,
				'content'    => $content,
				'type'       => 'file',
			),
		);
	}

	$ext    = strtolower( pathinfo( $file_path, PATHINFO_EXTENSION ) );
	$chunks = array();

	if ( 'php' === $ext ) {
		$chunks = wp_agentic_admin_chunk_php( $lines, $relative_path );
	} elseif ( 'js' === $ext ) {
		$chunks = wp_agentic_admin_chunk_js( $lines, $relative_path );
	}

	// Fallback: if no chunks found, split into ~40-line blocks.
	if ( empty( $chunks ) ) {
		$chunks = wp_agentic_admin_chunk_by_lines( $lines, $relative_path, 40 );
	}

	return $chunks;
}

/**
 * Chunk PHP code by function/class boundaries.
 *
 * @param string[] $lines         Array of lines.
 * @param string   $relative_path Relative file path.
 * @return array Array of chunks.
 */
function wp_agentic_admin_chunk_php( array $lines, string $relative_path ): array {
	$chunks        = array();
	$current_start = 0;
	$brace_depth   = 0;
	$in_block      = false;
	$block_type    = 'code';
	$line_count    = count( $lines );

	for ( $i = 0; $i < $line_count; $i++ ) {
		$line    = $lines[ $i ];
		$trimmed = trim( $line );

		// Detect function/class/interface/trait start.
		if ( ! $in_block && preg_match( '/^(abstract\s+)?(class|interface|trait|function)\s+/i', $trimmed ) ) {
			// Save preceding code as a chunk if significant.
			if ( $i - $current_start > 2 ) {
				$chunk_lines = array_slice( $lines, $current_start, $i - $current_start );
				$chunk_text  = implode( "\n", $chunk_lines );
				if ( strlen( trim( $chunk_text ) ) > 20 ) {
					$chunks[] = array(
						'path'       => $relative_path,
						'start_line' => $current_start + 1,
						'end_line'   => $i,
						'content'    => $chunk_text,
						'type'       => 'code',
					);
				}
			}
			$current_start = $i;
			$in_block      = true;
			$brace_depth   = 0;

			if ( preg_match( '/^(abstract\s+)?(class|interface|trait)\s+/i', $trimmed ) ) {
				$block_type = 'class';
			} else {
				$block_type = 'function';
			}
		}

		// Track brace depth.
		$brace_depth += substr_count( $line, '{' );
		$brace_depth -= substr_count( $line, '}' );

		// End of block: braces balanced back to 0.
		if ( $in_block && $brace_depth <= 0 && strpos( $line, '}' ) !== false ) {
			$chunk_lines   = array_slice( $lines, $current_start, $i - $current_start + 1 );
			$chunks[]      = array(
				'path'       => $relative_path,
				'start_line' => $current_start + 1,
				'end_line'   => $i + 1,
				'content'    => implode( "\n", $chunk_lines ),
				'type'       => $block_type,
			);
			$current_start = $i + 1;
			$in_block      = false;
			$brace_depth   = 0;
		}
	}

	// Remaining lines.
	if ( $current_start < $line_count ) {
		$chunk_lines = array_slice( $lines, $current_start );
		$chunk_text  = implode( "\n", $chunk_lines );
		if ( strlen( trim( $chunk_text ) ) > 20 ) {
			$chunks[] = array(
				'path'       => $relative_path,
				'start_line' => $current_start + 1,
				'end_line'   => $line_count,
				'content'    => $chunk_text,
				'type'       => 'code',
			);
		}
	}

	return $chunks;
}

/**
 * Chunk JavaScript code by function/class/export boundaries.
 *
 * @param string[] $lines         Array of lines.
 * @param string   $relative_path Relative file path.
 * @return array Array of chunks.
 */
function wp_agentic_admin_chunk_js( array $lines, string $relative_path ): array {
	$chunks        = array();
	$current_start = 0;
	$brace_depth   = 0;
	$in_block      = false;
	$block_type    = 'code';
	$line_count    = count( $lines );

	for ( $i = 0; $i < $line_count; $i++ ) {
		$line    = $lines[ $i ];
		$trimmed = trim( $line );

		// Detect function/class/export start.
		if ( ! $in_block && preg_match( '/^(export\s+)?(default\s+)?(async\s+)?(function|class|const|let|var)\s+/i', $trimmed ) ) {
			// Save preceding code as a chunk if significant.
			if ( $i - $current_start > 2 ) {
				$chunk_lines = array_slice( $lines, $current_start, $i - $current_start );
				$chunk_text  = implode( "\n", $chunk_lines );
				if ( strlen( trim( $chunk_text ) ) > 20 ) {
					$chunks[] = array(
						'path'       => $relative_path,
						'start_line' => $current_start + 1,
						'end_line'   => $i,
						'content'    => $chunk_text,
						'type'       => 'code',
					);
				}
			}
			$current_start = $i;
			$in_block      = true;
			$brace_depth   = 0;

			if ( preg_match( '/class\s+/i', $trimmed ) ) {
				$block_type = 'class';
			} else {
				$block_type = 'function';
			}
		}

		// Track brace depth.
		$brace_depth += substr_count( $line, '{' );
		$brace_depth -= substr_count( $line, '}' );

		// End of block: braces balanced back to 0.
		if ( $in_block && $brace_depth <= 0 && strpos( $line, '}' ) !== false ) {
			$chunk_lines   = array_slice( $lines, $current_start, $i - $current_start + 1 );
			$chunks[]      = array(
				'path'       => $relative_path,
				'start_line' => $current_start + 1,
				'end_line'   => $i + 1,
				'content'    => implode( "\n", $chunk_lines ),
				'type'       => $block_type,
			);
			$current_start = $i + 1;
			$in_block      = false;
			$brace_depth   = 0;
		}
	}

	// Remaining lines.
	if ( $current_start < $line_count ) {
		$chunk_lines = array_slice( $lines, $current_start );
		$chunk_text  = implode( "\n", $chunk_lines );
		if ( strlen( trim( $chunk_text ) ) > 20 ) {
			$chunks[] = array(
				'path'       => $relative_path,
				'start_line' => $current_start + 1,
				'end_line'   => $line_count,
				'content'    => $chunk_text,
				'type'       => 'code',
			);
		}
	}

	return $chunks;
}

/**
 * Chunk content into fixed-size line blocks.
 *
 * @param string[] $lines         Array of lines.
 * @param string   $relative_path Relative file path.
 * @param int      $block_size    Lines per block.
 * @return array Array of chunks.
 */
function wp_agentic_admin_chunk_by_lines( array $lines, string $relative_path, int $block_size = 40 ): array {
	$chunks = array();
	$total  = count( $lines );

	for ( $i = 0; $i < $total; $i += $block_size ) {
		$chunk_lines = array_slice( $lines, $i, $block_size );
		$chunk_text  = implode( "\n", $chunk_lines );

		if ( strlen( trim( $chunk_text ) ) > 20 ) {
			$chunks[] = array(
				'path'       => $relative_path,
				'start_line' => $i + 1,
				'end_line'   => min( $i + $block_size, $total ),
				'content'    => $chunk_text,
				'type'       => 'block',
			);
		}
	}

	return $chunks;
}

/**
 * Execute the codebase-extract ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_codebase_extract( array $input = array() ): array {
	$offset = isset( $input['offset'] ) ? max( 0, absint( $input['offset'] ) ) : 0;
	$limit  = isset( $input['limit'] ) ? min( absint( $input['limit'] ), 100 ) : 50;

	$all_files   = wp_agentic_admin_collect_code_files();
	$total_files = count( $all_files );

	// Paginate files.
	$page_files = array_slice( $all_files, $offset, $limit );
	$has_more   = ( $offset + $limit ) < $total_files;

	// Determine base path for relative paths.
	$wp_content_dir = WP_CONTENT_DIR;

	$chunks = array();

	foreach ( $page_files as $file_path ) {
		$file_chunks = wp_agentic_admin_chunk_file( $file_path, $wp_content_dir );
		foreach ( $file_chunks as $chunk ) {
			$chunks[] = $chunk;
		}
	}

	return array(
		'chunks'      => $chunks,
		'total_files' => $total_files,
		'files_page'  => count( $page_files ),
		'offset'      => $offset,
		'has_more'    => $has_more,
	);
}
