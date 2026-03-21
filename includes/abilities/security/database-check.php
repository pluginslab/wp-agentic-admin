<?php
/**
 * Database Security Check Ability
 *
 * Scans the WordPress database for common indicators of compromise:
 * injected scripts, base64-encoded payloads, eval() calls, rogue cron jobs,
 * suspicious admin users, SEO spam, and more.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the database-check ability.
 *
 * @return void
 */
function wp_agentic_admin_register_database_check(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/database-check',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Database Security Check', 'wp-agentic-admin' ),
			'description'         => __( 'Scan the WordPress database for indicators of compromise: injected scripts, base64 payloads, eval() calls, rogue cron jobs, and suspicious users.', 'wp-agentic-admin' ),
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
					'success'      => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the scan completed.', 'wp-agentic-admin' ),
					),
					'message'      => array(
						'type'        => 'string',
						'description' => __( 'Status message.', 'wp-agentic-admin' ),
					),
					'total_issues' => array(
						'type'        => 'integer',
						'description' => __( 'Total suspicious findings.', 'wp-agentic-admin' ),
					),
					'checks'       => array(
						'type'        => 'array',
						'description' => __( 'Results of each individual check.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_database_check',
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
			'keywords'       => array( 'database check', 'db security', 'scan database', 'malware database', 'injected code', 'base64', 'eval', 'spam pages', 'rogue cron', 'suspicious users' ),
			'initialMessage' => __( 'Scanning the database for indicators of compromise...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the database-check ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_database_check( array $input = array() ): array {
	// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Required parameter for callback signature.
	$checks       = array();
	$total_issues = 0;
	$total_raw    = 0;

	// Risk score threshold — only findings at or above this are flagged.
	$threshold = 6.0;

	// Run all checks.
	$check_functions = array(
		'wp_agentic_admin_check_options_base64',
		'wp_agentic_admin_check_options_eval',
		'wp_agentic_admin_check_options_suspicious_urls',
		'wp_agentic_admin_check_posts_scripts',
		'wp_agentic_admin_check_posts_base64_eval',
		'wp_agentic_admin_check_posts_iframes',
		'wp_agentic_admin_check_posts_hidden_links',
		'wp_agentic_admin_check_usermeta_injections',
		'wp_agentic_admin_check_suspicious_admins',
		'wp_agentic_admin_check_rogue_cron_jobs',
		'wp_agentic_admin_check_siteurl_integrity',
		'wp_agentic_admin_check_comments_injections',
		'wp_agentic_admin_check_widgets_injections',
	);

	foreach ( $check_functions as $func ) {
		$result = $func();

		// Filter findings to only those at or above the risk threshold.
		$all_findings      = $result['findings'];
		$filtered_findings = array_values(
			array_filter(
				$all_findings,
				function ( $f ) use ( $threshold ) {
					return isset( $f['risk_score'] ) && $f['risk_score'] >= $threshold;
				}
			)
		);

		$result['findings']       = $filtered_findings;
		$result['count']          = count( $filtered_findings );
		$result['total_raw']      = count( $all_findings );
		$result['filtered_below'] = count( $all_findings ) - count( $filtered_findings );

		$total_raw    += count( $all_findings );
		$total_issues += $result['count'];
		$checks[]      = $result;
	}

	$filtered_out = $total_raw - $total_issues;

	if ( 0 === $total_issues ) {
		$message = 0 === $total_raw
			? __( 'Database scan complete. No findings detected.', 'wp-agentic-admin' )
			: sprintf(
				/* translators: %d: number of low-risk findings filtered out */
				_n(
					'Database scan complete. No high-risk findings. %d low-risk finding was filtered out (below 6.0/10).',
					'Database scan complete. No high-risk findings. %d low-risk findings were filtered out (below 6.0/10).',
					$filtered_out,
					'wp-agentic-admin'
				),
				$filtered_out
			);
	} else {
		$message = sprintf(
			/* translators: 1: number of high-risk findings, 2: risk threshold, 3: number filtered out */
			__( 'Database scan complete. Found %1$d high-risk finding(s) (score >= %2$s/10). %3$d low-risk finding(s) filtered out.', 'wp-agentic-admin' ),
			$total_issues,
			number_format( $threshold, 1 ),
			$filtered_out
		);
	}

	return array(
		'success'        => true,
		'message'        => $message,
		'total_issues'   => $total_issues,
		'total_scanned'  => $total_raw,
		'filtered_out'   => $filtered_out,
		'risk_threshold' => $threshold,
		'checks'         => $checks,
	);
}

// ---------------------------------------------------------------------------
// Individual check functions.
// Each returns: [ 'name' => string, 'description' => string, 'count' => int, 'findings' => array ]
// ---------------------------------------------------------------------------

/**
 * Check options table for base64_decode payloads.
 *
 * Malware commonly stores base64-encoded payloads in wp_options to survive updates.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_options_base64(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT option_name, LEFT(option_value, 200) AS option_value_preview
			FROM {$wpdb->options}
			WHERE option_value LIKE %s
			LIMIT 50",
			'%' . $wpdb->esc_like( 'base64_decode' ) . '%'
		)
	);

	// Known legitimate options that may contain base64 references.
	$known_safe = array( 'active_plugins', 'uninstall_plugins', 'rewrite_rules', 'cron' );

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'option_name' => $row->option_name,
			'preview'     => $row->option_value_preview,
			'risk_score'  => in_array( $row->option_name, $known_safe, true ) ? 2.0 : 8.5,
		);
	}

	return array(
		'name'        => __( 'Options: base64_decode', 'wp-agentic-admin' ),
		'description' => __( 'Options containing base64_decode() calls — often used to hide malware.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check options table for eval() injections.
 *
 * eval() in stored options is almost always malicious.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_options_eval(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT option_name, LEFT(option_value, 200) AS option_value_preview
			FROM {$wpdb->options}
			WHERE option_value LIKE %s
			LIMIT 50",
			'%' . $wpdb->esc_like( 'eval(' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'option_name' => $row->option_name,
			'preview'     => $row->option_value_preview,
			'risk_score'  => 9.5, // eval() in options is almost always malicious.
		);
	}

	return array(
		'name'        => __( 'Options: eval() injections', 'wp-agentic-admin' ),
		'description' => __( 'Options containing eval() calls — a strong indicator of injected code.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check options for suspicious external URLs.
 *
 * Attackers inject redirect URLs or SEO spam links into options like
 * siteurl, home, or custom options.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_options_suspicious_urls(): array {
	global $wpdb;

	$suspicious_patterns = array(
		'%' . $wpdb->esc_like( '<script' ) . '%',
		'%' . $wpdb->esc_like( 'document.write' ) . '%',
		'%' . $wpdb->esc_like( 'window.location' ) . '%',
		'%' . $wpdb->esc_like( 'String.fromCharCode' ) . '%',
	);

	$where_clauses = array();
	$values        = array();
	foreach ( $suspicious_patterns as $pattern ) {
		$where_clauses[] = 'option_value LIKE %s';
		$values[]        = $pattern;
	}

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Dynamic number of LIKE patterns.
		$wpdb->prepare(
			"SELECT option_name, LEFT(option_value, 200) AS option_value_preview
			FROM {$wpdb->options}
			WHERE " . implode( ' OR ', $where_clauses ) . '
			LIMIT 50',
			...$values
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'option_name' => $row->option_name,
			'preview'     => $row->option_value_preview,
			'risk_score'  => 8.0, // JS injection in options is highly suspicious.
		);
	}

	return array(
		'name'        => __( 'Options: suspicious JavaScript', 'wp-agentic-admin' ),
		'description' => __( 'Options containing script tags, document.write, redirects, or obfuscated JS.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check published posts/pages for injected <script> tags.
 *
 * Legitimate posts rarely contain raw script tags — they typically use
 * WordPress shortcodes or blocks instead.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_posts_scripts(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_title, post_type
			FROM {$wpdb->posts}
			WHERE post_content LIKE %s
			AND post_status = 'publish'
			LIMIT 50",
			'%' . $wpdb->esc_like( '<script' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'post_id'    => (int) $row->ID,
			'title'      => $row->post_title,
			'post_type'  => $row->post_type,
			'risk_score' => 7.5, // Raw script tags in published content.
		);
	}

	return array(
		'name'        => __( 'Posts: injected scripts', 'wp-agentic-admin' ),
		'description' => __( 'Published posts/pages containing raw <script> tags.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check post content for base64_decode or eval() injections.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_posts_base64_eval(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_title, post_type
			FROM {$wpdb->posts}
			WHERE (post_content LIKE %s OR post_content LIKE %s)
			AND post_status = 'publish'
			LIMIT 50",
			'%' . $wpdb->esc_like( 'base64_decode' ) . '%',
			'%' . $wpdb->esc_like( 'eval(' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'post_id'    => (int) $row->ID,
			'title'      => $row->post_title,
			'post_type'  => $row->post_type,
			'risk_score' => 9.0, // base64/eval in post content is almost certainly malicious.
		);
	}

	return array(
		'name'        => __( 'Posts: base64/eval injections', 'wp-agentic-admin' ),
		'description' => __( 'Published posts containing base64_decode() or eval() calls.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check posts for suspicious iframe injections.
 *
 * While some iframes are legitimate (embeds), hidden iframes pointing to
 * external domains are a classic malware delivery technique.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_posts_iframes(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_title, post_type
			FROM {$wpdb->posts}
			WHERE post_content LIKE %s
			AND post_status = 'publish'
			LIMIT 50",
			'%' . $wpdb->esc_like( '<iframe' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'post_id'    => (int) $row->ID,
			'title'      => $row->post_title,
			'post_type'  => $row->post_type,
			'risk_score' => 5.5, // Iframes can be legitimate embeds; review needed.
		);
	}

	return array(
		'name'        => __( 'Posts: iframe injections', 'wp-agentic-admin' ),
		'description' => __( 'Published posts containing <iframe> tags — review for hidden malicious embeds.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check posts for hidden links (SEO spam).
 *
 * Attackers inject hidden links with display:none or visibility:hidden
 * to boost SEO for spam domains.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_posts_hidden_links(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_title, post_type
			FROM {$wpdb->posts}
			WHERE (post_content LIKE %s OR post_content LIKE %s)
			AND post_status = 'publish'
			LIMIT 50",
			'%' . $wpdb->esc_like( 'display:none' ) . '%',
			'%' . $wpdb->esc_like( 'visibility:hidden' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'post_id'    => (int) $row->ID,
			'title'      => $row->post_title,
			'post_type'  => $row->post_type,
			'risk_score' => 6.5, // Hidden content in posts — likely SEO spam.
		);
	}

	return array(
		'name'        => __( 'Posts: hidden content (SEO spam)', 'wp-agentic-admin' ),
		'description' => __( 'Published posts with display:none or visibility:hidden — may indicate injected SEO spam links.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check user meta for injected code.
 *
 * Attackers sometimes inject payloads into user meta fields to persist
 * across theme/plugin changes.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_usermeta_injections(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT user_id, meta_key, LEFT(meta_value, 200) AS meta_value_preview
			FROM {$wpdb->usermeta}
			WHERE meta_value LIKE %s
			OR meta_value LIKE %s
			OR meta_value LIKE %s
			LIMIT 50",
			'%' . $wpdb->esc_like( 'eval(' ) . '%',
			'%' . $wpdb->esc_like( 'base64_decode' ) . '%',
			'%' . $wpdb->esc_like( '<script' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'user_id'    => (int) $row->user_id,
			'meta_key'   => $row->meta_key,
			'preview'    => $row->meta_value_preview,
			'risk_score' => 9.0, // Code injection in user meta is almost always malicious.
		);
	}

	return array(
		'name'        => __( 'User meta: injected code', 'wp-agentic-admin' ),
		'description' => __( 'User meta fields containing eval(), base64_decode(), or script tags.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check for recently created administrator accounts.
 *
 * After gaining access, attackers often create new admin accounts
 * as a persistent backdoor. Lists all admins created in the last
 * 30 days for manual review.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_suspicious_admins(): array {
	$findings = array();

	$recent_admins = get_users(
		array(
			'role'         => 'administrator',
			'date_query'   => array(
				array(
					'after' => '30 days ago',
				),
			),
			'fields'       => array( 'ID', 'user_login', 'user_email', 'user_registered' ),
		)
	);

	foreach ( $recent_admins as $admin ) {
		$findings[] = array(
			'user_id'    => (int) $admin->ID,
			'login'      => $admin->user_login,
			'email'      => $admin->user_email,
			'registered' => $admin->user_registered,
			'risk_score' => 6.5, // Recent admin creation warrants review.
		);
	}

	return array(
		'name'        => __( 'Recently created admins', 'wp-agentic-admin' ),
		'description' => __( 'Administrator accounts created in the last 30 days — verify these are legitimate.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check for rogue cron jobs.
 *
 * Malware often registers persistent cron jobs that re-infect the site
 * or phone home to command-and-control servers.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_rogue_cron_jobs(): array {
	$findings = array();
	$crons    = _get_cron_array();

	if ( empty( $crons ) ) {
		return array(
			'name'        => __( 'Rogue cron jobs', 'wp-agentic-admin' ),
			'description' => __( 'Cron events with suspicious hook names or callbacks.', 'wp-agentic-admin' ),
			'count'       => 0,
			'findings'    => array(),
		);
	}

	// Known WordPress core cron hooks.
	$core_hooks = array(
		'wp_version_check',
		'wp_update_plugins',
		'wp_update_themes',
		'wp_scheduled_delete',
		'wp_scheduled_auto_draft_delete',
		'delete_expired_transients',
		'wp_privacy_delete_old_export_files',
		'wp_cron_delete_expired_personal_data_exports',
		'recovery_mode_clean_expired_keys',
		'wp_site_health_scheduled_check',
		'wp_https_detection',
	);

	// Suspicious patterns in hook names.
	$suspicious_patterns = array( 'eval', 'base64', 'exec', 'shell', 'backdoor', 'hack', 'payload', 'inject' );

	foreach ( $crons as $timestamp => $hooks ) {
		foreach ( $hooks as $hook => $events ) {
			// Skip known core hooks.
			if ( in_array( $hook, $core_hooks, true ) ) {
				continue;
			}

			$flags = array();

			// Check for suspicious patterns in hook name.
			foreach ( $suspicious_patterns as $pattern ) {
				if ( false !== stripos( $hook, $pattern ) ) {
					$flags[] = sprintf(
						/* translators: %s: suspicious pattern */
						__( 'hook name contains "%s"', 'wp-agentic-admin' ),
						$pattern
					);
				}
			}

			// Flag hooks with random-looking names (common in malware).
			if ( preg_match( '/^[a-f0-9]{8,}$/', $hook ) ) {
				$flags[] = __( 'hook name looks like a random hash', 'wp-agentic-admin' );
			}

			if ( ! empty( $flags ) ) {
				// Hash-like hook names are higher risk than keyword matches.
				$has_hash = preg_match( '/^[a-f0-9]{8,}$/', $hook );

				$findings[] = array(
					'hook'       => $hook,
					'next_run'   => gmdate( 'Y-m-d H:i:s', $timestamp ),
					'flags'      => $flags,
					'risk_score' => $has_hash ? 8.5 : 7.0,
				);
			}
		}
	}

	return array(
		'name'        => __( 'Rogue cron jobs', 'wp-agentic-admin' ),
		'description' => __( 'Cron events with suspicious hook names — may indicate persistent malware.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check if siteurl or home have been tampered with.
 *
 * Attackers change siteurl/home to redirect the entire site to a
 * malicious domain.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_siteurl_integrity(): array {
	$findings = array();

	// siteurl and home control where WordPress loads from and where it redirects.
	// If an attacker changes these, the entire site redirects to a malicious domain
	// or serves content from an attacker-controlled server.
	$siteurl = get_option( 'siteurl' );
	$home    = get_option( 'home' );

	// Check for mismatched domains between siteurl and home.
	$site_host = wp_parse_url( $siteurl, PHP_URL_HOST );
	$home_host = wp_parse_url( $home, PHP_URL_HOST );

	if ( $site_host !== $home_host ) {
		$findings[] = array(
			'issue'      => __( 'siteurl and home have different domains', 'wp-agentic-admin' ),
			'siteurl'    => $siteurl,
			'home'       => $home,
			'risk_score' => 8.0, // Domain mismatch is a strong indicator of hijacking.
		);
	}

	// Check for HTTP when HTTPS is expected (downgrade attack).
	if ( is_ssl() ) {
		if ( str_starts_with( $siteurl, 'http://' ) ) {
			$findings[] = array(
				'issue'      => __( 'siteurl uses HTTP but site is served over HTTPS', 'wp-agentic-admin' ),
				'siteurl'    => $siteurl,
				'risk_score' => 6.5, // May be misconfiguration, not necessarily malicious.
			);
		}
		if ( str_starts_with( $home, 'http://' ) ) {
			$findings[] = array(
				'issue'      => __( 'home uses HTTP but site is served over HTTPS', 'wp-agentic-admin' ),
				'home'       => $home,
				'risk_score' => 6.5,
			);
		}
	}

	return array(
		'name'        => __( 'Site URL integrity', 'wp-agentic-admin' ),
		'description' => __( 'Checks if siteurl or home option have been tampered with or misconfigured.', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check comments for injected scripts or spam links.
 *
 * Approved comments with script tags or excessive links may indicate
 * a compromised moderation flow or spam injection.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_comments_injections(): array {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT comment_ID, comment_post_ID, comment_author, LEFT(comment_content, 200) AS content_preview
			FROM {$wpdb->comments}
			WHERE comment_approved = '1'
			AND (comment_content LIKE %s OR comment_content LIKE %s OR comment_content LIKE %s)
			LIMIT 50",
			'%' . $wpdb->esc_like( '<script' ) . '%',
			'%' . $wpdb->esc_like( 'eval(' ) . '%',
			'%' . $wpdb->esc_like( 'base64_decode' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'comment_id' => (int) $row->comment_ID,
			'post_id'    => (int) $row->comment_post_ID,
			'author'     => $row->comment_author,
			'preview'    => $row->content_preview,
			'risk_score' => 7.0, // Code in approved comments indicates compromised moderation.
		);
	}

	return array(
		'name'        => __( 'Comments: injected code', 'wp-agentic-admin' ),
		'description' => __( 'Approved comments containing script tags, eval(), or base64_decode().', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}

/**
 * Check widget data for injected code.
 *
 * Text/HTML widgets are a common injection target since they store
 * raw HTML in the options table.
 *
 * @return array Check result.
 */
function wp_agentic_admin_check_widgets_injections(): array {
	global $wpdb;

	// Widget data is stored in options like widget_text, widget_custom_html, etc.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT option_name, LEFT(option_value, 300) AS option_value_preview
			FROM {$wpdb->options}
			WHERE option_name LIKE %s
			AND (option_value LIKE %s OR option_value LIKE %s OR option_value LIKE %s)
			LIMIT 50",
			$wpdb->esc_like( 'widget_' ) . '%',
			'%' . $wpdb->esc_like( '<script' ) . '%',
			'%' . $wpdb->esc_like( 'eval(' ) . '%',
			'%' . $wpdb->esc_like( 'base64_decode' ) . '%'
		)
	);

	$findings = array();
	foreach ( $rows as $row ) {
		$findings[] = array(
			'option_name' => $row->option_name,
			'preview'     => $row->option_value_preview,
			'risk_score'  => 8.0, // Code in widget data is highly suspicious.
		);
	}

	return array(
		'name'        => __( 'Widgets: injected code', 'wp-agentic-admin' ),
		'description' => __( 'Widget options containing script tags, eval(), or base64_decode().', 'wp-agentic-admin' ),
		'count'       => count( $findings ),
		'findings'    => $findings,
	);
}
