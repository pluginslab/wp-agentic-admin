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

### 3. SLM Strategy - Semantic Translation Layer
**Mission:** Implement nano-embedding model (Xenova/all-MiniLM-L6-v2, ~23MB) as a "translator" layer between user intent and the small language model. Use vector similarity matching to bridge the gap between natural language and technical commands.

**Why:** Small 1.5B-3B models excel at syntax but struggle with fuzzy intent mapping. The semantic translation layer solves: error recovery, JSON output robustness, prompt engineering, and question detection - all at once.

**Technical:** User says "site feels heavy" → Embedding model matches to `db-optimize` → Context injected into SLM prompt → Grammar-constrained JSON output.

**Impact:** Handles model updates, quantization testing, and WebLLM library updates naturally as part of implementation.

**Hackathon Goal:** Improve local LLM reasoning and tool selection + enhance small model reliability.

> **Update (v0.2.0):** The upgrade to 7B models (Qwen2.5-7B) achieved 96% E2E accuracy *without* the semantic translation layer. This idea remains valuable as a potential optimization for lower-end hardware (where 3B models are the only option), but is no longer a critical priority.

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

### 6. Semantic Workflows - NLP Translation for Workflows
**Mission:** Extend semantic translation layer to handle workflow detection and composition. Enable both direct workflow matching (user intent → pre-defined workflow) and LLM-assisted composition (semantic translation helps LLM pick relevant abilities to chain together).

**Two Approaches:**

**A) Direct Workflow Matching** (simpler, first step)
- User: "something is broken"
- Embedding matches → "diagnostic workflow"
- Execute pre-defined workflow

**B) LLM-Composed Workflows** (more advanced)
- User: "something is broken"
- Semantic translation provides context about available abilities
- LLM composes: `[site-health, error-log-read, plugin-list]`
- Show preview → Execute with confirmation

**Dependency:** Requires SLM Strategy implementation first. Uses same embedding infrastructure for workflow matching.

**Hackathon Goal:** Expand abilities and workflows.

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

**Models available:** Qwen 2.5 7B (default), Hermes 2 Pro 7B, Llama 3.1 8B

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
