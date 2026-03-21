<?php
/**
 * Uploads Scan Ability
 *
 * Scans the WordPress uploads directory for files that should not be there:
 * PHP scripts, server-side executables, and other non-media files that may
 * indicate a compromised site.
 *
 * The uploads directory should only contain media (images, video, audio,
 * documents). Any executable file is a strong indicator of malware.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the uploads-scan ability.
 *
 * @return void
 */
function wp_agentic_admin_register_uploads_scan(): void {
	register_agentic_ability(
		'wp-agentic-admin/uploads-scan',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Scan Uploads for Suspicious Files', 'wp-agentic-admin' ),
			'description'         => __( 'Scan uploads, WordPress root, and .well-known for PHP scripts, executables, and other suspicious files that may indicate a compromise.', 'wp-agentic-admin' ),
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
					'success'            => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the scan completed.', 'wp-agentic-admin' ),
					),
					'message'            => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'areas_scanned'      => array(
						'type'        => 'array',
						'description' => __( 'Areas that were scanned (uploads, root, .well-known).', 'wp-agentic-admin' ),
					),
					'total_files'        => array(
						'type'        => 'integer',
						'description' => __( 'Total files found in uploads.', 'wp-agentic-admin' ),
					),
					'suspicious_count'   => array(
						'type'        => 'integer',
						'description' => __( 'Number of suspicious files found.', 'wp-agentic-admin' ),
					),
					'suspicious_files'   => array(
						'type'        => 'array',
						'description' => __( 'List of suspicious files with details.', 'wp-agentic-admin' ),
					),
					'htaccess_findings'  => array(
						'type'        => 'array',
						'description' => __( 'Any .htaccess files found in uploads subdirectories.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_uploads_scan',
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
			'keywords'       => array( 'uploads', 'upload', 'media', 'suspicious files', 'php in uploads', 'backdoor uploads', 'scan uploads', 'uploaded malware', 'well-known', 'root files', 'dropped files' ),
			'initialMessage' => __( 'Scanning the uploads directory for suspicious files...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the uploads-scan ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_uploads_scan( array $input = array() ): array {
	// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Required parameter for callback signature.

	// Extensions that should never appear in uploads, root, or .well-known.
	$dangerous_extensions = array(
		'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar',
		'cgi', 'pl', 'py', 'rb', 'sh', 'bash',
		'asp', 'aspx',
		'jsp',
		'exe', 'dll', 'so',
	);

	/**
	 * Filters the list of dangerous file extensions to scan for.
	 *
	 * @since 0.9.6
	 *
	 * @param array $dangerous_extensions Array of file extensions (without dots).
	 */
	$dangerous_extensions = apply_filters( 'wp_agentic_admin_uploads_dangerous_extensions', $dangerous_extensions );

	$total_files       = 0;
	$suspicious_files  = array();
	$htaccess_findings = array();
	$areas_scanned     = array();

	// 1. Scan uploads directory (recursive).
	$upload_dir = wp_upload_dir();
	$base_dir   = $upload_dir['basedir'];

	if ( is_dir( $base_dir ) ) {
		$areas_scanned[] = 'uploads';
		wp_agentic_admin_scan_directory_for_dangerous_files(
			$base_dir,
			'uploads',
			$dangerous_extensions,
			$total_files,
			$suspicious_files,
			$htaccess_findings,
			true
		);
	}

	// 2. Scan WordPress root for unexpected PHP files.
	// Core files are already covered by verify-core-checksums. Here we look for
	// non-wp-* PHP files that attackers drop at the root (e.g., db.php, x.php, shell.php).
	$root_dir = untrailingslashit( ABSPATH );
	if ( is_dir( $root_dir ) ) {
		$areas_scanned[] = 'root';
		wp_agentic_admin_scan_root_for_dangerous_files(
			$root_dir,
			$dangerous_extensions,
			$total_files,
			$suspicious_files,
			$htaccess_findings
		);
	}

	// 3. Scan .well-known directory (recursive).
	// Attackers hide backdoors in .well-known/ because admins rarely check it
	// and some security scanners skip dotfiles/dotdirs.
	$well_known_dir = ABSPATH . '.well-known';
	if ( is_dir( $well_known_dir ) ) {
		$areas_scanned[] = '.well-known';
		wp_agentic_admin_scan_directory_for_dangerous_files(
			$well_known_dir,
			'.well-known',
			$dangerous_extensions,
			$total_files,
			$suspicious_files,
			$htaccess_findings,
			true
		);
	}

	// Sort by risk score descending.
	usort(
		$suspicious_files,
		function ( $a, $b ) {
			return $b['risk_score'] <=> $a['risk_score'];
		}
	);

	$suspicious_count = count( $suspicious_files );
	$htaccess_count   = count( $htaccess_findings );
	$areas_label      = implode( ', ', $areas_scanned );

	if ( 0 === $suspicious_count && 0 === $htaccess_count ) {
		$message = sprintf(
			/* translators: 1: total files, 2: areas scanned */
			__( 'Scanned %1$d files across %2$s. No suspicious files found.', 'wp-agentic-admin' ),
			$total_files,
			$areas_label
		);
	} else {
		$parts = array();

		if ( $suspicious_count > 0 ) {
			$parts[] = sprintf(
				/* translators: %d: number of suspicious files */
				_n( '%d suspicious file', '%d suspicious files', $suspicious_count, 'wp-agentic-admin' ),
				$suspicious_count
			);
		}

		if ( $htaccess_count > 0 ) {
			$parts[] = sprintf(
				/* translators: %d: number of .htaccess files */
				_n( '%d .htaccess file', '%d .htaccess files', $htaccess_count, 'wp-agentic-admin' ),
				$htaccess_count
			);
		}

		$message = sprintf(
			/* translators: 1: findings summary, 2: total files, 3: areas scanned */
			__( 'Found %1$s (%2$d files scanned across %3$s). These require investigation.', 'wp-agentic-admin' ),
			implode( ' and ', $parts ),
			$total_files,
			$areas_label
		);
	}

	return array(
		'success'           => true,
		'message'           => $message,
		'areas_scanned'     => $areas_scanned,
		'total_files'       => $total_files,
		'suspicious_count'  => $suspicious_count,
		'suspicious_files'  => $suspicious_files,
		'htaccess_findings' => $htaccess_findings,
	);
}

/**
 * Recursively scan a directory for dangerous files.
 *
 * @param string $dir                   Absolute path to scan.
 * @param string $area_label            Label for this scan area (used in file paths).
 * @param array  $dangerous_extensions  Extensions to flag.
 * @param int    $total_files           Running count of total files (passed by reference).
 * @param array  $suspicious_files      Running list of suspicious files (passed by reference).
 * @param array  $htaccess_findings     Running list of .htaccess findings (passed by reference).
 * @param bool   $recursive             Whether to scan recursively.
 * @return void
 */
function wp_agentic_admin_scan_directory_for_dangerous_files(
	string $dir,
	string $area_label,
	array $dangerous_extensions,
	int &$total_files,
	array &$suspicious_files,
	array &$htaccess_findings,
	bool $recursive = true
): void {
	if ( $recursive ) {
		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator(
				$dir,
				\FilesystemIterator::SKIP_DOTS | \FilesystemIterator::UNIX_PATHS
			)
		);
	} else {
		$iterator = new \DirectoryIterator( $dir );
	}

	foreach ( $iterator as $file_info ) {
		if ( ! $file_info->isFile() ) {
			continue;
		}

		// Skip dotfiles in non-recursive mode (DirectoryIterator doesn't have SKIP_DOTS).
		if ( ! $recursive && str_starts_with( $file_info->getFilename(), '.' ) ) {
			continue;
		}

		++$total_files;

		$filename  = $file_info->getFilename();
		$file_path = $file_info->getPathname();
		$relative  = $area_label . '/' . substr( $file_path, strlen( $dir ) + 1 );

		// Check for .htaccess files — attackers use these to enable PHP execution.
		if ( '.htaccess' === $filename ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading local .htaccess for security scan.
			$htaccess_content = file_get_contents( $file_path );
			$is_dangerous     = false !== $htaccess_content
				&& preg_match( '/AddHandler|AddType|SetHandler|php_flag|php_value/i', $htaccess_content );

			$htaccess_findings[] = array(
				'file'        => $relative,
				'size'        => $file_info->getSize(),
				'modified'    => gmdate( 'Y-m-d H:i:s', $file_info->getMTime() ),
				'enables_php' => $is_dangerous,
				'risk_score'  => $is_dangerous ? 9.5 : 5.0,
			);
			continue;
		}

		$result = wp_agentic_admin_classify_dangerous_file( $filename, $dangerous_extensions );

		if ( null !== $result ) {
			$result['file']     = $relative;
			$result['size']     = $file_info->getSize();
			$result['modified'] = gmdate( 'Y-m-d H:i:s', $file_info->getMTime() );
			$suspicious_files[] = $result;
		}
	}
}

/**
 * Scan the WordPress root directory (non-recursively) for unexpected dangerous files.
 *
 * Skips known WordPress core files (wp-*.php, index.php, xmlrpc.php, etc.)
 * since those are covered by verify-core-checksums. Flags anything else
 * with a dangerous extension.
 *
 * @param string $root_dir              Absolute path to ABSPATH.
 * @param array  $dangerous_extensions  Extensions to flag.
 * @param int    $total_files           Running count (by reference).
 * @param array  $suspicious_files      Running list (by reference).
 * @param array  $htaccess_findings     Running list (by reference).
 * @return void
 */
function wp_agentic_admin_scan_root_for_dangerous_files(
	string $root_dir,
	array $dangerous_extensions,
	int &$total_files,
	array &$suspicious_files,
	array &$htaccess_findings
): void {
	// Known legitimate root-level files — these are checked by verify-core-checksums.
	$known_root_files = array(
		'index.php',
		'wp-activate.php',
		'wp-blog-header.php',
		'wp-comments-post.php',
		'wp-config.php',
		'wp-config-sample.php',
		'wp-cron.php',
		'wp-links-opml.php',
		'wp-load.php',
		'wp-login.php',
		'wp-mail.php',
		'wp-settings.php',
		'wp-signup.php',
		'wp-trackback.php',
		'xmlrpc.php',
		'.htaccess',
		'.maintenance',
		'license.txt',
		'readme.html',
	);

	$root_handle = opendir( $root_dir );

	if ( ! $root_handle ) {
		return;
	}

	while ( false !== ( $entry = readdir( $root_handle ) ) ) { // phpcs:ignore WordPress.CodeAnalysis.AssignmentInCondition.FoundInWhileCondition
		if ( '.' === $entry || '..' === $entry ) {
			continue;
		}

		$full_path = $root_dir . '/' . $entry;

		if ( ! is_file( $full_path ) ) {
			continue;
		}

		++$total_files;

		// Skip known WordPress core root files.
		if ( in_array( $entry, $known_root_files, true ) ) {
			continue;
		}

		$result = wp_agentic_admin_classify_dangerous_file( $entry, $dangerous_extensions );

		if ( null !== $result ) {
			$result['file']     = 'root/' . $entry;
			$result['size']     = filesize( $full_path );
			$result['modified'] = gmdate( 'Y-m-d H:i:s', filemtime( $full_path ) );
			$suspicious_files[] = $result;
		}
	}

	closedir( $root_handle );
}

/**
 * Classify a file as dangerous based on its extensions.
 *
 * @param string $filename             The filename to check.
 * @param array  $dangerous_extensions Extensions to flag.
 * @return array|null Findings array with risk_score, flags, dangerous_extensions — or null if safe.
 */
function wp_agentic_admin_classify_dangerous_file( string $filename, array $dangerous_extensions ): ?array {
	$extensions = wp_agentic_admin_get_all_extensions( $filename );
	$matches    = array_intersect( $extensions, $dangerous_extensions );

	if ( empty( $matches ) ) {
		return null;
	}

	$risk_score = 7.0;
	$flags      = array();

	$php_exts = array_intersect( $matches, array( 'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar' ) );
	if ( ! empty( $php_exts ) ) {
		$risk_score = 9.5;
		$flags[]    = __( 'PHP executable', 'wp-agentic-admin' );
	}

	$shell_exts = array_intersect( $matches, array( 'sh', 'bash', 'cgi', 'pl', 'py', 'rb' ) );
	if ( ! empty( $shell_exts ) ) {
		$risk_score = max( $risk_score, 8.5 );
		$flags[]    = __( 'Server-side script', 'wp-agentic-admin' );
	}

	$binary_exts = array_intersect( $matches, array( 'exe', 'dll', 'so' ) );
	if ( ! empty( $binary_exts ) ) {
		$risk_score = max( $risk_score, 8.0 );
		$flags[]    = __( 'Binary executable', 'wp-agentic-admin' );
	}

	// Double extension — disguised file (e.g., shell.php.jpg).
	if ( ! empty( $php_exts ) && count( $extensions ) > 1 ) {
		$risk_score = 10.0;
		$flags[]    = __( 'Double extension — disguised PHP file', 'wp-agentic-admin' );
	}

	return array(
		'dangerous_extensions' => array_values( $matches ),
		'flags'                => $flags,
		'risk_score'           => $risk_score,
	);
}

/**
 * Extract all extensions from a filename.
 *
 * Handles double extensions like "shell.php.jpg" → ['php', 'jpg']
 * and single extensions like "image.png" → ['png'].
 *
 * @param string $filename The filename to parse.
 * @return array Array of lowercase extensions.
 */
function wp_agentic_admin_get_all_extensions( string $filename ): array {
	// Remove leading dot from hidden files.
	$name = ltrim( $filename, '.' );
	$parts = explode( '.', $name );

	// Remove the base name, keep only extensions.
	array_shift( $parts );

	return array_map( 'strtolower', $parts );
}
