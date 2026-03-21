<?php
/**
 * Shared Plugin Helper Functions
 *
 * Common functionality used across plugin-related abilities to avoid code duplication.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get all installed plugins with their status.
 *
 * @param string $status_filter Optional. Filter by status: 'all', 'active', or 'inactive'. Default 'all'.
 * @return array Array with plugins list and counts.
 */
function wp_agentic_admin_get_all_plugins( string $status_filter = 'all' ): array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins    = get_plugins();
	$active_plugins = get_option( 'active_plugins', array() );
	$plugins        = array();
	$active_count   = 0;

	foreach ( $all_plugins as $plugin_file => $plugin_data ) {
		$is_active = in_array( $plugin_file, $active_plugins, true );

		// Apply status filter.
		if ( 'active' === $status_filter && ! $is_active ) {
			continue;
		}
		if ( 'inactive' === $status_filter && $is_active ) {
			continue;
		}

		if ( $is_active ) {
			++$active_count;
		}

		$plugins[] = array(
			'name'    => $plugin_data['Name'],
			'slug'    => $plugin_file,
			'version' => $plugin_data['Version'],
			'author'  => $plugin_data['Author'],
			'active'  => $is_active,
		);
	}

	return array(
		'plugins' => $plugins,
		'total'   => count( $plugins ),
		'active'  => $active_count,
	);
}

/**
 * Get plugin data by slug.
 *
 * @param string $plugin_file The plugin file path (slug).
 * @return array|null Plugin data array or null if not found.
 */
function wp_agentic_admin_get_plugin_by_slug( string $plugin_file ): ?array {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$all_plugins = get_plugins();

	if ( ! isset( $all_plugins[ $plugin_file ] ) ) {
		return null;
	}

	$is_active = is_plugin_active( $plugin_file );

	return array(
		'name'    => $all_plugins[ $plugin_file ]['Name'],
		'slug'    => $plugin_file,
		'version' => $all_plugins[ $plugin_file ]['Version'],
		'author'  => $all_plugins[ $plugin_file ]['Author'],
		'active'  => $is_active,
	);
}

/**
 * Activate a plugin by its slug.
 *
 * @param string $plugin_file The plugin file path (slug) to activate.
 * @return array Result with success status and message.
 */
function wp_agentic_admin_activate_plugin_by_slug( string $plugin_file ): array {
	$plugin_file = sanitize_text_field( $plugin_file );
	$plugin_data = wp_agentic_admin_get_plugin_by_slug( $plugin_file );

	// Check if plugin exists.
	if ( null === $plugin_data ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin file path */
				__( 'Plugin "%s" not found.', 'wp-agentic-admin' ),
				$plugin_file
			),
		);
	}

	$plugin_name = $plugin_data['name'];

	// Check if already active.
	if ( $plugin_data['active'] ) {
		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already active.', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	// Activate the plugin.
	$result = activate_plugin( $plugin_file );

	// Check if activation failed.
	if ( is_wp_error( $result ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: 1: plugin name, 2: error message */
				__( 'Failed to activate plugin "%1$s": %2$s', 'wp-agentic-admin' ),
				$plugin_name,
				$result->get_error_message()
			),
		);
	}

	// Verify activation.
	if ( ! is_plugin_active( $plugin_file ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Failed to activate plugin "%s".', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	return array(
		'success' => true,
		'message' => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been activated successfully.', 'wp-agentic-admin' ),
			$plugin_name
		),
	);
}

/**
 * Deactivate a plugin by its slug.
 *
 * @param string $plugin_file The plugin file path (slug) to deactivate.
 * @return array Result with success status and message.
 */
function wp_agentic_admin_deactivate_plugin_by_slug( string $plugin_file ): array {
	$plugin_file = sanitize_text_field( $plugin_file );
	$plugin_data = wp_agentic_admin_get_plugin_by_slug( $plugin_file );

	// Check if plugin exists.
	if ( null === $plugin_data ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin file path */
				__( 'Plugin "%s" not found.', 'wp-agentic-admin' ),
				$plugin_file
			),
		);
	}

	$plugin_name = $plugin_data['name'];

	// Check if already inactive.
	if ( ! $plugin_data['active'] ) {
		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Plugin "%s" is already inactive.', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	// Deactivate the plugin.
	deactivate_plugins( $plugin_file );

	// Verify deactivation.
	if ( is_plugin_active( $plugin_file ) ) {
		return array(
			'success' => false,
			'message' => sprintf(
				/* translators: %s: plugin name */
				__( 'Failed to deactivate plugin "%s".', 'wp-agentic-admin' ),
				$plugin_name
			),
		);
	}

	return array(
		'success' => true,
		'message' => sprintf(
			/* translators: %s: plugin name */
			__( 'Plugin "%s" has been deactivated.', 'wp-agentic-admin' ),
			$plugin_name
		),
	);
}

