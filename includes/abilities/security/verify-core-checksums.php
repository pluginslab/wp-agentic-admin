<?php
/**
 * Verify Core Checksums Ability
 *
 * Verifies WordPress core file checksums against the official API
 * and reports any mismatches or missing files with diffs.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the verify-core-checksums ability.
 *
 * @return void
 */
function wp_agentic_admin_register_verify_core_checksums(): void {
	register_agentic_ability(
		'wp-agentic-admin/verify-core-checksums',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Verify Core Checksums', 'wp-agentic-admin' ),
			'description'         => __( 'Verify WordPress core file checksums against the official API and show diffs for modified files.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(),
				'properties'           => array(
					'include_diffs' => array(
						'type'        => 'boolean',
						'description' => __( 'Include diffs for modified files by fetching originals from WordPress.org.', 'wp-agentic-admin' ),
						'default'     => true,
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'           => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the checksum verification completed.', 'wp-agentic-admin' ),
					),
					'message'           => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'wordpress_version' => array(
						'type'        => 'string',
						'description' => __( 'WordPress version checked.', 'wp-agentic-admin' ),
					),
					'total_files'       => array(
						'type'        => 'integer',
						'description' => __( 'Total core files checked.', 'wp-agentic-admin' ),
					),
					'failed_count'      => array(
						'type'        => 'integer',
						'description' => __( 'Number of files with checksum mismatches.', 'wp-agentic-admin' ),
					),
					'missing_count'     => array(
						'type'        => 'integer',
						'description' => __( 'Number of missing core files.', 'wp-agentic-admin' ),
					),
					'extra_count'       => array(
						'type'        => 'integer',
						'description' => __( 'Number of unknown files found in core directories.', 'wp-agentic-admin' ),
					),
					'failed_files'      => array(
						'type'        => 'array',
						'description' => __( 'List of files that failed verification.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_verify_core_checksums',
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
			'keywords'       => array( 'checksum', 'verify', 'integrity', 'hacked', 'compromised', 'modified', 'core', 'security', 'malware', 'tampered', 'changed files' ),
			'initialMessage' => __( 'Verifying WordPress core file checksums...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the verify-checksum ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_verify_core_checksums( array $input = array() ): array {
	$include_diffs = isset( $input['include_diffs'] ) ? (bool) $input['include_diffs'] : true;
	$wp_version    = get_bloginfo( 'version' );
	$locale        = get_locale();

	// Use WordPress core's get_core_checksums() — same function WP-CLI uses.
	if ( ! function_exists( 'get_core_checksums' ) ) {
		require_once ABSPATH . 'wp-admin/includes/update.php';
	}

	$checksums = get_core_checksums( $wp_version, $locale );

	if ( false === $checksums ) {
		return array(
			'success'           => false,
			'message'           => sprintf(
				/* translators: %s: WordPress version */
				__( 'Could not retrieve checksums for WordPress %s.', 'wp-agentic-admin' ),
				$wp_version
			),
			'wordpress_version' => $wp_version,
			'total_files'       => 0,
			'failed_count'      => 0,
			'missing_count'     => 0,
			'extra_count'       => 0,
			'failed_files'      => array(),
		);
	}

	$failed_files  = array();
	$missing_count = 0;
	$extra_count   = 0;
	$total_files   = count( $checksums );

	// Build a set of known core files for extra-file detection.
	$known_files = array();

	// Derive the content directory prefix relative to ABSPATH.
	// WP_CONTENT_DIR is the absolute path (e.g., /var/www/html/wp-content or /var/www/html/content).
	// We need the relative prefix to match against checksums entries.
	$content_dir_prefix = trailingslashit( substr( WP_CONTENT_DIR, strlen( ABSPATH ) ) );

	foreach ( $checksums as $file => $expected_md5 ) {
		// Skip content directory files — those are user-managed.
		if ( str_starts_with( $file, $content_dir_prefix ) ) {
			--$total_files;
			continue;
		}

		$known_files[ $file ] = true;
		$file_path            = ABSPATH . $file;

		if ( ! file_exists( $file_path ) ) {
			++$missing_count;
			$failed_files[] = array(
				'file'   => $file,
				'status' => 'missing',
				'detail' => __( 'File does not exist but is expected in WordPress core.', 'wp-agentic-admin' ),
			);
			continue;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading local core files for checksum.
		$actual_md5 = md5_file( $file_path );

		if ( $actual_md5 !== $expected_md5 ) {
			$entry = array(
				'file'         => $file,
				'status'       => 'modified',
				'expected_md5' => $expected_md5,
				'actual_md5'   => $actual_md5,
			);

			if ( $include_diffs ) {
				$diff = wp_agentic_admin_get_core_file_diff( $file, $wp_version, $file_path );
				if ( null !== $diff ) {
					$entry['diff'] = $diff;
				}
			}

			$failed_files[] = $entry;
		}
	}

	// Scan for extra/unknown files, matching WP-CLI's core verify-checksums behavior:
	// 1. Recursively scan wp-admin/ and wp-includes/.
	// 2. Check root-level wp-* files (excluding wp-config.php).
	$extra_files = wp_agentic_admin_find_extra_core_files( $known_files );

	foreach ( $extra_files as $extra_file ) {
		++$extra_count;
		$failed_files[] = array(
			'file'   => $extra_file,
			'status' => 'extra',
			'detail' => __( 'File is not part of WordPress core and should not be in this directory.', 'wp-agentic-admin' ),
		);
	}

	$failed_count = count( $failed_files );

	if ( 0 === $failed_count ) {
		$message = sprintf(
			/* translators: 1: total files, 2: WordPress version */
			__( 'All %1$d core files passed checksum verification for WordPress %2$s. No extra files detected.', 'wp-agentic-admin' ),
			$total_files,
			$wp_version
		);
	} else {
		$modified_count = $failed_count - $missing_count - $extra_count;
		$parts          = array();
		if ( $modified_count > 0 ) {
			$parts[] = sprintf(
				/* translators: %d: number of modified files */
				_n( '%d modified file', '%d modified files', $modified_count, 'wp-agentic-admin' ),
				$modified_count
			);
		}

		if ( $missing_count > 0 ) {
			$parts[] = sprintf(
				/* translators: %d: number of missing files */
				_n( '%d missing file', '%d missing files', $missing_count, 'wp-agentic-admin' ),
				$missing_count
			);
		}

		if ( $extra_count > 0 ) {
			$parts[] = sprintf(
				/* translators: %d: number of extra files */
				_n( '%d unknown extra file', '%d unknown extra files', $extra_count, 'wp-agentic-admin' ),
				$extra_count
			);
		}

		$message = sprintf(
			/* translators: 1: failure details, 2: total files, 3: WordPress version */
			__( 'Checksum verification found %1$s out of %2$d core files for WordPress %3$s.', 'wp-agentic-admin' ),
			implode( ', ', $parts ),
			$total_files,
			$wp_version
		);
	}

	return array(
		'success'           => 0 === $failed_count,
		'message'           => $message,
		'wordpress_version' => $wp_version,
		'total_files'       => $total_files,
		'failed_count'      => $failed_count,
		'missing_count'     => $missing_count,
		'extra_count'       => $extra_count,
		'failed_files'      => $failed_files,
	);
}

/**
 * Generate a unified diff between the original core file and the local version.
 *
 * Fetches the original file from WordPress.org SVN for the given version
 * and compares it against the local file.
 *
 * @param string $file      Relative file path within WordPress.
 * @param string $version   WordPress version.
 * @param string $file_path Absolute path to the local file.
 * @return string|null Unified diff string, or null on failure.
 */
function wp_agentic_admin_get_core_file_diff( string $file, string $version, string $file_path ): ?string {
	// Fetch the original file from WordPress.org.
	$original_url = sprintf(
		'https://core.svn.wordpress.org/tags/%s/%s',
		$version,
		$file
	);

	$response = wp_remote_get(
		$original_url,
		array( 'timeout' => 10 )
	);

	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return null;
	}

	$original_content = wp_remote_retrieve_body( $response );
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading local core file for diff.
	$local_content = file_get_contents( $file_path );

	if ( false === $local_content ) {
		return null;
	}

	$original_lines = explode( "\n", $original_content );
	$local_lines    = explode( "\n", $local_content );

	$diff = wp_agentic_admin_generate_unified_diff( $original_lines, $local_lines, "a/{$file}", "b/{$file}" );

	return $diff;
}

/**
 * Generate a unified diff between two arrays of lines.
 *
 * Produces output similar to `git diff --unified=3`.
 *
 * @param array  $old_lines Lines from the original file.
 * @param array  $new_lines Lines from the modified file.
 * @param string $old_label Label for the original file (e.g. "a/wp-includes/version.php").
 * @param string $new_label Label for the modified file (e.g. "b/wp-includes/version.php").
 * @return string Unified diff output.
 */
function wp_agentic_admin_generate_unified_diff( array $old_lines, array $new_lines, string $old_label, string $new_label ): string {
	// Use WordPress built-in Text_Diff if available.
	if ( ! class_exists( 'Text_Diff', false ) ) {
		$diff_file = ABSPATH . 'wp-includes/Text/Diff.php';
		if ( file_exists( $diff_file ) ) {
			require_once $diff_file;
		}
	}

	if ( ! class_exists( 'Text_Diff_Renderer_unified', false ) ) {
		$renderer_file = ABSPATH . 'wp-includes/Text/Diff/Renderer/unified.php';
		if ( file_exists( $renderer_file ) ) {
			require_once $renderer_file;
		}
	}

	if ( class_exists( 'Text_Diff' ) && class_exists( 'Text_Diff_Renderer_unified' ) ) {
		$diff     = new \Text_Diff( 'auto', array( $old_lines, $new_lines ) );
		$renderer = new \Text_Diff_Renderer_unified();
		$output   = $renderer->render( $diff );

		if ( empty( $output ) ) {
			return '';
		}

		return "--- {$old_label}\n+++ {$new_label}\n{$output}";
	}

	// Fallback: simple line-by-line comparison.
	return wp_agentic_admin_simple_diff( $old_lines, $new_lines, $old_label, $new_label );
}

/**
 * Simple fallback diff when Text_Diff is not available.
 *
 * @param array  $old_lines Lines from the original file.
 * @param array  $new_lines Lines from the modified file.
 * @param string $old_label Label for the original file.
 * @param string $new_label Label for the modified file.
 * @return string Simple diff output.
 */
function wp_agentic_admin_simple_diff( array $old_lines, array $new_lines, string $old_label, string $new_label ): string {
	$output     = "--- {$old_label}\n+++ {$new_label}\n";
	$max_lines  = max( count( $old_lines ), count( $new_lines ) );
	$has_changes = false;

	for ( $i = 0; $i < $max_lines; $i++ ) {
		$old = $old_lines[ $i ] ?? null;
		$new = $new_lines[ $i ] ?? null;

		if ( $old === $new ) {
			continue;
		}

		$has_changes = true;

		if ( null !== $old ) {
			$output .= "- {$old}\n";
		}

		if ( null !== $new ) {
			$output .= "+ {$new}\n";
		}
	}

	return $has_changes ? $output : '';
}

/**
 * Scan for files not present in the official checksums.
 *
 * Matches WP-CLI's core verify-checksums behavior:
 * Matches WP-CLI's filter_file() logic:
 * - Always includes: wp-admin/*, wp-includes/*, root-level wp-* files.
 * - Always excludes: wp-config.php, wp-content/, .htaccess, .maintenance.
 *
 * @see https://github.com/wp-cli/checksum-command/blob/main/src/Checksum_Core_Command.php
 *
 * @param array $known_files Associative array of known core file paths from checksums.
 * @return array List of extra file paths (relative to ABSPATH).
 */
function wp_agentic_admin_find_extra_core_files( array $known_files ): array {
	$extra_files = array();

	// 1. Recursively scan wp-admin/ and wp-includes/.
	$core_dirs = array( 'wp-admin/', 'wp-includes/' );

	foreach ( $core_dirs as $dir ) {
		$full_dir = ABSPATH . $dir;

		if ( ! is_dir( $full_dir ) ) {
			continue;
		}

		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator(
				$full_dir,
				\FilesystemIterator::SKIP_DOTS | \FilesystemIterator::UNIX_PATHS
			)
		);

		foreach ( $iterator as $file_info ) {
			if ( ! $file_info->isFile() ) {
				continue;
			}

			$relative_path = substr( $file_info->getPathname(), strlen( ABSPATH ) );

			if ( ! isset( $known_files[ $relative_path ] ) ) {
				$extra_files[] = $relative_path;
			}
		}
	}

	// 2. Check root-level wp-* files (not just .php).
	// WP-CLI's filter_file regex: /^wp-(?!config\.php)([^\/]*)$/
	// Matches any root-level file starting with "wp-" except wp-config.php.
	$root_handle = opendir( ABSPATH );

	if ( $root_handle ) {
		while ( false !== ( $entry = readdir( $root_handle ) ) ) { // phpcs:ignore WordPress.CodeAnalysis.AssignmentInCondition.FoundInWhileCondition
			// Match WP-CLI: root-level wp-* files, excluding wp-config.php.
			if ( 1 !== preg_match( '/^wp-(?!config\.php)([^\/]*)$/', $entry ) ) {
				continue;
			}

			if ( ! is_file( ABSPATH . $entry ) ) {
				continue;
			}

			if ( ! isset( $known_files[ $entry ] ) ) {
				$extra_files[] = $entry;
			}
		}

		closedir( $root_handle );
	}

	sort( $extra_files );

	return $extra_files;
}
