<?php
/**
 * Read File Ability
 *
 * Reads WordPress files with automatic sanitization of sensitive data.
 *
 * @license GPL-2.0-or-later
 * @package AgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the read-file ability.
 *
 * @return void
 */
function agentic_admin_register_read_file(): void {
	agentic_admin_register_ability(
		'agentic-admin/read-file',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Read File', 'agentic-admin' ),
			'description'         => __( 'Read a WordPress file. Files that can hold credentials, keys, or salts (such as wp-config.php) are never read.', 'agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array(
					'file_path' => '.htaccess',
					'offset'    => 0,
					'lines'     => 100,
				),
				'required'             => array( 'file_path' ),
				'properties'           => array(
					'file_path' => array(
						'type'        => 'string',
						'description' => __( 'Path to the file relative to the site root (e.g. .htaccess or wp-content/themes/mytheme/functions.php).', 'agentic-admin' ),
					),
					'offset'    => array(
						'type'        => 'integer',
						'default'     => 0,
						'minimum'     => 0,
						'description' => __( 'Line number to start reading from (0-based).', 'agentic-admin' ),
					),
					'lines'     => array(
						'type'        => 'integer',
						'default'     => 100,
						'minimum'     => 1,
						'maximum'     => 500,
						'description' => __( 'Maximum number of lines to return.', 'agentic-admin' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success'        => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the file was read successfully.', 'agentic-admin' ),
					),
					'message'        => array(
						'type'        => 'string',
						'description' => __( 'Human-readable status message.', 'agentic-admin' ),
					),
					'file_path'      => array(
						'type'        => 'string',
						'description' => __( 'Resolved file path relative to the site root.', 'agentic-admin' ),
					),
					'content'        => array(
						'type'        => 'string',
						'description' => __( 'File contents with sensitive data redacted.', 'agentic-admin' ),
					),
					'total_lines'    => array(
						'type'        => 'integer',
						'description' => __( 'Total number of lines in the file.', 'agentic-admin' ),
					),
					'lines_returned' => array(
						'type'        => 'integer',
						'description' => __( 'Number of lines returned in this response.', 'agentic-admin' ),
					),
					'was_redacted'   => array(
						'type'        => 'boolean',
						'description' => __( 'Whether any sensitive values were redacted from the output.', 'agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'agentic_admin_execute_read_file',
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
			'keywords'       => array( 'read', 'show', 'view', 'open', 'display', 'cat', 'file', 'config', 'htaccess', 'functions.php', 'contents', 'source' ),
			'initialMessage' => __( "I'll read that file for you...", 'agentic-admin' ),
		)
	);
}

/**
 * Execute the read-file ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function agentic_admin_execute_read_file( array $input = array() ): array {
	$raw_path = isset( $input['file_path'] ) ? sanitize_text_field( $input['file_path'] ) : '';
	$offset   = isset( $input['offset'] ) ? absint( $input['offset'] ) : 0;
	$lines    = isset( $input['lines'] ) ? absint( $input['lines'] ) : 100;
	$lines    = min( $lines, 500 );

	if ( '' === $raw_path ) {
		return array(
			'success' => false,
			'message' => __( 'No file path provided.', 'agentic-admin' ),
		);
	}

	// Resolve the absolute path: support both absolute paths and paths
	// relative to the site root (get_home_path()).
	if ( ! function_exists( 'get_home_path' ) ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
	}
	$site_root = trailingslashit( wp_normalize_path( get_home_path() ) );

	// Detect absolute paths: starts with / (Unix) or drive letter (Windows e.g. C:\).
	$is_absolute = ( '/' === $raw_path[0] ) || ( strlen( $raw_path ) > 2 && ':' === $raw_path[1] );

	if ( $is_absolute ) {
		$absolute_path = wp_normalize_path( $raw_path );
	} else {
		// For bare filenames with no directory component, try common WordPress locations.
		// e.g. "functions.php" → active theme, "style.css" → active theme, ".htaccess" → site root.
		$bare_name = basename( $raw_path );
		if ( $bare_name === $raw_path && false === strpos( $raw_path, '/' ) ) {
			$absolute_path = agentic_admin_resolve_bare_filename( $raw_path, $site_root );
		} else {
			// Strip any leading slash before joining.
			$absolute_path = wp_normalize_path( $site_root . ltrim( $raw_path, '/\\' ) );
		}
	}

	// Resolve symlinks and canonicalise.
	$real_path = realpath( $absolute_path );

	if ( false === $real_path ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: file path */
				__( 'File not found: %s', 'agentic-admin' ),
				$raw_path
			),
		);
	}

	$real_path = wp_normalize_path( $real_path );
	$real_root = trailingslashit( wp_normalize_path( (string) realpath( $site_root ) ) );

	// Security: ensure the file is within the site root directory.
	if ( '/' === $real_root || ! str_starts_with( $real_path, $real_root ) ) {
		return array(
			'success' => false,
			'message' => __( 'Access denied: file is outside the WordPress root directory.', 'agentic-admin' ),
		);
	}

	if ( ! is_readable( $real_path ) ) {
		return array(
			'success' => false,
			'message' => __( 'File exists but is not readable.', 'agentic-admin' ),
		);
	}

	if ( is_dir( $real_path ) ) {
		return array(
			'success' => false,
			'message' => __( 'Path points to a directory, not a file.', 'agentic-admin' ),
		);
	}

	// Security: never return files that hold credentials, keys, or salts.
	// These are refused outright rather than redacted, because pattern-based
	// redaction cannot reliably catch every way a secret can be written.
	if ( agentic_admin_is_secret_file( $real_path ) ) {
		return array(
			'success' => false,
			'message' => __( 'Access denied: this file can contain credentials, authentication keys, or salts, so it is never read. Use the wp-config-list ability to see non-sensitive configuration constants.', 'agentic-admin' ),
		);
	}

	// Read the file lines.
	$file = new \SplFileObject( $real_path, 'r' );
	$file->seek( PHP_INT_MAX );
	$total_lines = $file->key() + 1;

	$all_lines = array();
	$file->rewind();

	// Collect requested range.
	$start = $offset;
	$end   = min( $offset + $lines, $total_lines );

	for ( $i = 0; $i < $end; $i++ ) {
		$line = $file->current();
		if ( $i >= $start ) {
			$all_lines[] = rtrim( (string) $line, "\r\n" );
		}
		$file->next();
	}

	$content = implode( "\n", $all_lines );

	// Redact sensitive values before the content leaves PHP.
	list( $content, $was_redacted ) = agentic_admin_redact_sensitive_data( $content );

	$relative_path = substr( $real_path, strlen( $real_root ) );

	return array(
		'success'        => true,
		'message'        => sprintf(
			/* translators: %s: file path */
			__( 'Read file: %s', 'agentic-admin' ),
			$relative_path
		),
		'file_path'      => $relative_path,
		'content'        => $content,
		'total_lines'    => $total_lines,
		'lines_returned' => count( $all_lines ),
		'was_redacted'   => $was_redacted,
	);
}