/**
 * Scan plugins for known vulnerabilities using the NVD API.
 *
 * TODO: This is a solution that does not required any API key, authentication, or an setup,
 * but it is not an extremely accurate wa for checking vulenrabilities and may produce false positives/negatives.
 * In the future we can consider integrating with a more reliable service via a partnership.
 *
 * @param string $status_filter Optional. Filter by status: 'all', 'active', or 'inactive'. Default 'all'.
 * @return array Array with plugins and their vulnerabilities.
 */
function wp_agentic_admin_scan_for_vulnerabilities( string $status_filter = 'active' ): array {
	$plugins_data = wp_agentic_admin_get_all_plugins( $status_filter );
	$plugins      = $plugins_data['plugins'];

	$total_vulnerabilities = 0;
	$scan_errors           = 0;
	$endpoint              = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

	foreach ( $plugins as $index => $plugin ) {
		$plugin_name    = sanitize_text_field( $plugin['name'] );
		$plugin_version = isset( $plugin['version'] ) ? (string) $plugin['version'] : '';
		$plugin_slug    = wp_agentic_admin_normalize_plugin_slug( isset( $plugin['slug'] ) ? (string) $plugin['slug'] : '' );

		$plugins[ $index ]['vulnerabilities']      = array();
		$plugins[ $index ]['vulnerability_count']  = 0;
		$plugins[ $index ]['has_vulnerabilities']  = false;
		$plugins[ $index ]['vulnerability_source'] = 'mitre';

		if ( '' === $plugin_name ) {
			continue;
		}

		$cache_key = 'wp_agentic_admin_nvd_' . md5( strtolower( $plugin_name ) );
		$response  = get_transient( $cache_key );

		if ( false === $response ) {
			$request_url = add_query_arg(
				array(
					'keywordSearch'     => $plugin_name,
					'keywordExactMatch' => '',
					'resultsPerPage'    => 30,
				),
				$endpoint
			);

			$headers = array(
				'Accept' => 'application/json',
			);

			$response = wp_remote_get(
				$request_url,
				array(
					'timeout' => 30,
					'headers' => $headers,
				)
			);

			set_transient( $cache_key, $response, 3 * HOUR_IN_SECONDS );
		}

		if ( is_wp_error( $response ) ) {
			$plugins[ $index ]['scan_error'] = $response->get_error_message();
			++$scan_errors;
			continue;
		}

		$status_code = (int) wp_remote_retrieve_response_code( $response );
		if ( 200 !== $status_code ) {
			$plugins[ $index ]['scan_error'] = sprintf(
				/* translators: %d: HTTP status code */
				__( 'NVD request failed with status code %d.', 'wp-agentic-admin' ),
				$status_code
			);
			++$scan_errors;
			continue;
		}

		$body    = wp_remote_retrieve_body( $response );
		$decoded = json_decode( $body, true );

		if ( ! is_array( $decoded ) || empty( $decoded['vulnerabilities'] ) || ! is_array( $decoded['vulnerabilities'] ) ) {
			continue;
		}

		foreach ( $decoded['vulnerabilities'] as $vulnerability ) {
			if ( empty( $vulnerability['cve'] ) || ! is_array( $vulnerability['cve'] ) ) {
				continue;
			}

			$cve    = $vulnerability['cve'];
			$cve_id = isset( $cve['id'] ) ? (string) $cve['id'] : '';

			if ( '' === $cve_id ) {
				continue;
			}

			$mitre_record = wp_agentic_admin_get_mitre_cve_record( $cve_id );
			if ( is_wp_error( $mitre_record ) ) {
				continue;
			}

			$mitre_match = wp_agentic_admin_is_plugin_version_affected_from_mitre(
				$plugin_name,
				$plugin_version,
				$plugin_slug,
				$mitre_record
			);

			if ( true !== $mitre_match ) {
				continue;
			}

			$cvss = wp_agentic_admin_extract_cvss_data( $cve );

			$plugins[ $index ]['vulnerabilities'][] = array(
				'cve_id'                  => $cve_id,
				'published'               => isset( $cve['published'] ) ? $cve['published'] : '',
				'last_modified'           => isset( $cve['lastModified'] ) ? $cve['lastModified'] : '',
				'description'             => wp_agentic_admin_extract_english_description( $cve ),
				'severity'                => isset( $cvss['severity'] ) ? $cvss['severity'] : '',
				'base_score'              => isset( $cvss['base_score'] ) ? $cvss['base_score'] : null,
				'vector'                  => isset( $cvss['vector'] ) ? $cvss['vector'] : '',
				'affected_version_source' => 'mitre',
			);
		}

		$plugins[ $index ]['vulnerability_count'] = count( $plugins[ $index ]['vulnerabilities'] );
		$plugins[ $index ]['has_vulnerabilities'] = $plugins[ $index ]['vulnerability_count'] > 0;
		$total_vulnerabilities                   += $plugins[ $index ]['vulnerability_count'];
	}

	$plugins_data['plugins']               = $plugins;
	$plugins_data['total_vulnerabilities'] = $total_vulnerabilities;
	$plugins_data['plugins_with_issues']   = count(
		array_filter(
			$plugins,
			static function ( array $plugin ): bool {
				return ! empty( $plugin['has_vulnerabilities'] );
			}
		)
	);
	$plugins_data['scan_errors']           = $scan_errors;
	$plugins_data['scanned_at']            = gmdate( 'c' );

	return $plugins_data;
}

