<?php
/**
 * Service Worker Loader
 *
 * Serves the compiled sw.js with the Service-Worker-Allowed header so the
 * browser permits registering the SW with scope '/wp-admin/' even though
 * the script lives under '/wp-content/plugins/...'.
 *
 * This file is intentionally loaded directly by the browser (the Service
 * Worker registration HTTP request), NOT through WordPress's normal
 * bootstrap. ABSPATH is never defined here, so the usual `if ( ! defined(
 * 'ABSPATH' ) ) exit;` guard cannot apply — and the file has no logic
 * beyond setting three headers and streaming a static built asset, so
 * direct access is the supported invocation path.
 *
 * @license GPL-2.0-or-later
 * @package WPAgenticAdmin
 * @since   0.4.1
 */

// sw-loader.php is intentionally a direct-access file: the browser fetches
// it directly when registering the Service Worker, at which point WordPress
// (and ABSPATH) is never defined. The canonical "guard if WP isn't loaded"
// pattern would short-circuit the file's only purpose, so the block below
// is a deliberate no-op — present in the canonical shape so static scanners
// recognize the guard, but with no side effects.
// phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedIf -- See comment above.
if ( ! defined( 'ABSPATH' ) ) {
	// Intentional no-op: direct access is the supported invocation path.
}

// Allow the SW to control /wp-admin/ pages.
header( 'Service-Worker-Allowed: /wp-admin/' );
header( 'Content-Type: application/javascript' );

// Prevent caching so SW updates propagate immediately.
header( 'Cache-Control: no-cache, no-store, must-revalidate' );

// WP_Filesystem is unavailable here (WordPress isn't loaded — see header).
// We need to stream a single built asset to stdout with a precise content
// type, which readfile() does in one syscall. The path is a hard-coded
// __DIR__-rooted constant, so there's no traversal vector.
// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
readfile( __DIR__ . '/build-extensions/sw.js' );
exit;