/**
 * Resolve a bare filename (no directory) to its most likely WordPress path.
 *
 * Root-level files resolve to the site root; anything else tries the active
 * theme directory, so that e.g. "functions.php" resolves to the theme.
 *
 * @param string $filename Bare filename (e.g. 'functions.php').
 * @param string $site_root Normalised site root with trailing slash.
 * @return string Absolute path to the best candidate (may not exist).
 */
function agentic_admin_resolve_bare_filename( string $filename, string $site_root ): string {
	// Always-at-root files.
	$root_files = array( '.htaccess', 'robots.txt', 'wp-login.php', 'wp-cron.php', 'xmlrpc.php', 'index.php' );
	if ( in_array( $filename, $root_files, true ) ) {
		return wp_normalize_path( $site_root . $filename );
	}

	// Theme files: check active (child) theme, then parent theme.
	$theme_candidates = array(
		wp_normalize_path( get_stylesheet_directory() . '/' . $filename ),
		wp_normalize_path( get_template_directory() . '/' . $filename ),
	);
	foreach ( $theme_candidates as $candidate ) {
		if ( file_exists( $candidate ) ) {
			return $candidate;
		}
	}

	// Fall back to the site root.
	return wp_normalize_path( $site_root . $filename );
}

/**
 * Whether a file must never be returned because it can hold secrets.
 *
 * Matches by name first (wp-config.php and its variants, .env files,
 * password files, private keys, database dumps), then scans the whole file
 * for define() calls of the authentication keys and salts or the database
 * password, so a secrets file with an unexpected name is refused too.
 *
 * @param string $real_path Canonical absolute path of the file.
 * @return bool True when the file must not be read.
 */
