=== Agentic Admin ===
Contributors: schmitzoide
Tags: ai, sre, site reliability, webllm, abilities api
Requires at least: 6.9
Tested up to: 7.0
Requires PHP: 8.2
Stable tag: 0.11.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A privacy-first AI Site Reliability Engineer running entirely in the browser via WebLLM and the WordPress Abilities API.

== Description ==

Agentic Admin transforms your WordPress admin panel into an intelligent command center. Instead of navigating through multiple screens to diagnose issues, you simply describe your problem in plain English.

= Features =

* **100% Local AI**: Uses WebLLM to run Qwen 3 1.7B (default) or Qwen 2.5 7B directly in your browser via WebGPU
* **Privacy-First**: AI inference runs in your browser - your prompts and content are never sent to an AI service. A few abilities look up public data (CVE databases, WordPress.org checksums, web search); all are listed under External services
* **Zero Server Costs**: No GPU infrastructure needed - computation happens on the client
* **WordPress Abilities API**: Natively integrates with WordPress's official Abilities API
* **Natural Language Interface**: Describe problems in plain English, get intelligent solutions

= Requirements =

* WordPress 6.9+ (includes the Abilities API)
* PHP 8.2+
* Modern browser with WebGPU support (Chrome 113+, Edge 113+)

== Installation ==

1. Upload the `agentic-admin` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Navigate to "Agentic Admin" in your WordPress admin menu
4. Wait for the AI model to download (one-time, ~1.2GB for Qwen 3 1.7B or ~4.5GB for Qwen 2.5 7B)
5. Start chatting!

== Screenshots ==

1. The Agentic Admin chat tab in wp-admin, mid-conversation. The model has just answered a question about installed plugins by calling the `plugin-list` tool locally — full ReAct trace (user question, thought process, tool call, answer) visible.
2. First-run model download in progress. The Qwen 3 1.7B weights (~1.2 GB) are fetched from the MLC-AI / HuggingFace CDN — once per browser, cancellable, cached for subsequent sessions.
3. The Abilities browser, listing every tool the assistant can call against the WordPress Abilities API on this site.
4. Settings panel. Build the local knowledge base, see detected GPU + VRAM, tune context-window size per model based on your hardware, toggle thinking mode, and switch between the local engine (WebLLM + WebGPU), a remote OpenAI-compatible endpoint, or the WordPress 7.0 Connector.
5. Multi-step workflow execution. "Do a performance check" is recognized as a 2-step workflow — the assistant runs `site-health` and `error-log-read` in sequence, then summarizes the environment (WP version, PHP, memory, debug mode, error log status) in one answer.
6. WordPress 7.0 AI Connector integration. The Connector tab picks up any AI provider registered via WP 7.0's built-in Connector API — Anthropic, Google, OpenAI, or any third-party `ai_provider` plugin — and uses it as the model backend with zero extra setup.

== External services ==

This plugin runs AI locally in your browser by default, and your prompts and chat content are never sent to an AI service unless you explicitly enable the external LLM provider below.

Separately from AI inference, some abilities query public data sources to do their job: a security scan checks your plugin versions against CVE databases, a checksum verification compares your files against WordPress.org, and a web search sends your query to a search engine. Every external request the plugin makes is listed here:

**Model weights CDN (MLC-AI / HuggingFace)** — Always for the local engine.
On first use the browser downloads the selected model (Qwen 3 1.7B by default, ~1.2 GB) from `https://huggingface.co/mlc-ai/` and `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/`. Only HTTP GET requests for static model files are made; no prompts, admin data, or telemetry are sent. Weights are cached in the browser; subsequent sessions are offline.
HuggingFace terms: https://huggingface.co/terms-of-service — Privacy: https://huggingface.co/privacy

**Transformers.js library + embedding model (jsDelivr + Hugging Face)** — Only when the optional local knowledge base is enabled in settings.
This performs in-browser semantic embedding of your documentation and code so the assistant can answer from a local knowledge base; the computation runs entirely in your browser. The Transformers.js library is loaded from jsDelivr (`https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/`) and the embedding model (`Xenova/all-MiniLM-L6-v2`, ~23 MB, one-time) from Hugging Face. Both are static files cached in the browser after first use; no prompts or admin data are sent.
jsDelivr terms: https://www.jsdelivr.com/terms — Privacy: https://www.jsdelivr.com/privacy-policy-jsdelivr-net
Hugging Face terms: https://huggingface.co/terms-of-service — Privacy: https://huggingface.co/privacy

**External LLM provider (user-configured)** — Only when you switch the engine from "Local" to "Remote" in settings.
When enabled, chat messages, tool descriptions, and tool results are sent through this plugin's REST proxy (`/wp-json/agentic-admin/v1/llm-proxy/`) to the OpenAI-compatible endpoint URL you configure (e.g. Ollama, LM Studio, vLLM, OpenAI, Groq, Together). You choose the endpoint; the plugin does not preselect or default to any third-party provider. No data is sent until you save an endpoint and start a chat in Remote mode.

