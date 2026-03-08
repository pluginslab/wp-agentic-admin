# WP Agentic Admin - Ideas & Future Features

This document captures feature ideas and improvements aligned with CloudFest Hackathon goals. No version numbers, no timelines - what gets built first gets released first.

---

## 🏆 Hackathon Priorities

These features align with CloudFest Hackathon goals and are targeted for implementation during the event.

### 1. Chat UI - Right Sidebar
**Mission:** Move chat interface from settings page to a persistent right sidebar (like WP admin menu on left) that toggles with a button near "howdy USERNAME" at the top right.

**Why:** Makes the AI assistant always accessible without navigating to a specific page. Natural integration into WordPress admin workflow.

**Hackathon Goal:** Better UX integration for continuous workflow.

---

### 2. WP-CLI Testing Tool
**Mission:** Build a WP-CLI command that allows testing NLP calls as if using the chat interface, but from the command line for automated testing.

**Why:** Enable automated testing of natural language → ability mapping without manual browser interaction. Critical for regression testing as abilities grow.

**Example:** `wp agentic test "my site is slow"` → Returns which abilities would be triggered and their execution results.

**Hackathon Goal:** Enhance small model reliability through systematic testing.

---

### ~~3. SLM Strategy - Semantic Translation Layer~~ SUPERSEDED

**Status:** The upgrade to 7B models (Qwen2.5-7B) in v0.2.0 achieved 96% E2E accuracy *without* the semantic translation layer. 7B models handle fuzzy intent mapping natively. This approach is no longer needed.

---

### 4. Error Log Improvements
**Mission:** Show most recent errors instead of first N entries from debug.log.

**Current Problem:** Returns first entries, often showing old/irrelevant errors.

**Enhancement:** Filter by level (ERROR → WARNING → any), add timestamp highlighting (< 1 hour, < 24 hours, older).

**Hackathon Goal:** Better error handling and log analysis.

---

### 5. Expanded Abilities Library
**Mission:** Add 16 new SRE and WordPress-specific abilities based on common admin tasks.

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

**Security & Diagnostics (4):**
- `security-scan` - Basic security checks (permissions, salts, versions)
- `backup-check` - Verify backup plugin status and last backup
- `update-check` - Check for WordPress/plugin/theme updates
- `disk-usage` - Check wp-content disk usage

**Performance (2):**
- `opcode-cache-status` - Check PHP OPcache status
- `slow-query-log` - Read MySQL slow query log

**Bonus:** 3 new workflows (security-audit, content-audit, pre-deployment-check)

**Hackathon Goal:** Expand abilities and workflows.

---

### ~~6. Semantic Workflows - NLP Translation for Workflows~~ SUPERSEDED

**Status:** Depended on the SLM Strategy (#3). With 7B models, the ReAct loop already handles adaptive tool composition (96% accuracy), and keyword-based workflow detection covers common patterns. The LLM-composed workflow approach (option B) is effectively what the ReAct loop does already.

---

### 7. Google AI API Browser Extension Integration
**Mission:** Integrate Google AI API support alongside WebLLM for users who prefer cloud-based models or lack WebGPU-capable hardware.

**Why:** Provides fallback option and accessibility for users without modern GPUs. Gives users choice between privacy-first local execution and cloud-based convenience.

**Technical:** Detect WebGPU availability → Offer Google AI API as alternative → Same Abilities API, different execution backend.

**Hackathon Goal:** Broader device compatibility and user choice.

---

### 8. WP AI Client Core Proposal Adoption
**Mission:** Align with WordPress core's AI Client proposal to ensure compatibility with future WordPress AI standards.

**Why:** Position WP Agentic Admin as a reference implementation for WordPress AI integration. Ensure long-term compatibility with WordPress ecosystem.

**Research Needed:** Study WP AI Client proposal specifications and identify alignment points with our Abilities API.

**Hackathon Goal:** WordPress ecosystem integration and standards compliance.

---

## 💡 Future Feature Ideas

Features to pursue after hackathon priorities are complete.

### ~~Larger Model Support (7B+)~~ DONE

**Status:** Implemented in v0.2.0. Qwen2.5-7B is now the default model.

**Results:**
- 96% E2E pass rate (26/27 tests) — up from 74% with 3B models
- 100% JSON reliability (up from 63%)
- Multi-step reasoning, conditional logic, and goal completion all at 100%
- ~5GB VRAM, runs on consumer hardware with WebGPU
- No semantic translation layer needed — 7B models handle intent mapping natively

**Model:** Qwen 2.5 7B

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

### Community Building
**Mission:** Foster third-party extensions and grow the ecosystem.

**Activities:**
- Developer tutorials (video + written)
- Example plugins demonstrating patterns
- Ability marketplace (future)
- Hosting provider partnerships
- WordPress Plugin Directory submission

---

### 9. Tool Selection at Scale
**Problem:** The ReAct agent presents all registered tools to the LLM — in prompt-based mode (small models without function calling) the entire tool list is dumped into the system prompt as text. With 14 abilities this works fine, but at 50-100+ abilities (especially with third-party extensions), the tool list alone could consume most of a small model's context window, leaving no room for the user message or reasoning.

Even in function calling mode (structured `tools` array), 100+ tool definitions is a lot for a 7B model to reason over reliably.

**Current state:** 14 abilities, ~2K tokens for the tool list. No issue yet, but this becomes a blocker before we hit 30+ abilities.

**Proposed approaches (up for discussion):**

**A. Two-stage selection** — A fast pre-filter (keyword matching, TF-IDF, or a tiny classifier) narrows 100 tools to ~5 candidates based on the user message, then only those 5 are passed to the LLM. Simple to implement, deterministic, but may miss tools with indirect relevance (e.g., "is debug mode enabled?" matching error-log-read).

**B. Semantic tool retrieval** — Embed all tool descriptions into vectors (using a small embedding model), retrieve top-K by cosine similarity to the user query. More robust than keyword matching, handles indirect relevance, but adds an embedding dependency and latency.

**C. Category-based routing** — Group tools into categories (diagnostics, performance, content, security). First ask the LLM to pick a category (cheap — only ~8 options), then show only the tools in that category. Clean UX, easy for third parties to register into categories, but multi-category queries ("check errors and optimize database") need special handling.

**Considerations:** Whatever approach we pick must work for third-party abilities too — the filtering/routing logic can't be hardcoded. The `description` field on abilities (added in v0.4.x) was designed with this in mind — it gives any future retrieval system a well-written sentence to match against.

---

### 10. transformers.js / ONNX Runtime as Alternative Engine
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

## 🔬 Research & Experimental Ideas

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

## 📝 Notes

**Hackathon Focus:** The top 8 priorities align with CloudFest Hackathon goals. Items #1 and #2 (Sidebar UI + CLI Testing) are targeted for completion before/during the hackathon.

**Philosophy:** No version numbers. No rigid timelines. What gets done first gets released. Focus on making the core experience excellent before adding complexity.

**Priority Emerges:** If a feature becomes critical during development, it becomes a priority. Stay flexible.

**Community First:** Third-party developers can extend with custom abilities. We provide the foundation.