function agentic_admin_is_secret_file( string $real_path ): bool {
	$name = strtolower( basename( $real_path ) );

	if ( preg_match( '/^wp-config.*\.php$/', $name ) ) {
		return true;
	}

	if ( str_starts_with( $name, '.env' ) || in_array( $name, array( '.htpasswd', 'auth.json', '.netrc', '.pgpass', '.my.cnf' ), true ) ) {
		return true;
	}

	if ( preg_match( '/^id_(rsa|dsa|ecdsa|ed25519)/', $name ) || preg_match( '/\.(pem|key|p12|pfx|sql|sqlite|sqlite3|db)$/', $name ) ) {
		return true;
	}

	if ( preg_match( '#/\.(git|ssh)/#', wp_normalize_path( $real_path ) ) ) {
		return true;
	}

	// Content check over the whole file, not just the requested line range.
	$handle = new \SplFileObject( $real_path, 'r' );
	while ( ! $handle->eof() ) {
		$line = (string) $handle->fgets();
		if ( preg_match( '/define\s*\(\s*[\'"](?:(?:SECURE_AUTH|LOGGED_IN|AUTH|NONCE)_(?:KEY|SALT)|DB_PASSWORD)[\'"]/i', $line ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Redact sensitive values from file content.
 *
 * Targets PHP define() calls and INI-style key=value pairs commonly found in
 * wp-config.php and .htaccess files.
 *
 * @param string $content Raw file content.
 * @return array{0: string, 1: bool} Tuple of [redacted content, whether any values were replaced].
 */
function agentic_admin_redact_sensitive_data( string $content ): array {
	$was_redacted = false;

	// Redact any define() where the constant name looks sensitive.
	// Matches: DB_PASSWORD, DB_USER, DB_HOST, DB_NAME, *_KEY, *_SALT, *_SECRET, *_TOKEN, *_PASS*, *_CACHE_KEY_SALT, etc.
	$pattern = '/(\bdefine\s*\(\s*[\'"](?:DB_(?:PASSWORD|USER|HOST|NAME)|[A-Z0-9_]*(?:_KEY|_SALT|_SECRET|_TOKEN|_PASS(?:WORD)?))[\'"]\s*,\s*)[\'"][^\'"]*[\'"]/i';
	$new     = preg_replace( $pattern, '$1\'[REDACTED]\'', $content );
	if ( null !== $new && $new !== $content ) {
		$content      = $new;
		$was_redacted = true;
	}

	// Redact INI-style key = value patterns (e.g. in .htaccess or php.ini).
	$ini_keys = array( 'password', 'passwd', 'secret', 'api_key', 'apikey', 'auth_key', 'access_key', 'private_key' );
	foreach ( $ini_keys as $key ) {
		$ini_pattern = '/^(\s*' . preg_quote( $key, '/' ) . '\s*=\s*)\S+/im';
		$new         = preg_replace( $ini_pattern, '$1[REDACTED]', $content );

		if ( null !== $new && $new !== $content ) {
			$content      = $new;
			$was_redacted = true;
		}
	}

	return array( $content, $was_redacted );
}
