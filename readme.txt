=== WP Neural Admin ===
Contributors: pluginslab
Tags: ai, sre, site reliability, webllm, abilities api
Requires at least: 6.7
Tested up to: 6.9
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A privacy-first AI Site Reliability Engineer running entirely in the browser via WebLLM and the WordPress Abilities API.

== Description ==

WP Neural Admin transforms your WordPress admin panel into an intelligent command center. Instead of navigating through multiple screens to diagnose issues, you simply describe your problem in plain English.

= Features =

* **100% Local AI**: Uses WebLLM to run a Small Language Model directly in your browser via WebAssembly and WebGPU
* **Privacy-First**: No admin data ever leaves your device - GDPR compliant by design
* **Zero Server Costs**: No GPU infrastructure needed - computation happens on the client
* **WordPress Abilities API**: Natively integrates with WordPress's official Abilities API
* **Natural Language Interface**: Describe problems in plain English, get intelligent solutions

= Requirements =

* WordPress 6.7+
* PHP 8.2+
* Modern browser with WebGPU support (Chrome 113+, Edge 113+)
* Abilities API plugin installed

== Installation ==

1. Install and activate the Abilities API plugin
2. Upload the `wp-neural-admin` folder to the `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Navigate to "Neural Admin" in your WordPress admin menu
5. Wait for the AI model to download (one-time, ~2.7GB)
6. Start chatting!

== Changelog ==

= 1.0.0 =
* Initial release
