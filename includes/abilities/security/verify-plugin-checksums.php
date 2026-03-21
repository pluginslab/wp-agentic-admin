<?php
/**
 * Verify Plugin Checksums Ability
 *
 * Verifies installed plugin file checksums against the WordPress.org API.
 * Plugins not hosted on WordPress.org (no checksums available) are counted and skipped.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @see https://github.com/wp-cli/checksum-command — WP-CLI plugin verify-checksums
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the verify-plugin-checksums ability.
 *
 * @return void
 */
function wp_agentic_admin_register_verify_plugin_checksums(): void {
	register_agentic_ability(
		'wp-agentic-admin/verify-plugin-checksums',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Verify Plugin Checksums', 'wp-agentic-admin' ),
			'description'         => __( 'Verify installed plugin file checksums against the WordPress.org API.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(),
				'properties'           => array(
					'include_diffs' => array(
						'type'        => 'boolean',
						'description' => __( 'Include diffs for modified files by fetching originals from WordPress.org SVN.', 'wp-agentic-admin' ),
						'default'     => true,
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'        => array(
						'type'        => 'boolean',
						'description' => __( 'Whether all verifiable plugins passed.', 'wp-agentic-admin' ),
					),
					'message'        => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'total_plugins'  => array(
						'type'        => 'integer',
						'description' => __( 'Total installed plugins checked.', 'wp-agentic-admin' ),
					),
					'verified_count' => array(
						'type'        => 'integer',
						'description' => __( 'Plugins that passed verification.', 'wp-agentic-admin' ),
					),
					'failed_count'   => array(
						'type'        => 'integer',
						'description' => __( 'Plugins with checksum issues.', 'wp-agentic-admin' ),
					),
					'skipped_count'  => array(
						'type'        => 'integer',
						'description' => __( 'Plugins skipped (no checksums available).', 'wp-agentic-admin' ),
					),
					'results'        => array(
						'type'        => 'array',
						'description' => __( 'Per-plugin verification results.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_verify_plugin_checksums',
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
			'keywords'       => array( 'plugin checksum', 'verify plugin', 'plugin integrity', 'plugin hacked', 'plugin modified', 'plugin security', 'plugin malware' ),
			'initialMessage' => __( 'Verifying plugin file checksums...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the verify-plugin-checksums ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_verify_plugin_checksums( array $input = array() ): array {
	$include_diffs = isset( $input['include_diffs'] ) ? (bool) $input['include_diffs'] : true;

	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins = get_plugins();
	$results     = array();
	$verified    = 0;
	$failed      = 0;
	$skipped     = 0;

	foreach ( $all_plugins as $plugin_file => $plugin_data ) {
		$slug    = wp_agentic_admin_get_plugin_slug( $plugin_file );
		$version = $plugin_data['Version'];
		$name    = $plugin_data['Name'];

		// Fetch checksums from WordPress.org.
		$checksums = wp_agentic_admin_fetch_plugin_checksums( $slug, $version );

		if ( false === $checksums ) {
			++$skipped;
			$results[] = array(
				'plugin' => $name,
				'slug'   => $slug,
				'status' => 'skipped',
				'detail' => __( 'No checksums available on WordPress.org.', 'wp-agentic-admin' ),
			);
			continue;
		}

		// Verify files against checksums.
		$plugin_dir    = WP_PLUGIN_DIR . '/' . dirname( $plugin_file );
		$is_single     = ! str_contains( $plugin_file, '/' );
		$base_dir      = $is_single ? WP_PLUGIN_DIR : $plugin_dir;
		$issues        = array();

		foreach ( $checksums as $file => $hashes ) {
			$file_path = $base_dir . '/' . $file;

			if ( ! file_exists( $file_path ) ) {
				$issues[] = array(
					'file'   => $file,
					'status' => 'missing',
				);
				continue;
			}

			if ( ! wp_agentic_admin_verify_file_checksum( $file_path, $hashes ) ) {
				$issue = array(
					'file'   => $file,
					'status' => 'modified',
				);

				if ( $include_diffs ) {
					$diff = wp_agentic_admin_get_plugin_file_diff( $slug, $version, $file, $file_path );
					if ( null !== $diff ) {
						$issue['diff'] = $diff;
					}
				}

				$issues[] = $issue;
			}
		}

		// Detect extra files not in the checksums.
		$local_files = wp_agentic_admin_get_plugin_files( $base_dir, $is_single, $plugin_file );

		foreach ( $local_files as $local_file ) {
			if ( ! isset( $checksums[ $local_file ] ) ) {
				$issues[] = array(
					'file'   => $local_file,
					'status' => 'extra',
				);
			}
		}

		if ( empty( $issues ) ) {
			++$verified;
			$results[] = array(
				'plugin' => $name,
				'slug'   => $slug,
				'status' => 'verified',
				'detail' => __( 'All files match checksums.', 'wp-agentic-admin' ),
			);
		} else {
			++$failed;
			$results[] = array(
				'plugin' => $name,
				'slug'   => $slug,
				'status' => 'failed',
				'issues' => $issues,
			);
		}
	}

	$total   = count( $all_plugins );
	$parts   = array();
	$success = 0 === $failed;

	if ( $verified > 0 ) {
		$parts[] = sprintf(
			/* translators: %d: number of verified plugins */
			_n( '%d plugin verified', '%d plugins verified', $verified, 'wp-agentic-admin' ),
			$verified
		);
	}

	if ( $failed > 0 ) {
		$parts[] = sprintf(
			/* translators: %d: number of failed plugins */
			_n( '%d plugin with issues', '%d plugins with issues', $failed, 'wp-agentic-admin' ),
			$failed
		);
	}

	if ( $skipped > 0 ) {
		$parts[] = sprintf(
			/* translators: %d: number of skipped plugins */
			_n( '%d plugin skipped (no checksums)', '%d plugins skipped (no checksums)', $skipped, 'wp-agentic-admin' ),
			$skipped
		);
	}

	$message = sprintf(
		/* translators: 1: total plugins, 2: result details */
		__( 'Checked %1$d plugins: %2$s.', 'wp-agentic-admin' ),
		$total,
		implode( ', ', $parts )
	);

	return array(
		'success'        => $success,
		'message'        => $message,
		'total_plugins'  => $total,
		'verified_count' => $verified,
		'failed_count'   => $failed,
		'skipped_count'  => $skipped,
		'results'        => $results,
	);
}

/**
 * Get the plugin slug from the plugin file path.
 *
 * Matches WP-CLI's logic: directory-based plugins use the directory name,
 * single-file plugins use the filename without extension.
 *
 * @param string $plugin_file Plugin file path (e.g., "akismet/akismet.php" or "hello.php").
 * @return string Plugin slug.
 */
function wp_agentic_admin_get_plugin_slug( string $plugin_file ): string {
	if ( str_contains( $plugin_file, '/' ) ) {
		return dirname( $plugin_file );
	}

	return basename( $plugin_file, '.php' );
}

/**
 * Fetch plugin checksums from WordPress.org.
 *
 * @param string $slug    Plugin slug.
 * @param string $version Plugin version.
 * @return array|false Associative array of file => hash data, or false if unavailable.
 */
function wp_agentic_admin_fetch_plugin_checksums( string $slug, string $version ): array|false {
	$url = sprintf(
		'https://downloads.wordpress.org/plugin-checksums/%s/%s.json',
		rawurlencode( $slug ),
		rawurlencode( $version )
	);

	$response = wp_remote_get(
		$url,
		array( 'timeout' => 10 )
	);

	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return false;
	}

	$body = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( empty( $body['files'] ) || ! is_array( $body['files'] ) ) {
		return false;
	}

	return $body['files'];
}

/**
 * Verify a file's checksum against expected hashes.
 *
 * Prefers SHA256 when available, falls back to MD5.
 *
 * @param string $file_path Absolute path to the file.
 * @param array  $hashes    Expected hashes with 'sha256' and/or 'md5' keys.
 * @return bool True if the file matches.
 */
function wp_agentic_admin_verify_file_checksum( string $file_path, array $hashes ): bool {
	if ( ! empty( $hashes['sha256'] ) ) {
		$actual = hash_file( 'sha256', $file_path );
		$expected = (array) $hashes['sha256'];
		return in_array( $actual, $expected, true );
	}

	if ( ! empty( $hashes['md5'] ) ) {
		$actual = md5_file( $file_path );
		$expected = (array) $hashes['md5'];
		return in_array( $actual, $expected, true );
	}

	return true;
}

/**
 * Get all files within a plugin directory.
 *
 * @param string $base_dir    Base directory to scan.
 * @param bool   $is_single   Whether this is a single-file plugin.
 * @param string $plugin_file Plugin file path.
 * @return array List of file paths relative to the base directory.
 */
function wp_agentic_admin_get_plugin_files( string $base_dir, bool $is_single, string $plugin_file ): array {
	$files = array();

	// Single-file plugins have no directory to scan for extras.
	if ( $is_single ) {
		return array( $plugin_file );
	}

	if ( ! is_dir( $base_dir ) ) {
		return $files;
	}

	$iterator = new \RecursiveIteratorIterator(
		new \RecursiveDirectoryIterator(
			$base_dir,
			\FilesystemIterator::SKIP_DOTS | \FilesystemIterator::UNIX_PATHS
		)
	);

	foreach ( $iterator as $file_info ) {
		if ( ! $file_info->isFile() ) {
			continue;
		}

		$files[] = substr( $file_info->getPathname(), strlen( $base_dir ) + 1 );
	}

	return $files;
}

/**
 * Generate a unified diff between the original plugin file and the local version.
 *
 * Fetches the original file from WordPress.org plugin SVN.
 *
 * @param string $slug      Plugin slug.
 * @param string $version   Plugin version.
 * @param string $file      Relative file path within the plugin.
 * @param string $file_path Absolute path to the local file.
 * @return string|null Unified diff string, or null on failure.
 */
function wp_agentic_admin_get_plugin_file_diff( string $slug, string $version, string $file, string $file_path ): ?string {
	$original_url = sprintf(
		'https://plugins.svn.wordpress.org/%s/tags/%s/%s',
		rawurlencode( $slug ),
		rawurlencode( $version ),
		$file
	);

	return wp_agentic_admin_get_remote_file_diff( $original_url, $file_path, "a/{$slug}/{$file}", "b/{$slug}/{$file}" );
}
