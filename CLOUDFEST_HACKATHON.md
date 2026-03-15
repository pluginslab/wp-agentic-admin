# WP Agentic Admin - CloudFest Hackathon 2026

> **First time here?** Start with the [Onboarding Guide](ONBOARDING.md) — a walkthrough of the project, the codebase, and your role.

## Hackathon Goals

### Goal 1: Sidebar UI (must-have)

Move the chat from its own admin page into a persistent right sidebar accessible from every wp-admin page.

**Starting point:** Chat only works on the Agentic Admin settings page.
**Done when:** A toggle button (near "Howdy, admin") opens a slide-out chat panel that works on any wp-admin page. The Service Worker keeps the model loaded across page navigations. Chat history persists.
**Demo:** Open any wp-admin page, click the toggle, ask "check site health", get a response — without ever leaving the page you were on.
**Skills needed:** React/JS, CSS, UX/Design

---

### Goal 1.5: Voice + Context Recording (stretch UI + feature upgrade)

Add voice recording mode that captures speech + browser context for richer agent input.

**Starting point:** Users type text requests. Agent has no visibility into browser state, console errors, or what the user is looking at.
**Done when:** 🔴 Record button in chat captures audio (speech-to-text) + browser interactions (clicks, scrolls, console errors, network timing). Agent receives rich context and auto-selects abilities without explicit instructions.
**Demo:** User clicks record, navigates to a slow page, says "this is really slow and keeps throwing errors", clicks around showing the problem. Agent receives transcript + full browser context (URL, console errors, network timing, interaction log), automatically runs diagnostics (site-health, db-optimize, error-log-read), and returns: "Found 2400 post revisions slowing queries. Clean them up?"
**Skills needed:** React/JS (advanced), Service Workers, transformers.js, Browser APIs

**How it works:**
1. User clicks 🔴 record button in chat sidebar
2. MediaRecorder starts capturing audio
3. Event listeners track clicks, scrolls, text selections (with timestamps)
4. Console and network monitoring active
5. User navigates, interacts, describes issue verbally
6. User clicks stop → recording finalizes
7. Service Worker processes:
   - Audio → Whisper tiny (~40MB) → transcript with timestamps
   - Interaction events → synchronized event stream
   - Browser state → console errors, network timing, current URL
8. Agent receives enhanced message:
   ```json
   {
     transcript: "This page is really slow and keeps throwing errors",
     context: {
       url: "/wp-admin/edit.php",
       consoleErrors: ["TypeError at line 42"],
       timing: {ttfb: 3200, domContentLoaded: 8500},
       interactions: [
         {t: 1.2, type: "click", selector: ".error-notice"},
         {t: 2.8, type: "scroll", y: 350}
       ]
     }
   }
   ```
9. Agent's ReAct loop processes as a super-powered text message
10. Agent auto-selects abilities based on context (no manual tool picking by user)

**Why this matters:**
Users can **show** problems instead of **describing** them. Agent sees what they see (errors, slow timing, specific elements) and picks the right diagnostic abilities automatically.

**Traditional flow:**
```
User: "my site is slow"
Agent: "Let me check site health"
User: "also check database"
Agent: "Running db-optimize..."
User: "and check error logs"
```

**With voice + context:**
```
User: 🔴 [navigates to slow page, talks for 30 seconds while clicking around]
Agent: [sees context: high TTFB, console error, interactions with error notices]
Agent: [auto-runs: site-health, db-optimize, error-log-read]
Agent: "Found the issue: 2400 post revisions + JS error in theme. Fix them?"
```

**Implementation:**
- **Service Worker:** Whisper tiny (transformers.js) for local speech-to-text
- **Page script:** MediaRecorder, event listeners for clicks/scrolls/selections
- **IndexedDB:** Persist recording across page navigation
- **New abilities:** `start-voice-request`, `stop-voice-request`
- **Context injection:** Browser state (console, network, DOM) attached to transcript
- **Agent processing:** Existing ReAct loop handles enriched message

