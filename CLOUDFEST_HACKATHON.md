# WP Agentic Admin - CloudFest Hackathon 2026

## Where We Start

A working WordPress plugin (v0.8.0) with:
- A local AI assistant running Qwen 3 1.7B in the browser via WebGPU (no cloud, no API keys)
- 14 abilities (error logs, plugin management, caching, database optimization, site health, cron, revisions, etc.)
- 4 multi-step workflows (site cleanup, performance check, plugin audit, database maintenance)
- ReAct agent loop with 93-100% tool selection accuracy
- Service Worker model persistence across page navigations
- Full test suite (43 unit tests, 18 ability tests)
- Extensible Abilities API for third-party plugins

**The chat works, but it lives on its own settings page. The ability set covers SRE basics but misses common admin tasks. The AI only runs locally in WebGPU-capable browsers.**

---

## Hackathon Goals

### Goal 1: Sidebar UI (must-have)

Move the chat from its own admin page into a persistent right sidebar accessible from every wp-admin page.

**Starting point:** Chat only works on the Agentic Admin settings page.
**Done when:** A toggle button (near "Howdy, admin") opens a slide-out chat panel that works on any wp-admin page. The Service Worker keeps the model loaded across page navigations. Chat history persists.
**Demo:** Open any wp-admin page, click the toggle, ask "check site health", get a response — without ever leaving the page you were on.
**Skills needed:** React/JS, CSS, UX/Design

---

### Goal 2: Expanded Abilities (must-have)

Go from 14 to 25+ abilities covering the most common WordPress admin tasks.

**Starting point:** 14 abilities focused on SRE (error logs, cache, database, plugins, site health, cron, revisions, rewrites, transients).
**Done when:** At least 10 new abilities are merged, each with PHP backend, JS chat config, and a passing ability test. The AI can help with themes, users, content, security, and updates — not just SRE.
**Demo:** Ask the AI to "list users", "check for updates", "show disk usage", "run a security scan" — tasks that currently get no response.
**Skills needed:** PHP (WordPress plugin developers), Writers (use case definitions), LLM Testers

**Must-have abilities** (highest value, easiest to implement):
- `theme-list` - List all installed themes with status
- `user-list` - List WordPress users with roles
- `update-check` - Check for WordPress/plugin/theme updates
- `disk-usage` - Check wp-content disk usage
- `post-list` - List recent posts by type/status/author
- `comment-stats` - Get comment statistics
- `security-scan` - Basic security checks (permissions, salts, versions)
- `error-log-search` - Search/filter debug.log by severity and keyword
- `opcode-cache-status` - Check PHP OPcache status
- `backup-check` - Verify backup plugin status and last backup

**Stretch abilities** (higher complexity or narrower use case):
- `theme-activate` - Activate a specific theme (destructive)
- `user-role-update` - Change user role (destructive)
- `maintenance-mode` - Enable/disable maintenance mode
- `permalink-update` - Update permalink structure
- `post-publish` - Publish draft post with preview
- `comment-moderate` - Bulk approve/spam comments
- `read-file` - Read WordPress files with sensitive data sanitization
- `write-file` - Edit WordPress files with backup and confirmation
- `query-database` - Read-only SQL queries with output sanitization
- `manage-media` - List/search media library
- `slow-query-log` - Read MySQL slow query log
- `web-search` - Search the web for docs/troubleshooting

**Stretch workflows:**
- `security-audit` - security-scan → update-check → error-log-search
- `content-audit` - post-list → comment-stats → disk-usage
- `pre-deployment-check` - update-check → backup-check → site-health → error-log-read

---

### Goal 3: External AI Provider Support (stretch)

Add alternative AI backends for users without WebGPU, so the plugin works on any browser.

