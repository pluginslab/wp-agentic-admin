=== WP Neural Admin ===
Contributors: pluginslab
Tags: ai, sre, site reliability, webllm, abilities api
Requires at least: 6.9
Tested up to: 6.9
Requires PHP: 8.2
Stable tag: 1.2.0
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

* WordPress 6.9+ (includes the Abilities API)
* PHP 8.2+
* Modern browser with WebGPU support (Chrome 113+, Edge 113+)

== Installation ==

1. Upload the `wp-neural-admin` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Navigate to "Neural Admin" in your WordPress admin menu
4. Wait for the AI model to download (one-time, ~360MB)
5. Start chatting!

== Changelog ==

= 1.2.0 =
* Development version

= 1.1.0 =
* New: Multi-step workflow engine for chaining abilities together
* New: Built-in workflows: Site Cleanup, Performance Check, Plugin Audit, Database Maintenance
* New: `wp.neuralAdmin.registerWorkflow()` API for third-party workflow registration
* New: Workflow progress indicator in chat UI
* New: Ad-hoc workflow creation from multi-intent messages
* Changed: Default model upgraded to Qwen2.5-1.5B-Instruct for better reasoning (~1.6GB)
* Improved: Confirmation dialog shows all workflow steps before execution
* Improved: Automatic rollback of completed steps if later step fails

= 1.0.0 =
* Initial release