**Technical challenges:**
- Service Worker audio processing with Whisper (~40MB model)
- Synchronized event timestamps across audio and interactions
- Cross-navigation persistence (user navigates mid-recording)
- Privacy: keep audio/transcript local, never sent to cloud
- Performance: real-time transcription without blocking UI

**Priority:** Stretch goal. High impact for UX, significant dev effort. If completed, this would be a killer demo feature.

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

### Goal 6: WebMCP Integration (stretch)

Expose all abilities and workflows as WebMCP tools so external browser agents can invoke them.

**Starting point:** Abilities only callable via the internal ReAct agent in the sidebar chat.
**Done when:** Chrome 146's built-in DevTools MCP or other local agents (OpenClaw, Claude Code) can discover and invoke WP Agentic Admin abilities via the native `navigator.modelContext` API.
**Demo:** From a local agent (OpenClaw/Claude Code), navigate to wp-admin, invoke `site-health` ability via WebMCP, receive structured response. Agent chains multiple abilities (e.g., `site-health` → reads console for errors → `cache-flush` → `db-optimize`) with full browser state visibility (performance traces, network logs, console output).
**Skills needed:** React/JS, AI/ML, Chrome DevTools

**Implementation approach:**
- Register each ability via Chrome 146's `navigator.modelContext.registerTool()` imperative API
- Tool schema auto-generated from existing ability registration (name, description, input schema, execute function)
- Leverage `SubmitEvent.agentInvoked` to detect external agent calls vs internal chat
- Security: Only register tools when user is authenticated and on wp-admin pages
- Enable via `chrome://flags/#enable-webmcp-testing` (dev trial)

**Why this matters:**
Local agents (OpenClaw, Claude Code, etc.) gain structured access to WordPress operations without DOM scraping or brittle selectors. They can:
- Navigate to a WordPress site
- Invoke Lighthouse audit via Chrome's DevTools MCP → get performance report
- Check console for JS errors
- Read network trace to diagnose slow REST API calls
- Take memory snapshot to debug plugin leaks
- Call WP Agentic Admin abilities for WordPress-specific operations
- Chain multiple abilities with full browser state feedback

All **local**, all **real-time**, all **structured data** — the missing feedback loop for reliable WordPress automation.

**Stretch workflow example:**
```
Local agent task: "Debug why this WordPress site is slow"
  ↓
1. Chrome DevTools MCP: run Lighthouse audit
   → Response: "Largest Contentful Paint 4.2s, 47 orphaned cron events"
  ↓
2. WebMCP → WP Agentic Admin: invoke site-health
   → Response: "Critical: 47 cron events stuck, database size 2.4GB"
  ↓
3. Chrome DevTools MCP: read console logs
   → Response: "PHP Warning: mysql slow query 8.3s on wp_options"
  ↓
4. WebMCP → WP Agentic Admin: invoke cron-list
   → Response: [list of stuck cron events]
  ↓
5. WebMCP → WP Agentic Admin: invoke db-optimize
   → Confirmation prompt → User approves → Response: "Optimized 12 tables, reclaimed 340MB"
  ↓
Final answer: "Site slowness caused by stuck cron events and bloated database. 
Cleared 47 cron events and optimized database. LCP should improve to <2.5s."
```

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

See the [Onboarding Guide](ONBOARDING.md#part-2-your-role) for detailed role descriptions, workspace locations, starter files, and recommended reading for each role.

**Roles:** PHP Developers, React/JS Developers, AI Enthusiasts, LLM Testers, UX/Design Contributors, Writers, DevOps Experts.

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

**Must-have vs Stretch:** Goals 1 and 2 define hackathon success. Goals 3-5 are stretch — impressive if done, but the project is a win without them.

**Priority Emerges:** If a feature becomes critical during development, it becomes a priority. Stay flexible.

**Community First:** Third-party developers can extend with custom abilities. We provide the foundation.
