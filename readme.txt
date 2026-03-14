=== WP Agentic Admin ===
Contributors: pluginslab
Tags: ai, sre, site reliability, webllm, abilities api
Requires at least: 6.9
Tested up to: 6.9
Requires PHP: 8.2
Stable tag: 0.9.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A privacy-first AI Site Reliability Engineer running entirely in the browser via WebLLM and the WordPress Abilities API.

== Description ==

WP Agentic Admin transforms your WordPress admin panel into an intelligent command center. Instead of navigating through multiple screens to diagnose issues, you simply describe your problem in plain English.

= Features =

* **100% Local AI**: Uses WebLLM to run Qwen 3 1.7B (default) or Qwen 2.5 7B directly in your browser via WebGPU
* **Privacy-First**: No admin data ever leaves your device - GDPR compliant by design
* **Zero Server Costs**: No GPU infrastructure needed - computation happens on the client
* **WordPress Abilities API**: Natively integrates with WordPress's official Abilities API
* **Natural Language Interface**: Describe problems in plain English, get intelligent solutions

= Requirements =

* WordPress 6.9+ (includes the Abilities API)
* PHP 8.2+
* Modern browser with WebGPU support (Chrome 113+, Edge 113+)

== Installation ==

1. Upload the `wp-agentic-admin` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Navigate to "Agentic Admin" in your WordPress admin menu
4. Wait for the AI model to download (one-time, ~1.2GB for Qwen 3 1.7B or ~4.5GB for Qwen 2.5 7B)
5. Start chatting!

== Changelog ==

= 0.9.0 =
* New: CloudFest Hackathon 2026 preparation with 28 GitHub issues across 7 contributor roles
* New: CLOUDFEST_HACKATHON.md with sharpened goals, team role definitions, and demo flow
* New: LICENSE file (GPL-2.0-or-later)
* New: SECURITY.md with vulnerability reporting policy
* New: GitHub labels for hackathon workflow (php, react-js, ai-ml, ux, docs, devops, testing, writers, ability, workflow, hackathon)
* New: README.md header image from CloudFest pitch deck
* Improved: CONTRIBUTING.md version requirement corrected to WordPress 6.9+
* Fixed: readme.txt changelog version numbering (internal 1.x versions renumbered to public 0.x scheme)

= 0.8.0 =
* New: `.claude/` project config with CLAUDE.md rules, settings, and 5 contributor skills
* New: `/release`, `/test`, `/new-ability`, `/update-docs`, `/pr` slash commands for Claude Code
* New: `.mcp.json` with wp-devdocs, wp-blockmarkup, and wp-playground MCP servers
* New: Chrome DevTools MCP plugin auto-enabled for E2E testing
* New: Pre-configured permissions (safe commands allowed, destructive commands denied)

= 0.7.1 =
* New: Ability metadata auto-loaded from JS source files — no static manifest to maintain
* New: Test suite expanded to 18 tests covering all 14 abilities (was 8 tests covering 5)
* Improved: JS lint fixes for test runner and helpers

= 0.7.0 =
* Changed: Ability test runner now uses Ollama (local LLM server) instead of Puppeteer + WebGPU browser
* Changed: Tests run in ~20s vs 5+ minutes — no browser, no WebGPU, no model download required
* Removed: Puppeteer dependency and browser-based test harness
* Removed: `build:test-harness` build step — `npm run test:abilities` runs directly via Node.js
* Improved: Test runner auto-installs Ollama via Homebrew and pulls models on first run

= 0.6.0 =
* New: 4 WP-CLI-inspired abilities for common maintenance tasks:
  * `transient-flush` - Delete expired or all transients (like `wp transient delete`)
  * `cron-list` - List scheduled cron events with overdue detection (like `wp cron event list`)
  * `rewrite-flush` - Flush permalink rewrite rules (like `wp rewrite flush`)
  * `revision-cleanup` - Delete old post revisions with preview mode (like `wp post delete` for revisions)
* New: WordPress 6.9 core abilities support - chat wrappers for `core/get-site-info` and `core/get-environment-info`
* New: Abilities browser now displays both Agentic Admin and WordPress core abilities
* New: Smart confirmation for revision cleanup (preview/dry-run skips confirmation)
* Improved: Better keyword separation to avoid triggering multiple abilities
* Improved: Chat session persistence across page refreshes
* Improved: Total of 14 abilities now available (12 custom + 2 core wrappers)
* Fixed: HTTP method for destructive abilities (now uses POST as required by Abilities API)

= 0.5.0 =
* New: Multi-step workflow engine for chaining abilities together
* New: Built-in workflows: Site Cleanup, Performance Check, Plugin Audit, Database Maintenance
* New: `wp.agenticAdmin.registerWorkflow()` API for third-party workflow registration
* New: Workflow progress indicator in chat UI
* New: Ad-hoc workflow creation from multi-intent messages
* Changed: Default model upgraded to Qwen3-1.7B for better reasoning with native function calling (~1.2GB)
* Improved: Confirmation dialog shows all workflow steps before execution
* Improved: Automatic rollback of completed steps if later step fails

= 0.1.0 =
* Initial release