/**
 * Normalize plugin file path to WordPress.org slug.
 *
 * @param string $plugin_file Plugin file path.
 * @return string
 */
function wp_agentic_admin_normalize_plugin_slug( string $plugin_file ): string {
	$plugin_file = trim( $plugin_file );

	if ( '' === $plugin_file ) {
		return '';
	}

	$directory = dirname( $plugin_file );
	if ( '.' !== $directory && '' !== $directory ) {
		return strtolower( sanitize_title( $directory ) );
	}

	return strtolower( sanitize_title( basename( $plugin_file, '.php' ) ) );
}

/**
 * Match plugin version using MITRE CVE affected/versions data.
 *
 * @param string $plugin_name    Installed plugin name.
 * @param string $plugin_version Installed plugin version.
 * @param string $plugin_slug    Installed plugin slug.
 * @param array  $mitre_record   MITRE CVE record payload.
 * @return bool|null True if affected, false if not affected, null if cannot decide.
 */
function wp_agentic_admin_is_plugin_version_affected_from_mitre( string $plugin_name, string $plugin_version, string $plugin_slug, array $mitre_record ): ?bool {
	if (
		empty( $mitre_record['containers']['cna']['affected'] ) ||
		! is_array( $mitre_record['containers']['cna']['affected'] )
	) {
		return null;
	}

	$normalized_version = ltrim( trim( $plugin_version ), 'vV' );
	$normalized_slug    = strtolower( trim( $plugin_slug ) );
	$evaluated_ranges   = false;
	$matched_package    = false;

	foreach ( $mitre_record['containers']['cna']['affected'] as $affected ) {
		$collection_url = isset( $affected['collectionURL'] ) ? trim( (string) $affected['collectionURL'] ) : '';
		$package_name   = isset( $affected['packageName'] ) ? strtolower( trim( (string) $affected['packageName'] ) ) : '';

		if ( trim( $plugin_name ) !== trim( $affected['product'] ) ) {
			if ( 'https://wordpress.org/plugins' !== $collection_url ) {
				continue;
			}

			if ( '' === $package_name || $package_name !== $normalized_slug ) {
				continue;
			}
		}

		$matched_package = true;

		$default_status = isset( $affected['defaultStatus'] ) ? strtolower( (string) $affected['defaultStatus'] ) : '';

		if ( empty( $affected['versions'] ) || ! is_array( $affected['versions'] ) ) {
			if ( 'affected' === $default_status ) {
				return true;
			}
			if ( 'unaffected' === $default_status ) {
				return false;
			}
			continue;
		}

		foreach ( $affected['versions'] as $version_rule ) {
			$status = isset( $version_rule['status'] ) ? strtolower( (string) $version_rule['status'] ) : $default_status;
			if ( '' === $status ) {
				continue;
			}

			if ( '' === $normalized_version ) {
				return 'affected' === $status;
			}

			$exact = isset( $version_rule['version'] ) ? trim( (string) $version_rule['version'] ) : '';
			$lt    = isset( $version_rule['lessThan'] ) ? wp_agentic_admin_normalize_mitre_bound( (string) $version_rule['lessThan'] ) : '';
			$lte   = isset( $version_rule['lessThanOrEqual'] ) ? wp_agentic_admin_normalize_mitre_bound( (string) $version_rule['lessThanOrEqual'] ) : '';

			$in_range = true;

			if ( '' !== $lt && version_compare( $normalized_version, $lt, '>=' ) ) {
				$in_range = false;
			}
			if ( '' !== $lte && version_compare( $normalized_version, $lte, '>' ) ) {
				$in_range = false;
			}

			if ( '' !== $exact && ! in_array( strtolower( $exact ), array( 'n/a', '*', 'all' ), true ) && '' === $lt && '' === $lte ) {
				$in_range = ( 0 === version_compare( $normalized_version, ltrim( $exact, 'vV' ) ) );
			}

			$evaluated_ranges = true;

			if ( $in_range ) {
				return 'affected' === $status;
			}
		}
	}

	if ( ! $matched_package ) {
		return false;
	}

	if ( $evaluated_ranges ) {
		return false;
	}

	return null;
}