**DuckDuckGo HTML search** — Only when the optional `web-search` ability is invoked by the assistant.
The user's search query is sent to `https://html.duckduckgo.com/html/` over GET. No WordPress user data is sent.
DuckDuckGo terms: https://duckduckgo.com/terms — Privacy: https://duckduckgo.com/privacy

**NVD CVE database (NIST)** — Whenever the `security-scan` ability is invoked.
`security-scan` includes a plugin vulnerability check, so the names and versions of your active plugins are sent to `https://services.nvd.nist.gov/rest/json/cves/2.0` to look up known CVEs. No user data, post content, or credentials are sent.
NVD terms: https://nvd.nist.gov/developers/terms-of-use — Privacy: https://www.nist.gov/privacy-policy

**MITRE CVE API** — Only when the `security-scan` vulnerability check finds a CVE identifier and follows up on it.
The CVE ID (e.g. `CVE-2024-12345`) is sent to `https://cveawg.mitre.org/api/cve/` for details. No WordPress user data is sent.
MITRE terms: https://www.cve.org/Legal/TermsOfUse — Privacy: https://www.cve.org/Legal/PrivacyPolicy

**WordPress.org plugin checksums** — Only when the optional `verify-plugin-checksums` ability is invoked.
Installed plugin slugs and versions are sent to `https://downloads.wordpress.org/plugin-checksums/` and `https://plugins.svn.wordpress.org/` to verify file integrity against the official WordPress.org distribution.
WordPress.org policies: https://wordpress.org/about/privacy/

**WordPress.org core source (SVN)** — Only when the optional `verify-core-checksums` ability finds a modified core file and diffs are requested.
The original copy of that one file is fetched from `https://core.svn.wordpress.org/tags/{version}/` so the plugin can show you a diff against your local version. Only the WordPress version number and the core file path are sent, both of which are public information; no site data is transmitted. The checksum list itself comes from WordPress core's own `get_core_checksums()` function.
WordPress.org policies: https://wordpress.org/about/privacy/

== Source code and build process ==

Agentic Admin is fully open source under GPL-2.0-or-later. The complete, human-readable source — including the JavaScript/React sources behind the compiled assets in `build-extensions/` — is maintained in a public repository:

https://github.com/pluginslab/wp-agentic-admin

