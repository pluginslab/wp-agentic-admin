# WP Agentic Admin - CloudFest Hackathon

This document captures feature ideas and improvements aligned with CloudFest Hackathon goals. No version numbers, no timelines - what gets built first gets released first.

---

## 🏆 Hackathon Priorities

These features align with CloudFest Hackathon goals and are targeted for implementation during the event.

### 1. Chat UI - Right Sidebar
**Mission:** Move chat interface from settings page to a persistent right sidebar (like WP admin menu on left) that toggles with a button near "howdy USERNAME" at the top right.

**Why:** Makes the AI assistant always accessible without navigating to a specific page. Critical for keeping the Service Worker active across all admin pages, not just the settings page. Natural integration into WordPress admin workflow.

**Hackathon Goal:** Better UX integration for continuous workflow.

---

### 2. Expanded Abilities Library
**Mission:** Add 25+ new SRE and WordPress-specific abilities based on common admin tasks.

**Categories:**

**Site Management (6):**
- `theme-list` - List all installed themes with status
- `theme-activate` - Activate a specific theme
- `user-list` - List WordPress users with roles
- `user-role-update` - Change user role (with confirmation)
- `permalink-update` - Update permalink structure
- `maintenance-mode` - Enable/disable maintenance mode

**Content Operations (4):**
- `post-list` - List recent posts by type/status/author
- `post-publish` - Publish draft post with preview
- `comment-stats` - Get comment statistics
- `comment-moderate` - Bulk approve/spam comments

**Security & Diagnostics (5):**
- `error-log-search` - Search/filter debug.log by severity level (errors vs warnings) and keyword
- `security-scan` - Basic security checks (permissions, salts, versions)
- `backup-check` - Verify backup plugin status and last backup
- `update-check` - Check for WordPress/plugin/theme updates
- `disk-usage` - Check wp-content disk usage

**Filesystem (2):**
- `read-file` - Read WordPress files (theme templates, configs, logs). Must sanitize sensitive data (DB credentials, salts, API keys) before passing to LLM. Support partial reads (line ranges) for context window limits
- `write-file` - Edit WordPress files (configs, templates, code fixes). Requires confirmation prompts, creates backups before edits. Sensitive files (wp-config.php) require extra confirmation

**Database (1):**
- `query-database` - Read-only SQL queries (SELECT only) for inspecting options, post meta, user data. LLM builds query, results get summarized. Sanitize output to avoid leaking sensitive fields

**Cron (1):**
- `manage-cron` - List all scheduled WP-Cron events with next run times, add/remove cron jobs, diagnose missed or stuck events

**Media (1):**
- `manage-media` - List/search media library, get details (dimensions, file size, alt text), upload files, bulk update metadata. Could integrate with image optimization

**Web Search (1):**
- `web-search` - Search the web for documentation, troubleshooting, plugin compatibility. LLM formulates query, results get summarized. Could use SearXNG (self-hosted) or a public search API

**Performance (2):**
- `opcode-cache-status` - Check PHP OPcache status
- `slow-query-log` - Read MySQL slow query log

**Bonus:** 3 new workflows (security-audit, content-audit, pre-deployment-check)

**Hackathon Goal:** Expand abilities and workflows.

---

### 3. External AI Provider Support
**Mission:** Integrate external AI API support (Google AI API, WP AI Client proposal) alongside WebLLM for users who prefer cloud-based models or lack WebGPU-capable hardware.

**Why:** Provides fallback option and accessibility for users without modern GPUs. Gives users choice between privacy-first local execution and cloud-based convenience. Serves as the settings/configuration layer for users who don't want to use a local LLM.

**Technical:** Detect WebGPU availability → Offer external AI API as alternative → Same Abilities API, different execution backend.

**WP AI Client alignment:** Study WordPress core's AI Client proposal specifications and identify alignment points with our Abilities API. Position WP Agentic Admin as a reference implementation for WordPress AI integration. Ensure long-term compatibility with WordPress ecosystem.

**Edge AI Consultation:** The local LLM acts as a privacy gate — only non-sensitive queries (no PII, no site-specific data) get escalated to the cloud LLM via the WP 7.0 AI Client API. This gives the local model access to deeper reasoning/knowledge without compromising privacy. New ability: `consult-cloud-ai` for general coding questions, best practice lookups, complex reasoning tasks.

**Hackathon Goal:** Broader device compatibility, user choice, and WordPress ecosystem standards compliance.

---

### 4. Local Network LLM Consultation (LAN AI)
**Mission:** Ability to consult another LLM running on a separate local machine (e.g. Raspberry Pi, mini PC, NAS) on the same network. Everything stays on-premises — no data leaves the local network — while offloading heavier reasoning to a more capable model than what runs in the browser.

**Why:** A Raspberry Pi or mini server running Ollama/llama.cpp can handle 13B+ models that wouldn't fit in WebGPU. Combines the convenience of the browser agent with the power of a local server. Zero cloud dependency.