/**
 * Retrieve CVE JSON from MITRE CVE API.
 *
 * @param string $cve_id CVE identifier.
 * @return array|WP_Error
 */
function wp_agentic_admin_get_mitre_cve_record( string $cve_id ) {
	$cve_id    = strtoupper( trim( $cve_id ) );
	$cache_key = 'wp_agentic_admin_mitre_' . md5( $cve_id );
	$cached    = get_transient( $cache_key );

	if ( false !== $cached ) {
		return $cached;
	}

	$request_url = 'https://cveawg.mitre.org/api/cve/' . rawurlencode( $cve_id );
	$response    = wp_remote_get(
		$request_url,
		array(
			'timeout' => 30,
			'headers' => array(
				'Accept' => 'application/json',
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		set_transient( $cache_key, $response, 15 * MINUTE_IN_SECONDS );
		return $response;
	}

	$status_code = (int) wp_remote_retrieve_response_code( $response );
	if ( 200 !== $status_code ) {
		$error = new WP_Error(
			'wp_agentic_admin_mitre_http_error',
			sprintf(
				/* translators: %d: HTTP status code */
				__( 'MITRE CVE request failed with status code %d.', 'wp-agentic-admin' ),
				$status_code
			)
		);
		set_transient( $cache_key, $error, 5 * MINUTE_IN_SECONDS );
		return $error;
	}

	$body    = wp_remote_retrieve_body( $response );
	$decoded = json_decode( $body, true );

	if ( ! is_array( $decoded ) ) {
		$error = new WP_Error(
			'wp_agentic_admin_mitre_invalid_json',
			__( 'Invalid MITRE CVE response.', 'wp-agentic-admin' )
		);
		set_transient( $cache_key, $error, 5 * MINUTE_IN_SECONDS );
		return $error;
	}

	set_transient( $cache_key, $decoded, 6 * HOUR_IN_SECONDS );

	return $decoded;
}

/**
 * Normalize MITRE version bounds like "<= 1.2.3" to "1.2.3".
 *
 * @param string $bound Version bound.
 * @return string
 */
function wp_agentic_admin_normalize_mitre_bound( string $bound ): string {
	$bound = trim( $bound );
	$bound = preg_replace( '/^[<>=\s]+/', '', $bound );

	return is_string( $bound ) ? ltrim( $bound, 'vV' ) : '';
}

/**
 * Extract the first English CVE description.
 *
 * @param array $cve CVE payload.
 * @return string
 */
function wp_agentic_admin_extract_english_description( array $cve ): string {
	if ( empty( $cve['descriptions'] ) || ! is_array( $cve['descriptions'] ) ) {
		return '';
	}

	foreach ( $cve['descriptions'] as $description ) {
		if ( isset( $description['lang'], $description['value'] ) && 'en' === $description['lang'] ) {
			return (string) $description['value'];
		}
	}

	if ( isset( $cve['descriptions'][0]['value'] ) ) {
		return (string) $cve['descriptions'][0]['value'];
	}

	return '';
}

/**
 * Extract CVSS severity details from CVE metrics.
 *
 * @param array $cve CVE payload.
 * @return array
 */
function wp_agentic_admin_extract_cvss_data( array $cve ): array {
	if ( empty( $cve['metrics'] ) || ! is_array( $cve['metrics'] ) ) {
		return array();
	}

	$metric_sets = array( 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2' );

	foreach ( $metric_sets as $set_key ) {
		if ( empty( $cve['metrics'][ $set_key ] ) || ! is_array( $cve['metrics'][ $set_key ] ) ) {
			continue;
		}

		$metric = $cve['metrics'][ $set_key ][0];

		if ( ! empty( $cve['metrics'][ $set_key ] ) ) {
			foreach ( $cve['metrics'][ $set_key ] as $candidate ) {
				if ( isset( $candidate['type'] ) && 'Primary' === $candidate['type'] ) {
					$metric = $candidate;
					break;
				}
			}
		}

		if ( empty( $metric['cvssData'] ) || ! is_array( $metric['cvssData'] ) ) {
			continue;
		}

		return array(
			'severity'   => isset( $metric['cvssData']['baseSeverity'] ) ? $metric['cvssData']['baseSeverity'] : '',
			'base_score' => isset( $metric['cvssData']['baseScore'] ) ? $metric['cvssData']['baseScore'] : null,
			'vector'     => isset( $metric['cvssData']['vectorString'] ) ? $metric['cvssData']['vectorString'] : '',
		);
	}

	return array();
}
