<?php
/**
 * Shared Diff Helper Functions
 *
 * Common diff functionality used across security abilities.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Fetch a remote file and generate a unified diff against a local file.
 *
 * @param string $original_url URL of the original file.
 * @param string $file_path    Absolute path to the local file.
 * @param string $old_label    Label for the original file in the diff header.
 * @param string $new_label    Label for the modified file in the diff header.
 * @return string|null Unified diff string, or null on failure.
 */
function wp_agentic_admin_get_remote_file_diff( string $original_url, string $file_path, string $old_label, string $new_label ): ?string {
	$response = wp_remote_get(
		$original_url,
		array( 'timeout' => 10 )
	);

	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return null;
	}

	$original_content = wp_remote_retrieve_body( $response );
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading local file for diff comparison.
	$local_content = file_get_contents( $file_path );

	if ( false === $local_content ) {
		return null;
	}

	$original_lines = explode( "\n", $original_content );
	$local_lines    = explode( "\n", $local_content );

	return wp_agentic_admin_generate_unified_diff( $original_lines, $local_lines, $old_label, $new_label );
}

/**
 * Generate a unified diff between two arrays of lines.
 *
 * Produces output similar to `git diff --unified=3`.
 *
 * @param array  $old_lines Lines from the original file.
 * @param array  $new_lines Lines from the modified file.
 * @param string $old_label Label for the original file.
 * @param string $new_label Label for the modified file.
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
	$output      = "--- {$old_label}\n+++ {$new_label}\n";
	$max_lines   = max( count( $old_lines ), count( $new_lines ) );
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