**Technical:**
- Connect to a local LLM server (Ollama, llama.cpp, vLLM) via internal IP
- Configurable endpoint in plugin settings (e.g. `http://192.168.1.x:11434`)
- Same privacy benefits as the browser model, but with more power
- New ability: `consult-local-llm`

**Hackathon Goal:** Maximum AI capability with zero cloud dependency.

---

## 💡 Future Features

Features to pursue after hackathon priorities are complete.

### Model Discovery & Experimentation
**Mission:** Allow searching, comparing, and swapping different models to find the best fit for various hardware and use cases.

**Features:**
- Browse compatible WebLLM models (filtered by VRAM requirements, quantization, capabilities)
- One-click model switching from the settings UI
- Benchmark/test a model against the abilities suite before committing
- Track performance metrics per model (accuracy, speed, memory usage)

**Why:** Different users have different hardware. A model that works great on a gaming GPU may be too large for integrated graphics. Users should be able to find the best model for their setup.

---

### Multi-Site Management
**Mission:** Manage multiple WordPress sites from a single interface.

**Features:**
- Site registry with encrypted credentials (browser storage)
- Cross-site operations: "Check health of all sites"
- Site comparison: plugin versions, configuration drift
- Bulk operations: deploy plugin to multiple sites

**Challenge:** Authentication security, API rate limits, handling offline sites.

---

### Scheduled Tasks & Automation
**Mission:** Proactive maintenance with scheduled workflows and alerting.

**Features:**
- Schedule workflows (daily, weekly, monthly)
- Email/browser notifications on critical issues
- Smart recommendations: "Database hasn't been optimized in 30 days"

**Implementation:** Use WP-Cron for scheduling, dashboard widget for results.

---

## 🔬 Architecture & Research

### Tool Selection at Scale
**Problem:** The ReAct agent presents all registered tools to the LLM — in prompt-based mode (small models without function calling) the entire tool list is dumped into the system prompt as text. With 14 abilities this works fine, but at 50-100+ abilities (especially with third-party extensions), the tool list alone could consume most of a small model's context window, leaving no room for the user message or reasoning.

Even in function calling mode (structured `tools` array), 100+ tool definitions is a lot for a 7B model to reason over reliably.

**Current state:** 14 abilities, ~2K tokens for the tool list. No issue yet, but this becomes a blocker before we hit 30+ abilities.

**Proposed approaches:**

**A. Two-stage selection** — A fast pre-filter (keyword matching, TF-IDF, or a tiny classifier) narrows 100 tools to ~5 candidates based on the user message, then only those 5 are passed to the LLM. Simple to implement, deterministic, but may miss tools with indirect relevance (e.g., "is debug mode enabled?" matching error-log-read).

**B. Semantic tool retrieval** — Embed all tool descriptions into vectors (using a small embedding model), retrieve top-K by cosine similarity to the user query. More robust than keyword matching, handles indirect relevance, but adds an embedding dependency and latency.

**C. Category-based routing** — Group tools into categories (diagnostics, performance, content, security). First ask the LLM to pick a category (cheap — only ~8 options), then show only the tools in that category. Clean UX, easy for third parties to register into categories, but multi-category queries ("check errors and optimize database") need special handling.

**Considerations:** Whatever approach we pick must work for third-party abilities too — the filtering/routing logic can't be hardcoded. The `description` field on abilities (added in v0.4.x) was designed with this in mind — it gives any future retrieval system a well-written sentence to match against.

**Implementation plan (RLM-inspired lazy loading):**

