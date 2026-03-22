<?php
/**
 * WP API Extract Ability
 *
 * Extracts WordPress core function signatures and docblocks from wp-includes/
 * for local RAG knowledge base indexing. Only captures signatures and docs,
 * not function bodies, to keep chunk count manageable.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the wp-api-extract ability.
 *
 * @return void
 */
function wp_agentic_admin_register_wp_api_extract(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/wp-api-extract',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Extract WP API Signatures', 'wp-agentic-admin' ),
			'description'         => __( 'Extract WordPress core function signatures and docblocks for knowledge base indexing.', 'wp-agentic-admin' ),
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
					'chunks'      => array(
						'type'        => 'array',
						'description' => __( 'API signature chunks.', 'wp-agentic-admin' ),
					),
					'total_files' => array(
						'type'        => 'integer',
						'description' => __( 'Total files scanned.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_wp_api_extract',
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
			'keywords'       => array( 'wp api', 'wordpress functions', 'core api', 'extract api' ),
			'initialMessage' => __( 'Extracting WordPress API signatures...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Collect PHP files from wp-includes/ (skipping non-PHP subdirectories).
 *
 * @return string[] Array of absolute file paths.
 */
function wp_agentic_admin_collect_wp_includes_files(): array {
	$wp_includes = ABSPATH . 'wp-includes/';

	if ( ! is_dir( $wp_includes ) ) {
		return array();
	}

	// Skip directories that don't contain PHP API functions.
	$skip_dirs = array( 'blocks', 'js', 'css', 'fonts', 'images', 'ID3', 'sodium_compat', 'Requests', 'SimplePie', 'Text' );

	$files    = array();
	$iterator = new DirectoryIterator( $wp_includes );

	foreach ( $iterator as $item ) {
		if ( $item->isDot() ) {
			continue;
		}

		// Skip subdirectories (only scan top-level wp-includes/ PHP files).
		if ( $item->isDir() ) {
			$name = $item->getFilename();

			if ( in_array( $name, $skip_dirs, true ) ) {
				continue;
			}

			// Scan specific subdirectories that have useful API functions.
			$sub_files = wp_agentic_admin_scan_wp_includes_subdir( $item->getPathname() );
			$files     = array_merge( $files, $sub_files );
			continue;
		}

		if ( ! $item->isFile() ) {
			continue;
		}

		// Only PHP files.
		if ( 'php' !== strtolower( $item->getExtension() ) ) {
			continue;
		}

		// Skip very large files (> 200KB).
		if ( $item->getSize() > 200 * 1024 ) {
			continue;
		}

		$files[] = $item->getPathname();
	}

	sort( $files );
	return $files;
}

/**
 * Scan a wp-includes subdirectory for PHP files (non-recursive).
 *
 * @param string $dir Directory path.
 * @return string[] Array of file paths.
 */
function wp_agentic_admin_scan_wp_includes_subdir( string $dir ): array {
	$files    = array();
	$iterator = new DirectoryIterator( $dir );

	foreach ( $iterator as $item ) {
		if ( $item->isDot() || ! $item->isFile() ) {
			continue;
		}

		if ( 'php' !== strtolower( $item->getExtension() ) ) {
			continue;
		}

		if ( $item->getSize() > 200 * 1024 ) {
			continue;
		}

		$files[] = $item->getPathname();
	}

	return $files;
}

/**
 * Extract function signatures and docblocks from a PHP file.
 *
 * Captures docblock + function signature line only (not the body).
 * Groups ~5 related functions per chunk.
 *
 * @param string $file_path    Absolute path to the PHP file.
 * @param string $relative_path Relative path for chunk identification.
 * @return array Array of signature entries.
 */
function wp_agentic_admin_extract_signatures( string $file_path, string $relative_path ): array {
	global $wp_filesystem;

	if ( ! $wp_filesystem ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
	}

	$content = $wp_filesystem->get_contents( $file_path );

	if ( false === $content ) {
		return array();
	}

	$signatures = array();

	// Match docblock + function signature (not body).
	// Pattern: optional /** ... */ followed by function declaration.
	$pattern = '/
		(\/\*\*[\s\S]*?\*\/\s*)?    # Optional docblock
		^[ \t]*(?:(?:abstract|static|final|public|protected|private)\s+)*  # Optional modifiers
		function\s+(\w+)\s*         # Function name
		\(([^)]*)\)                 # Parameters
	/mx';

	if ( preg_match_all( $pattern, $content, $matches, PREG_SET_ORDER ) ) {
		foreach ( $matches as $match ) {
			$docblock  = isset( $match[1] ) ? trim( $match[1] ) : '';
			$func_name = $match[2];
			$params    = trim( $match[3] );

			// Skip internal/private functions (prefixed with _).
			if ( str_starts_with( $func_name, '__' ) && 'construct' !== substr( $func_name, 2 ) ) {
				continue;
			}

			// Build concise signature.
			$sig = "function {$func_name}( {$params} )";

			$entry = '';
			if ( $docblock ) {
				// Trim docblock to description + @param + @return only.
				$entry = wp_agentic_admin_trim_docblock( $docblock ) . "\n";
			}
			$entry .= $sig;

			$signatures[] = $entry;
		}
	}

	return $signatures;
}

/**
 * Trim a docblock to keep only description, @param, and @return lines.
 *
 * @param string $docblock Full docblock string.
 * @return string Trimmed docblock.
 */
function wp_agentic_admin_trim_docblock( string $docblock ): string {
	$lines   = explode( "\n", $docblock );
	$kept    = array();
	$keeping = true;

	foreach ( $lines as $line ) {
		$trimmed = trim( $line, " \t*/" );

		// Keep the opening.
		if ( str_starts_with( trim( $line ), '/**' ) ) {
			$kept[] = '/**';
			continue;
		}

		// Keep description lines (before first @tag).
		if ( $keeping && ! str_starts_with( $trimmed, '@' ) ) {
			if ( '' !== $trimmed ) {
				$kept[] = ' * ' . $trimmed;
			}
			continue;
		}

		// Once we hit tags, only keep @param, @return, @since.
		if ( str_starts_with( $trimmed, '@' ) ) {
			$keeping = false;
			if ( preg_match( '/^@(param|return|since)\b/', $trimmed ) ) {
				$kept[] = ' * ' . $trimmed;
			}
		}
	}

	$kept[] = ' */';
	return implode( "\n", $kept );
}

/**
 * Execute the wp-api-extract ability.
 *
 * @param array $input Input parameters (unused).
 * @return array
 */
function wp_agentic_admin_execute_wp_api_extract( array $input = array() ): array {
	$files       = wp_agentic_admin_collect_wp_includes_files();
	$total_files = count( $files );
	$chunks      = array();
	$wp_includes = ABSPATH . 'wp-includes/';

	foreach ( $files as $file_path ) {
		$relative_path = str_replace( $wp_includes, '', $file_path );
		$signatures    = wp_agentic_admin_extract_signatures( $file_path, $relative_path );

		if ( empty( $signatures ) ) {
			continue;
		}

		// Group ~5 signatures per chunk.
		$groups = array_chunk( $signatures, 5 );

		foreach ( $groups as $group_idx => $group ) {
			$chunks[] = array(
				'path'       => 'wp-api://' . $relative_path,
				'start_line' => $group_idx * 5 + 1,
				'end_line'   => $group_idx * 5 + count( $group ),
				'content'    => implode( "\n\n", $group ),
				'type'       => 'api',
			);
		}
	}

	return array(
		'success'      => true,
		'chunks'       => $chunks,
		'total_files'  => $total_files,
	);
}
