<?php
/**
 * File Scan Ability
 *
 * Scans PHP files in themes and plugins for common malware patterns:
 * obfuscation, shell execution, backdoors, and injected code.
 *
 * Complements checksum verification by catching malware in plugins
 * that have no checksums on WordPress.org (premium/custom) and all themes.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the file-scan ability.
 *
 * @return void
 */
function wp_agentic_admin_register_file_scan(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/file-scan',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Scan Files for Malware Patterns', 'wp-agentic-admin' ),
			'description'         => __( 'Scan PHP files in themes and plugins for obfuscation, shell execution, backdoors, and injected code.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(),
				'properties'           => array(
					'scan_plugins' => array(
						'type'        => 'boolean',
						'description' => __( 'Scan plugin files.', 'wp-agentic-admin' ),
						'default'     => true,
					),
					'scan_themes'  => array(
						'type'        => 'boolean',
						'description' => __( 'Scan theme files.', 'wp-agentic-admin' ),
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
						'description' => __( 'Whether the scan completed.', 'wp-agentic-admin' ),
					),
					'message'       => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'files_scanned' => array(
						'type'        => 'integer',
						'description' => __( 'Total PHP files scanned.', 'wp-agentic-admin' ),
					),
					'total_hits'    => array(
						'type'        => 'integer',
						'description' => __( 'Total files with suspicious patterns.', 'wp-agentic-admin' ),
					),
					'findings'      => array(
						'type'        => 'array',
						'description' => __( 'List of files with matched patterns.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_file_scan',
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
			'keywords'       => array( 'file scan', 'malware scan', 'scan files', 'obfuscated', 'backdoor', 'shell', 'eval', 'infected files', 'scan themes', 'scan plugins' ),
			'initialMessage' => __( 'Scanning PHP files for malware patterns...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Malware patterns to scan for.
 *
 * Each pattern has a regex, a human-readable label, and a risk score.
 * Ordered from highest to lowest risk.
 *
 * IMPORTANT: Pattern regexes are built by concatenating string fragments
 * so this file does not contain the literal function names it scans for.
 * Otherwise the scanner would flag its own source code.
 *
 * Filterable via the `wp_agentic_admin_file_scan_patterns` hook.
 *
 * @return array Array of pattern definitions.
 */
function wp_agentic_admin_get_malware_patterns(): array {
	// NOTE: This plugin's own directory is excluded from scanning via the
	// wp_agentic_admin_file_scan_excluded_paths filter (see execute function),
	// so these literal strings won't trigger self-detection.
	$patterns = array(
		array(
			'id'         => 'eval_base64',
			'label'      => 'eval(base64_decode(...))',
			'regex'      => '/eval\s*\(\s*base64_decode\s*\(/i',
			'risk_score' => 9.5,
		),
		array(
			'id'         => 'preg_replace_e',
			'label'      => 'preg_replace with /e modifier',
			'regex'      => '/preg_replace\s*\(\s*["\'].*\/e["\'\s]/i',
			'risk_score' => 9.0,
		),
		array(
			'id'         => 'eval_variable',
			'label'      => 'eval($variable)',
			'regex'      => '/eval\s*\(\s*\$/i',
			'risk_score' => 9.0,
		),
		array(
			'id'         => 'assert_variable',
			'label'      => 'assert($variable)',
			'regex'      => '/assert\s*\(\s*\$/i',
			'risk_score' => 8.5,
		),
		array(
			'id'         => 'shell_exec',
			'label'      => 'Shell execution functions',
			'regex'      => '/\b(shell_exec|passthru|proc_open|popen)\s*\(/i',
			'risk_score' => 8.0,
		),
		array(
			'id'         => 'str_rot13',
			'label'      => 'str_rot13 encoding',
			'regex'      => '/str_rot13\s*\(/i',
			'risk_score' => 7.5,
		),
		array(
			'id'         => 'gzinflate',
			'label'      => 'gzinflate decompression',
			'regex'      => '/gzinflate\s*\(/i',
			'risk_score' => 7.0,
		),
		array(
			'id'         => 'iframe_in_php',
			'label'      => '<iframe> tag in PHP file',
			'regex'      => '/<iframe/i',
			'risk_score' => 6.5,
		),
		array(
			'id'         => 'variable_variables',
			'label'      => 'Variable variables (${$...})',
			'regex'      => '/\$\{\s*\$/',
			'risk_score' => 5.5,
		),
		array(
			'id'         => 'base64_decode',
			'label'      => 'base64_decode usage',
			'regex'      => '/base64_decode\s*\(/i',
			'risk_score' => 5.0,
		),
		array(
			'id'         => 'remote_file_get',
			'label'      => 'Remote file_get_contents',
			'regex'      => '/file_get_contents\s*\(\s*["\']https?:\/\//i',
			'risk_score' => 4.0,
		),
	);

	/**
	 * Filters the malware patterns used by the file scanner.
	 *
	 * Plugins can add, remove, or modify patterns. Each pattern must have:
	 * - id:         (string) Unique identifier.
	 * - label:      (string) Human-readable name.
	 * - regex:      (string) PCRE regex to match.
	 * - risk_score: (float)  Risk score from 1.0 to 10.0.
	 *
	 * @since 0.9.6
	 *
	 * @param array $patterns Array of pattern definitions.
	 */
	return apply_filters( 'wp_agentic_admin_file_scan_patterns', $patterns );
}

/**
 * Execute the file-scan ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_file_scan( array $input = array() ): array {
	$scan_plugins = isset( $input['scan_plugins'] ) ? (bool) $input['scan_plugins'] : true;
	$scan_themes  = isset( $input['scan_themes'] ) ? (bool) $input['scan_themes'] : true;

	$risk_threshold = 6.0;
	$patterns       = wp_agentic_admin_get_malware_patterns();
	$dirs_to_scan   = array();

	if ( $scan_plugins ) {
		$dirs_to_scan[] = WP_PLUGIN_DIR;

		// Also scan must-use plugins if the directory exists.
		$mu_dir = defined( 'WPMU_PLUGIN_DIR' ) ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins';
		if ( is_dir( $mu_dir ) ) {
			$dirs_to_scan[] = $mu_dir;
		}
	}

	if ( $scan_themes ) {
		$dirs_to_scan[] = get_theme_root();
	}

	$files_scanned   = 0;
	$findings        = array();
	$scanned_plugins    = array();
	$scanned_themes     = array();
	$scanned_mu_plugins = array();

	// Directories to skip (build artifacts, vendor dependencies, and this plugin).
	$skip_dirs = array( 'node_modules', 'vendor', '.git', 'build', 'dist' );

	/**
	 * Filters the directory names to skip during the file scan.
	 *
	 * @since 0.9.6
	 *
	 * @param array $skip_dirs Array of directory basenames to skip.
	 */
	$skip_dirs = apply_filters( 'wp_agentic_admin_file_scan_skip_dirs', $skip_dirs );

	// Exclude this plugin's own directory — it contains pattern strings that would self-trigger.
	$self_dir = defined( 'WP_AGENTIC_ADMIN_PLUGIN_DIR' ) ? wp_normalize_path( WP_AGENTIC_ADMIN_PLUGIN_DIR ) : '';

	/**
	 * Filters absolute paths to exclude from the file scan.
	 *
	 * Paths in this array are skipped entirely. The plugin's own directory
	 * is excluded by default to prevent self-detection of pattern strings.
	 *
	 * @since 0.9.6
	 *
	 * @param array $excluded_paths Array of absolute paths to exclude.
	 */
	$excluded_paths = apply_filters(
		'wp_agentic_admin_file_scan_excluded_paths',
		$self_dir ? array( $self_dir ) : array()
	);

	foreach ( $dirs_to_scan as $dir ) {
		if ( ! is_dir( $dir ) ) {
			continue;
		}

		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveCallbackFilterIterator(
				new \RecursiveDirectoryIterator(
					$dir,
					\FilesystemIterator::SKIP_DOTS | \FilesystemIterator::UNIX_PATHS
				),
				function ( $current, $key, $iterator ) use ( $skip_dirs, $excluded_paths ) {
					// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- Required by callback signature.
					if ( $current->isDir() ) {
						// Skip named directories (node_modules, vendor, etc.).
						if ( in_array( $current->getFilename(), $skip_dirs, true ) ) {
							return false;
						}

						// Skip excluded absolute paths (this plugin's own dir).
						$normalized = wp_normalize_path( $current->getPathname() . '/' );
						foreach ( $excluded_paths as $excluded ) {
							if ( str_starts_with( $normalized, wp_normalize_path( $excluded ) ) ) {
								return false;
							}
						}
					}
					return true;
				}
			)
		);

		$normalized_dir  = wp_normalize_path( $dir );
		$is_plugin_dir   = $normalized_dir === wp_normalize_path( WP_PLUGIN_DIR );
		$mu_plugin_dir   = defined( 'WPMU_PLUGIN_DIR' ) ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins';
		$is_mu_dir       = $normalized_dir === wp_normalize_path( $mu_plugin_dir );

		foreach ( $iterator as $file_info ) {
			if ( ! $file_info->isFile() ) {
				continue;
			}

			// Only scan PHP files.
			if ( 'php' !== pathinfo( $file_info->getFilename(), PATHINFO_EXTENSION ) ) {
				continue;
			}

			++$files_scanned;

			$file_path = $file_info->getPathname();
			$relative  = wp_agentic_admin_get_content_relative_path( $file_path );

			// Track which plugin/theme/mu-plugin this file belongs to.
			$relative_to_dir = substr( $file_path, strlen( $dir ) + 1 );
			$top_dir         = strstr( $relative_to_dir, '/', true );

			if ( $is_mu_dir ) {
				// MU-plugins can be single files or directories.
				$mu_name = $top_dir ? $top_dir : $file_info->getFilename();
				$scanned_mu_plugins[ $mu_name ] = true;
			} elseif ( $top_dir ) {
				if ( $is_plugin_dir ) {
					$scanned_plugins[ $top_dir ] = true;
				} else {
					$scanned_themes[ $top_dir ] = true;
				}
			}

			$file_matches = wp_agentic_admin_scan_file_for_patterns( $file_path, $patterns );

			if ( ! empty( $file_matches ) ) {
				// Use the highest risk score among matched patterns.
				$max_risk = max( array_column( $file_matches, 'risk_score' ) );

				$findings[] = array(
					'file'       => $relative,
					'patterns'   => $file_matches,
					'risk_score' => $max_risk,
				);
			}
		}
	}

	// Filter to only high-risk findings.
	$high_risk_findings = array_values(
		array_filter(
			$findings,
			function ( $f ) use ( $risk_threshold ) {
				return $f['risk_score'] >= $risk_threshold;
			}
		)
	);

	// Sort by risk score descending.
	usort(
		$high_risk_findings,
		function ( $a, $b ) {
			return $b['risk_score'] <=> $a['risk_score'];
		}
	);

	$total_hits   = count( $high_risk_findings );
	$filtered_out = count( $findings ) - $total_hits;

	if ( 0 === $total_hits ) {
		$message = sprintf(
			/* translators: 1: files scanned, 2: filtered count */
			__( 'Scanned %1$d PHP files. No high-risk patterns detected (threshold: 6.0/10). %2$d low-risk matches filtered out.', 'wp-agentic-admin' ),
			$files_scanned,
			$filtered_out
		);
	} else {
		$message = sprintf(
			/* translators: 1: high risk count, 2: files scanned, 3: filtered count */
			__( 'Scanned %2$d PHP files. Found %1$d file(s) with high-risk patterns (score >= 6.0/10). %3$d low-risk matches filtered out.', 'wp-agentic-admin' ),
			$total_hits,
			$files_scanned,
			$filtered_out
		);
	}

	// Resolve scanned plugin/theme slugs to names.
	$plugins_list    = wp_agentic_admin_resolve_plugin_names( array_keys( $scanned_plugins ) );
	$themes_list     = wp_agentic_admin_resolve_theme_names( array_keys( $scanned_themes ) );
	$mu_plugins_list = array_keys( $scanned_mu_plugins );
	sort( $mu_plugins_list );

	return array(
		'success'            => true,
		'message'            => $message,
		'files_scanned'      => $files_scanned,
		'total_hits'         => $total_hits,
		'filtered_out'       => $filtered_out,
		'risk_threshold'     => $risk_threshold,
		'plugins_scanned'    => $plugins_list,
		'themes_scanned'     => $themes_list,
		'mu_plugins_scanned' => $mu_plugins_list,
		'findings'           => $high_risk_findings,
	);
}

/**
 * Scan a single file for malware patterns.
 *
 * Reads the file in chunks to handle large files efficiently.
 * Returns matched patterns with line numbers.
 *
 * @param string $file_path Absolute path to the file.
 * @param array  $patterns  Patterns to scan for.
 * @return array Matched patterns with details.
 */
function wp_agentic_admin_scan_file_for_patterns( string $file_path, array $patterns ): array {
	// Skip files larger than 2MB — likely not PHP source.
	if ( filesize( $file_path ) > 2 * 1024 * 1024 ) {
		return array();
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading local PHP files for pattern matching.
	$content = file_get_contents( $file_path );

	if ( false === $content ) {
		return array();
	}

	$matches = array();

	foreach ( $patterns as $pattern ) {
		if ( preg_match( $pattern['regex'], $content, $m, PREG_OFFSET_CAPTURE ) ) {
			// Calculate line number from byte offset.
			$line_number = substr_count( $content, "\n", 0, $m[0][1] ) + 1;

			$matches[] = array(
				'id'         => $pattern['id'],
				'label'      => $pattern['label'],
				'risk_score' => $pattern['risk_score'],
				'line'       => $line_number,
			);
		}
	}

	return $matches;
}

/**
 * Resolve plugin directory slugs to human-readable names.
 *
 * @param array $slugs Array of plugin directory slugs.
 * @return array Array of { slug, name } objects.
 */
function wp_agentic_admin_resolve_plugin_names( array $slugs ): array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins = get_plugins();
	$result      = array();

	foreach ( $slugs as $slug ) {
		$name = $slug;

		// Find the plugin whose file starts with this slug directory.
		foreach ( $all_plugins as $plugin_file => $plugin_data ) {
			if ( str_starts_with( $plugin_file, $slug . '/' ) ) {
				$name = $plugin_data['Name'];
				break;
			}
		}

		$result[] = array(
			'slug' => $slug,
			'name' => $name,
		);
	}

	// Sort alphabetically by name.
	usort(
		$result,
		function ( $a, $b ) {
			return strcasecmp( $a['name'], $b['name'] );
		}
	);

	return $result;
}

/**
 * Resolve theme directory slugs to human-readable names.
 *
 * @param array $slugs Array of theme directory slugs.
 * @return array Array of { slug, name } objects.
 */
function wp_agentic_admin_resolve_theme_names( array $slugs ): array {
	$result = array();

	foreach ( $slugs as $slug ) {
		$theme = wp_get_theme( $slug );
		$result[] = array(
			'slug' => $slug,
			'name' => $theme->exists() ? $theme->get( 'Name' ) : $slug,
		);
	}

	usort(
		$result,
		function ( $a, $b ) {
			return strcasecmp( $a['name'], $b['name'] );
		}
	);

	return $result;
}

/**
 * Get a file path relative to wp-content for display.
 *
 * @param string $absolute_path Absolute file path.
 * @return string Relative path from wp-content.
 */
function wp_agentic_admin_get_content_relative_path( string $absolute_path ): string {
	$content_dir = WP_CONTENT_DIR;

	if ( str_starts_with( $absolute_path, $content_dir ) ) {
		return substr( $absolute_path, strlen( $content_dir ) + 1 );
	}

	return $absolute_path;
}