Based on [Recursive Language Models](https://arxiv.org/abs/2512.24601) (Zhang, Kraska, Khattab — Dec 2025) — the core insight being *don't load everything into context; search and load only what's needed*.

**Phase 1 — Lightweight tool search (no LLM cost):**
- Keep tools *outside* the LLM context entirely
- When a user message arrives, use the existing `MessageRouter` keyword matching + ability `description` fields to score and rank candidate tools
- Select the top 3-5 candidates based on keyword overlap and description relevance
- This phase is deterministic and instant — no model inference needed

**Phase 2 — Focused ReAct execution:**
- Inject *only* the selected tool schemas (full input/output params, annotations, confirmation requirements) into the ReAct system prompt
- The model now reasons with complete detail but over a minimal, relevant toolset
- Context savings: instead of ~2K+ tokens for all tools, ~400-600 tokens for 3-5 tools

**Phase 3 — Dynamic tool injection (the "recursive" part):**
- If the ReAct loop's observation reveals a need for a tool not in the initial set (e.g., `site-health` output mentions cron issues), the agent can request additional tools
- Add a meta-ability: `search-tools` — the model calls it with a description of what it needs, the system searches the full tool index, and injects the matching tool into the next iteration's context

**Example flow:**
```
User: "my site is slow"
  ↓
Phase 1: MessageRouter keyword match
  → candidates: [site-health, cache-flush, db-optimize]  (3 tools, ~500 tokens)
  ↓
Phase 2: ReAct with 3 tools
  → LLM: "Let me check site-health first"
  → Observation: "47 orphaned cron events detected"
  ↓
Phase 3: LLM calls search-tools("cron management")
  → System injects cron-list into context
  → LLM: "Let me list those cron events"
  → Final answer with full diagnosis
```

**Implementation notes:**
- The existing `keywords` array per ability is the index layer — already in place
- The `description` field (added in v0.4.x) provides the searchable text
- `search-tools` meta-ability should return tool name + description only; full schema injected on selection
- Fallback: if keyword matching finds 0 candidates, fall back to loading all tools (current behavior)
- Works for third-party abilities automatically — they already register with keywords and descriptions
- Embedding-based retrieval (option B) can be layered on later if keyword matching proves insufficient

---

### transformers.js / ONNX Runtime as Alternative Engine
**Status:** Explored, partially working. Parked in favor of WebLLM for now.

**What works:**
- transformers.js (@huggingface/transformers 3.8.1) loads `Qwen2.5-0.5B-Instruct` (q4, ~350MB) on WebGPU
- Service Worker persistence with WASM backend — model survives page navigation
- Auto-reconnect on page load (no re-download)
- OpenAI-compatible adapter (`TransformersEngine`) with native function calling via Qwen chat template
- WebGPU → WASM graceful fallback

**What doesn't work:**
- Models ≥1.5B fail with `Aborted()` during ONNX Runtime session creation
- Both WebGPU and WASM backends fail — ORT loads entire ONNX protobuf into WASM heap
- The bundled `onnxruntime-web@1.22.0-dev` (Emscripten WASM) hits memory limits with files >~500MB

**Why it matters:**
- transformers.js gives native function calling via Qwen chat templates (no prompt-based JSON hacking)
- `engine.supportsTools` auto-detection from tokenizer chat template

**Why WebLLM still wins (for now):**
- WebLLM uses TVM compiled to WebGPU shaders — weights go directly to GPU, bypassing WASM entirely
- Successfully loads 7B models (~5GB VRAM) on the same hardware
- No WASM memory bottleneck
- Service Worker persistence now works with WebLLM's `ServiceWorkerMLCEngineHandler`

**Investigation leads for hackathon:**
- The `tantara/transformers.js-chrome` reference repo loads `Qwen2.5-1.5B-Instruct` (q4f16) successfully with the same stack. Their Chrome extension environment (Plasmo bundler, clean context) differs from our WordPress admin (webpack, heavy page).
- Try `use_external_data_format: true` — splits ONNX graph from weights, may avoid WASM heap issue
- Try `transformers.js@4.0.0-next` which ships `onnxruntime-web@1.25` (newer, potentially fixed)
- Test in a minimal HTML page (not wp-admin) to isolate whether WordPress memory pressure is the culprit
- Compare webpack WASM handling with Plasmo bundler config
- Consider hybrid: WebLLM for inference, transformers.js for tokenizer/chat template only

**Key files (on the `transformers-js-experiment` branch, if preserved):**
- `src/extensions/services/model-loader.js` — env config, WebGPU/WASM fallback, SW auto-reconnect
- `src/extensions/services/transformers-engine.js` — OpenAI-compatible adapter
- `src/extensions/sw.js` — Service Worker with WASM backend
- `src/extensions/services/sw-engine.js` — Client-side SW proxy

**Critical env configuration (must be static import, module level):**
```js
import { env } from '@huggingface/transformers';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = undefined;
env.backends.onnx.wasm.proxy = false;
```

---

### RAG (Retrieval-Augmented Generation)
Embed WordPress documentation in vector database. Use RAG for technical questions: "How do I configure WP-Cron?" → Retrieve from docs + LLM summarizes.

---

### Multi-Modal Capabilities
- Screenshot analysis: "What's wrong with my site?"
- Visual diff detection for theme changes
- Chart generation for site metrics

---

### Code Generation
- Generate custom functions: "Create a shortcode that shows latest posts"
- Write plugin boilerplate
- Fix PHP errors with suggested code

---

### Natural Language to SQL
"Show me posts from last week with more than 10 comments" → LLM generates safe SQL query → Execute with proper sanitization.

---

## 🌐 Ecosystem & Community

### Community Building
**Mission:** Foster third-party extensions and grow the ecosystem.

**Activities:**
- Developer tutorials (video + written)
- Example plugins demonstrating patterns
- Ability marketplace (future)
- Hosting provider partnerships
- WordPress Plugin Directory submission

---

## 📝 Notes

**Hackathon Focus:** Top priorities are the Sidebar UI (#1), Expanded Abilities (#2), and External AI Provider Support (#3).

**Philosophy:** No version numbers. No rigid timelines. What gets done first gets released. Focus on making the core experience excellent before adding complexity.

**Priority Emerges:** If a feature becomes critical during development, it becomes a priority. Stay flexible.

**Community First:** Third-party developers can extend with custom abilities. We provide the foundation.