**Starting point:** Only WebLLM (local, WebGPU-only). No fallback.
**Done when:** Users can configure an external AI provider in settings. The same Abilities API works with both local and cloud models. WebGPU is auto-detected; if missing, the UI guides the user to configure a provider.
**Demo:** Open the plugin in Firefox (no WebGPU), configure a provider, use the chat normally.
**Skills needed:** React/JS, AI/ML, DevOps

**Provider options (any one is a win):**
- **Google Prompt API (Chrome built-in AI)** — Chrome ships Gemini Nano/Flash locally via `window.ai`. No API key needed, runs on-device. Requires a Chrome extension bridge to access the API from the WordPress admin context. This is the closest to our local-first philosophy — still on-device, just a different runtime.
- **Google AI API (Gemini)** — Cloud-based, requires API key. Good fallback for non-WebGPU browsers.
- **WP AI Client API (WordPress 7.0 proposal)** — Align with where WordPress core is heading for AI integration.

**Edge AI Consultation:** The local LLM acts as a privacy gate — only non-sensitive queries (no PII, no site-specific data) get escalated to the cloud LLM. This gives the local model access to deeper reasoning and knowledge without compromising privacy. New ability: `consult-cloud-ai`.

---

### Goal 4: LAN AI Consultation (stretch)

Connect to a local network LLM (Ollama, llama.cpp) for more powerful reasoning without cloud dependency.

**Starting point:** The browser model is the only reasoning engine.
**Done when:** Users can configure a local LLM endpoint (e.g. `http://192.168.1.x:11434`) in settings. A new `consult-local-llm` ability lets the browser agent escalate questions to the more powerful local model.
**Demo:** Configure an Ollama endpoint, ask a complex question, see the agent consult the local 13B+ model and return a better answer.
**Skills needed:** DevOps, AI/ML, PHP

---

### Goal 5: Advanced Abilities (stretch)

Abilities that go beyond read-only diagnostics — the agent can inspect files, query the database, search the web, and edit files.

**Starting point:** All abilities are WordPress API wrappers. The agent can't read arbitrary files, query the database, or access external information.
**Done when:** At least 2 of these advanced abilities are merged and working.
**Demo:** "What's in my wp-config.php?" → agent reads the file with credentials redacted. "How many posts have more than 10 comments?" → agent runs a safe SQL query. "How do I fix this error?" → agent searches the web and summarizes the answer.
**Skills needed:** PHP, AI/ML, DevOps

**Abilities:**
- `read-file` - Read WordPress files (theme templates, configs, logs). Sanitize sensitive data (DB credentials, salts, API keys) before passing to LLM. Support partial reads for context window limits.
- `write-file` - Edit WordPress files with confirmation prompts and automatic backups. Sensitive files (wp-config.php) require extra confirmation.
- `query-database` - Read-only SQL queries (SELECT only) for inspecting options, post meta, user data. LLM builds the query, results get summarized. Sanitize output to avoid leaking sensitive fields.
- `web-search` - Search the web for documentation, troubleshooting, plugin compatibility. LLM formulates the query, results get summarized. Could use SearXNG (self-hosted) or a public search API.

---

## What Success Looks Like (March 24 Main Stage)

**"We started with an AI assistant locked to one page with 14 tools. Now it's a sidebar on every admin page with 25+ tools. It reads your files, queries your database, searches the web, and works even without WebGPU — with two tiers of local AI and zero cloud required."**

