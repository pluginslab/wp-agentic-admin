<?php
/**
 * Web Search Ability
 *
 * Searches the web for documentation and troubleshooting.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the web-search ability.
 *
 * @return void
 */
function wp_agentic_admin_register_web_search(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/web-search',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Web Search', 'wp-agentic-admin' ),
			'description'         => __( 'Search the web for documentation and troubleshooting.', 'wp-agentic-admin' ),
			'category'            => 'sre-tools',
			'input_schema'        => array(
				'type'                 => 'object',
				'default'              => array( 'query' => '' ),
				'properties'           => array(
					'query'       => array(
						'type'        => 'string',
						'description' => __( 'Search query.', 'wp-agentic-admin' ),
					),
					'num_results' => array(
						'type'        => 'integer',
						'default'     => 5,
						'description' => __( 'Number of results to return.', 'wp-agentic-admin' ),
					),
				),
				'required'             => array( 'query' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'success' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether the search succeeded.', 'wp-agentic-admin' ),
					),
					'results' => array(
						'type'        => 'array',
						'description' => __( 'Search results.', 'wp-agentic-admin' ),
					),
					'total'   => array(
						'type'        => 'integer',
						'description' => __( 'Number of results.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_web_search',
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
			'keywords'       => array( 'search', 'google', 'look up', 'find', 'documentation', 'docs', 'how to' ),
			'initialMessage' => __( "I'll search the web for that...", 'wp-agentic-admin' ),
		)
	);
}

/**
 * Execute the web-search ability.
 *
 * Uses the DuckDuckGo Instant Answer API (no key required).
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_web_search( array $input = array() ): array {
	$query       = isset( $input['query'] ) ? sanitize_text_field( $input['query'] ) : '';
	$num_results = isset( $input['num_results'] ) ? min( absint( $input['num_results'] ), 10 ) : 5;

	if ( empty( $query ) ) {
		return array(
			'success' => false,
			'message' => 'No search query provided.',
			'results' => array(),
			'total'   => 0,
		);
	}

	// Use DuckDuckGo HTML search endpoint (returns real search results, no API key needed).
	$url      = 'https://html.duckduckgo.com/html/?q=' . rawurlencode( $query );
	$response = wp_remote_get(
		$url,
		array(
			'timeout'    => 15,
			'user-agent' => 'WP-Agentic-Admin/1.0 (WordPress Plugin)',
			'headers'    => array(
				'Accept' => 'text/html',
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return array(
			'success' => false,
			'message' => 'Search request failed: ' . $response->get_error_message(),
			'results' => array(),
			'total'   => 0,
		);
	}

	$html    = wp_remote_retrieve_body( $response );
	$results = wp_agentic_admin_parse_ddg_html( $html, $num_results );

	return array(
		'success' => true,
		'results' => $results,
		'total'   => count( $results ),
		'note'    => 'Search queries are sent to DuckDuckGo servers.',
	);
}

/**
 * Parse DuckDuckGo HTML search results.
 *
 * @param string $html        Raw HTML from DuckDuckGo.
 * @param int    $num_results Max results to return.
 * @return array Parsed results with title, url, snippet.
 */
function wp_agentic_admin_parse_ddg_html( string $html, int $num_results = 5 ): array {
	$results = array();

	if ( empty( $html ) ) {
		return $results;
	}

	// DuckDuckGo HTML results are in <div class="result"> or <div class="web-result">.
	// Each result has: <a class="result__a"> for title/URL, <a class="result__snippet"> for snippet.
	$dom = new \DOMDocument();
	// Suppress warnings from malformed HTML.
	libxml_use_internal_errors( true );
	$dom->loadHTML( '<?xml encoding="UTF-8">' . $html );
	libxml_clear_errors();

	$xpath = new \DOMXPath( $dom );

	// Find result links (title + URL).
	$links = $xpath->query( '//a[contains(@class, "result__a")]' );

	if ( false === $links || 0 === $links->length ) {
		return $results;
	}

	foreach ( $links as $index => $link ) {
		if ( count( $results ) >= $num_results ) {
			break;
		}

		$title = trim( $link->textContent );
		$href  = $link->getAttribute( 'href' );

		// DuckDuckGo wraps URLs in a redirect — extract the real URL.
		if ( preg_match( '/uddg=([^&]+)/', $href, $matches ) ) {
			$href = rawurldecode( $matches[1] );
		}

		// Skip ad results and empty URLs.
		if ( empty( $href ) || empty( $title ) || str_contains( $href, 'duckduckgo.com/y.js' ) ) {
			continue;
		}

		// Find the corresponding snippet.
		$snippet = '';
		$snippet_nodes = $xpath->query( '//a[contains(@class, "result__snippet")]' );
		if ( $snippet_nodes && $snippet_nodes->length > $index ) {
			$snippet = trim( $snippet_nodes->item( $index )->textContent );
		}

		$results[] = array(
			'title'   => $title,
			'url'     => $href,
			'snippet' => $snippet,
		);
	}

	return $results;
}
