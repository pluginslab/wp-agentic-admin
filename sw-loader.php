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