The demo flow:
1. Open any wp-admin page → click sidebar toggle → AI is there
2. "Check for updates" → new ability responds (didn't exist before)
3. "Run a security scan" → new ability responds
4. "Do a full site cleanup" → existing workflow runs from the sidebar
5. (If Goal 5 done) "What's in my wp-config.php?" → agent reads file with credentials redacted
6. (If Goal 5 done) "How do I fix this error?" → agent searches the web and summarizes
7. (If Goal 3 done) Switch to Firefox → configure provider → same experience
8. (If Goal 4 done) Complex question → agent consults local 13B+ model on the network

---

## Team Roles

### PHP Developers

As a PHP developer, your job is to implement new abilities. Each ability is a self-contained PHP file in `includes/abilities/` that registers a REST endpoint via `register_agentic_ability()`. You'll work from use cases defined by Writers, follow the patterns in [ABILITIES-GUIDE.md](docs/ABILITIES-GUIDE.md), and coordinate with a JS developer who builds the chat-side counterpart. You know WordPress hooks, REST API, and functions like `get_plugins()`, `wp_count_posts()`, `WP_Debug_Data`.

### React/JS Developers

As a JS developer, your job spans two areas. First: for every new ability, you write the JavaScript file in `src/extensions/abilities/` that registers the chat interface — keywords, label, summarize function, execute function, parseIntent if needed. You pair with the PHP developer building the backend. Second: the sidebar UI — the biggest React task of the hackathon. Moving the chat panel from a dedicated page into a persistent sidebar that works on every wp-admin page. Stack is React via `@wordpress/element` and `@wordpress/scripts`.

### AI Enthusiasts

As an AI enthusiast, your job is to make the ReAct agent smarter. The agent currently sends all 14 tool descriptions to the LLM on every request — this won't scale to 30+. You'll work on tool selection at scale (pre-filtering tools before they hit the LLM), prompt optimization, and the external AI provider architecture. You should be comfortable reading `react-agent.js`, `message-router.js`, and the system prompt construction in `chat-orchestrator.js`. The [AI Fundamentals guide](docs/ai-fundamentals/INDEX.md) covers the full stack.

### LLM Testers

As an LLM tester, your job is to verify that the AI picks the right tool for the right user message. Every new ability needs test cases in `tests/abilities/core-abilities.test.js`. You write the natural language inputs a user would say, define which ability should be selected, and run the test suite against a local Qwen 3 1.7B via Ollama. You work in lockstep with PHP and JS developers — when they ship an ability, you ship the test. Run tests with `npm run test:abilities`.

### UX/Design Passionates

As a UX designer, your job is to make the AI assistant feel trustworthy and natural inside wp-admin. The sidebar interaction pattern (how it opens, how it sits alongside content, how it behaves on different screen sizes), the model loading experience (a 1.2GB download needs clear progress and expectations), confirmation dialogs for destructive actions, and the overall chat UX. You produce designs, mockups, or CSS that React/JS developers implement. Think about the WordPress admin user who has never used AI before.

### Writers

As a writer, your job is to invent new use cases for the AI assistant. Think about what a WordPress site admin does every day and ask: "could the AI help with this?" For each use case you define: what the user would say (natural language triggers), what the AI should do (which WordPress functions/data), what the response should look like, and whether it's read-only or destructive. Your output becomes the spec that PHP and JS developers build from. You don't need to code — you need to understand WordPress admin workflows. If a use case needs a new ability, great — you've just defined one.

### DevOps Experts

As a DevOps expert, your job is to think like a hosting company. You know what site admins and support staff deal with daily — server health, disk space, update cycles, cron issues, backup verification. You bring that operational perspective to the abilities we build and the ones we're missing. You also work on infrastructure: CI/CD workflows (GitHub Actions for linting and testing), the LAN AI feature (connecting to a local Ollama/llama.cpp server on the network), and WP Playground setup for quick testing. If you see an SRE use case we haven't thought of, flag it.

---

## 💡 Future Features

Features to pursue after hackathon priorities are complete, or who knows still during the hackathon.

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

**Must-have vs Stretch:** Goals 1 and 2 define hackathon success. Goals 3 and 4 are stretch — impressive if done, but the project is a win without them.

**How abilities get built:** A Writer defines the use case (what the user says, what should happen, what the response looks like). A PHP dev implements it. An LLM Tester writes the test case. Each ability is self-contained — see `ABILITIES-GUIDE.md`.

**Priority Emerges:** If a feature becomes critical during development, it becomes a priority. Stay flexible.

**Community First:** Third-party developers can extend with custom abilities. We provide the foundation.
