<?php
/**
 * Docs Extract Ability
 *
 * Reads bundled markdown reference docs from docs/knowledge/ and chunks them
 * by heading boundaries for local RAG knowledge base indexing.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the docs-extract ability.
 *
 * @return void
 */
function wp_agentic_admin_register_docs_extract(): void {
	wp_agentic_admin_register_ability(
		'wp-agentic-admin/docs-extract',
		// PHP configuration for WordPress Abilities API.
		array(
			'label'               => __( 'Extract Reference Docs', 'wp-agentic-admin' ),
			'description'         => __( 'Extract bundled WordPress reference documentation for knowledge base indexing.', 'wp-agentic-admin' ),
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
					'chunks'      => array(
						'type'        => 'array',
						'description' => __( 'Doc section chunks.', 'wp-agentic-admin' ),
					),
					'total_files' => array(
						'type'        => 'integer',
						'description' => __( 'Total doc files processed.', 'wp-agentic-admin' ),
					),
				),
			),
			'execute_callback'    => 'wp_agentic_admin_execute_docs_extract',
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
			'keywords'       => array( 'docs', 'documentation', 'reference', 'extract docs' ),
			'initialMessage' => __( 'Extracting reference documentation...', 'wp-agentic-admin' ),
		)
	);
}

/**
 * Chunk a markdown file by heading boundaries (## or ###).
 *
 * @param string $content   File content.
 * @param string $file_name File name for chunk path.
 * @return array Array of chunk arrays.
 */
function wp_agentic_admin_chunk_markdown( string $content, string $file_name ): array {
	$lines       = explode( "\n", $content );
	$chunks      = array();
	$current     = array();
	$current_heading = '';
	$start_line  = 1;

	foreach ( $lines as $idx => $line ) {
		// Detect ## or ### headings (not # which is the doc title).
		if ( preg_match( '/^#{2,3}\s+(.+)$/', $line, $matches ) ) {
			// Save previous section if it has content.
			if ( ! empty( $current ) ) {
				$section_text = implode( "\n", $current );
				if ( strlen( trim( $section_text ) ) > 20 ) {
					$chunks[] = array(
						'path'       => 'docs://' . $file_name,
						'start_line' => $start_line,
						'end_line'   => $idx,
						'content'    => $section_text,
						'type'       => 'docs',
					);
				}
			}
			$current         = array( $line );
			$current_heading = $matches[1];
			$start_line      = $idx + 1;
		} else {
			$current[] = $line;
		}
	}

	// Save last section.
	if ( ! empty( $current ) ) {
		$section_text = implode( "\n", $current );
		if ( strlen( trim( $section_text ) ) > 20 ) {
			$chunks[] = array(
				'path'       => 'docs://' . $file_name,
				'start_line' => $start_line,
				'end_line'   => count( $lines ),
				'content'    => $section_text,
				'type'       => 'docs',
			);
		}
	}

	return $chunks;
}

/**
 * Execute the docs-extract ability.
 *
 * @param array $input Input parameters (unused).
 * @return array
 */
function wp_agentic_admin_execute_docs_extract( array $input = array() ): array {
	global $wp_filesystem;

	if ( ! $wp_filesystem ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
	}

	$docs_dir = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'docs/knowledge/';

	if ( ! is_dir( $docs_dir ) ) {
		return array(
			'success'     => false,
			'message'     => 'Knowledge docs directory not found.',
			'chunks'      => array(),
			'total_files' => 0,
		);
	}

	$md_files = glob( $docs_dir . '*.md' );

	if ( empty( $md_files ) ) {
		return array(
			'success'     => false,
			'message'     => 'No markdown files found in docs/knowledge/.',
			'chunks'      => array(),
			'total_files' => 0,
		);
	}

	$chunks      = array();
	$total_files = 0;

	foreach ( $md_files as $file_path ) {
		$content = $wp_filesystem->get_contents( $file_path );

		if ( false === $content || empty( trim( $content ) ) ) {
			continue;
		}

		$file_name   = basename( $file_path, '.md' );
		$file_chunks = wp_agentic_admin_chunk_markdown( $content, $file_name );
		$chunks      = array_merge( $chunks, $file_chunks );
		++$total_files;
	}

	return array(
		'success'     => true,
		'chunks'      => $chunks,
		'total_files' => $total_files,
	);
}