The files under `build-extensions/` are generated from the sources in `src/` with @wordpress/scripts (webpack). They include the JavaScript bundles (`index.js`, `sw.js`, `indexing-worker.js`, and code-split chunks), the CSS, and the voy-search vector-index WebAssembly module (`*.module.wasm`, built from its npm package; source: https://github.com/tantaraio/voy). To regenerate them from a checkout:

1. `npm install`
2. `npm run build`

There is no build step for the PHP. The WebLLM engine is bundled into the plugin from its npm package. The optional knowledge-base embedding library (Transformers.js) and all AI model weights are loaded at runtime from the providers documented under External services above; these are large provider-hosted files, not part of the plugin code.

== Changelog ==

= 0.11.0 =
* Renamed: Plugin is now "Agentic Admin". Text domain "agentic-admin", function prefix agentic_admin_*. WordPress.org submission-ready.
* Removed: feedback system, WebMCP bridge, voice input, file editing (write-file), and AI content generation (content-generate), plus three low-value abilities (backup-check, opcode-cache-status, disk-usage). Agentic Admin is a site health and maintenance assistant: it does not edit files or generate content. Removed code remains available in the project's git history.
* Security: blocked sensitive-column reads (user_email, user_pass) in query-database to prevent reconnaissance attacks (#166). Hardened query length cap and read-only verb gate.
* Security: escaped output in functions-abilities.php (#121). Documented direct-DB-call rationale in db-optimize and database-check.
* Docs: corrected the External services section. The CVE lookups were attributed to a `plugin-vulnerability-scan` ability that does not exist; they are made by `security-scan`. Added the previously undisclosed `core.svn.wordpress.org` fetch used by `verify-core-checksums` to build diffs. Replaced two absolute privacy claims that the section's own list contradicted.
* Compliance: removed deprecated load_plugin_textdomain() call, prefixed uninstall.php globals, fixed nonexistent Domain Path header, excluded CLOUDFEST_HACKATHON.md from distribution build.
* New: ability manifest as single source of truth for which abilities register, with a agentic_admin_enabled_abilities filter for selective override. PHP authoritative for PHP-backed abilities; JS adds back the JS-only ones.
* Fixed: thinking-disable setting now actually suppresses the streaming UI even when Qwen ignores /nothink (#181).
* Fixed: Settings panel is now a real tab (not a stateful cog toggle). No more lingering Chat-tab underline or stale-state regressions (#197).
* Fixed: Activate/Deactivate buttons on plugin-list rows now flip to the inverse action after a successful click (#179).
* Fixed: AI model no longer preloads on every wp-admin page, deferred until the user opens the sidebar for the first time (#116).
* Improved: post-tool summarization is brief (no re-listing items the user already sees in the tool result UI).
* Improved: ChatInput keyboard handling simplified (Space inserts a space, no push-to-talk hijacking).
* Improved: KB embedding moved to a Web Worker with persistent progress across tab switches.
* Pinned: Transformers.js CDN URL to @3.8.1 (was floating @3 range), privacy-first plugin shouldn't depend on a CDN range that can ship new code without a deliberate bump.
* Removed: 7 stale tab references and 6+ stale docs files (FEEDBACK-DEV.md).
* Tests: 96 unit tests passing, plus the new manifest test suite (7 cases), index test suite (6 cases), knowledge-base test suite (16 cases), and react-agent regression tests (3 cases for the per-call state cleanup fix).

= 0.10.0 =
* CloudFest Hackathon 2026 release: 78 PRs merged, 42+ abilities shipped by 11 contributors
* New: Plugin Abilities Platform, third-party plugins can auto-register abilities with the AI assistant
* New: Voice input via local Whisper model, all audio stays on-device
* New: In-browser RAG knowledge base with vector embeddings computed client-side
* New: Settings UI with GPU detection, context window tuning, and knowledge base toggle
* New: External AI provider support (Ollama, LM Studio, OpenAI, any compatible endpoint) via PHP REST proxy
* New: WebMCP bridge for external AI agents via navigator.modelContext
* New: "Check if Hacked" multi-step security workflow
* New: Gutenberg editor sidebar and admin bar chat integrations
* New: 28+ new abilities including web-search, security-scan, plugin vulnerability scanning, read-file, write-file, query-database, content-generate, and more
* New: E2E test runner mirroring browser ReAct loop
* New: CI/CD via GitHub Actions (PHP lint, JS lint, unit tests, build check)
* New: Feedback system with thumbs up/down stored locally
* New: Distribution zip for WordPress Playground compatibility
* Improved: WCAG 2.2 AA accessibility compliance
* Improved: GPU capability detection with f32 precision fallback
* Improved: Fuzzy plugin name matching for activate/deactivate actions

= 0.9.5 =
* New: Split Gutenberg Integration into three separate goals — Block Editor Chat Window (Goal 7), Update Post Content Ability (Goal 8), WASM Dev Docs Abilities (Goal 9)
* New: Goal 9 aligned with existing `feature/wasm-sqlite-devdocs` branch work (4 abilities, 11 tests)
* New: GitHub issues created for Goals 6-9 (#32-#35)
* New: Voice + Context Recording separated as Goal 1.5 (stretch)
* New: WebMCP Integration added as Goal 6 (stretch)
* Improved: CLOUDFEST_HACKATHON.md — all goals now follow consistent format, code examples stripped from stretch goals

= 0.9.4 =
* Updated: WebLLM upgraded from 0.2.80 to 0.2.82
* New: `/playground` Claude Code skill for spinning up WordPress Playground with the plugin mounted and activated

= 0.9.3 =
* New: ONBOARDING.md — step-by-step hackathon guide with project tour and role-specific instructions
* New: `/issue` Claude Code skill for creating GitHub issues via interview with codebase inspection
* Improved: CLOUDFEST_HACKATHON.md simplified — removed duplicated role descriptions and project summary, now links to ONBOARDING.md
* Improved: README.md updated with `/issue` skill in Claude Code integration table

= 0.9.2 =
* New: AI Fundamentals glossary with ~60 terms linked back to source chapters
* New: Chapter 13 — "Designing Abilities" guide for Writers and UX contributors
* New: End-to-end walkthrough in Chapter 8 tracing a message through the full system
* New: Testing guidance section in Chapter 11 for LLM Testers writing tool selection tests
* Improved: Trimmed overly theoretical content from Chapters 1, 2, and 5
* Improved: Deduplicated hardware requirements — Chapter 3 is now single source of truth
* Improved: INDEX.md updated with new "For Writers & Designers" section

= 0.9.1 =
* Cleaned up: Removed stale version annotations (v1.0–v2.0) from comments across 11 source files
* Fixed: model-loader.js comment incorrectly referenced Qwen2.5-7B instead of actual default Qwen3-1.7B
* Fixed: ARCHITECTURE.md listed v0.7.0 as current version, updated to v0.9.0
* Fixed: THIRD-PARTY-INTEGRATION.md referenced non-existent v1.4.1 for includeIf feature
* Improved: README.md release example updated to current versioning

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
