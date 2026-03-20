<?php
/**
 * Security Scan Ability
 *
 * Runs basic WordPress security checks.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the security-scan ability.
 *
 * @return void
 */
function wp_agentic_admin_register_security_scan(): void {
	register_agentic_ability(
		'wp-agentic-admin/security-scan',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Security Scan', 'wp-agentic-admin' ),
			'description'         => __( 'Run basic WordPress security checks.', 'wp-agentic-admin' ),
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
					'checks'   => array(
						'type'        => 'array',
						'description' => __( 'List of security check results.', 'wp-agentic-admin' ),
					),
					'summary'  => array(
						'type'        => 'object',
						'description' => __( 'Count by severity.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_security_scan',
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
			'keywords'       => array( 'security', 'secure', 'scan', 'vulnerability', 'hardening', 'permissions' ),
			'initialMessage' => __( "I'll run a basic security scan...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the security-scan ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_security_scan( array $input = array() ): array {
	$checks = array();

	// 1. Check WP_DEBUG in production.
	$checks[] = array(
		'check'    => 'Debug mode',
		'status'   => defined( 'WP_DEBUG' ) && WP_DEBUG ? 'fail' : 'pass',
		'severity' => 'warning',
		'message'  => defined( 'WP_DEBUG' ) && WP_DEBUG
			? 'WP_DEBUG is enabled. Disable in production.'
			: 'WP_DEBUG is disabled.',
	);

	// 2. Check WP_DEBUG_DISPLAY.
	$checks[] = array(
		'check'    => 'Debug display',
		'status'   => defined( 'WP_DEBUG_DISPLAY' ) && WP_DEBUG_DISPLAY ? 'fail' : 'pass',
		'severity' => 'critical',
		'message'  => defined( 'WP_DEBUG_DISPLAY' ) && WP_DEBUG_DISPLAY
			? 'WP_DEBUG_DISPLAY is on. Errors are visible to visitors.'
			: 'WP_DEBUG_DISPLAY is off.',
	);

	// 3. Check wp-config.php file permissions.
	$wp_config = ABSPATH . 'wp-config.php';
	if ( file_exists( $wp_config ) ) {
		$perms     = fileperms( $wp_config ) & 0777;
		$is_secure = $perms <= 0640;
		$checks[]  = array(
			'check'    => 'wp-config.php permissions',
			'status'   => $is_secure ? 'pass' : 'fail',
			'severity' => 'critical',
			'message'  => $is_secure
				? sprintf( 'Permissions are %s (secure).', decoct( $perms ) )
				: sprintf( 'Permissions are %s. Should be 640 or less.', decoct( $perms ) ),
		);
	}

	// 4. Check for default auth salts.
	$salt      = wp_salt( 'auth' );
	$is_default = ( 'put your unique phrase here' === $salt );
	$checks[]   = array(
		'check'    => 'Authentication salts',
		'status'   => $is_default ? 'fail' : 'pass',
		'severity' => 'critical',
		'message'  => $is_default
			? 'Using default salts. Generate new ones immediately.'
			: 'Custom salts are configured.',
	);

	// 5. Check WordPress version exposure.
	$checks[] = array(
		'check'    => 'Version in HTML',
		'status'   => has_action( 'wp_head', 'wp_generator' ) ? 'fail' : 'pass',
		'severity' => 'info',
		'message'  => has_action( 'wp_head', 'wp_generator' )
			? 'WordPress version is exposed in page source.'
			: 'WordPress version is hidden.',
	);

	// 6. Check directory listing.
	$uploads_dir  = wp_upload_dir();
	$uploads_path = $uploads_dir['basedir'];
	$htaccess     = $uploads_path . '/.htaccess';
	$index_file   = $uploads_path . '/index.php';
	$has_protect   = file_exists( $htaccess ) || file_exists( $index_file );
	$checks[]      = array(
		'check'    => 'Uploads directory listing',
		'status'   => $has_protect ? 'pass' : 'fail',
		'severity' => 'warning',
		'message'  => $has_protect
			? 'Uploads directory has listing protection.'
			: 'Uploads directory may allow directory listing.',
	);

	// Summary by severity.
	$summary = array(
		'critical' => 0,
		'warning'  => 0,
		'info'     => 0,
		'passed'   => 0,
		'failed'   => 0,
	);

	foreach ( $checks as $check ) {
		if ( 'fail' === $check['status'] ) {
			++$summary['failed'];
			++$summary[ $check['severity'] ];
		} else {
			++$summary['passed'];
		}
	}

	return array(
		'checks'  => $checks,
		'summary' => $summary,
	);
}
