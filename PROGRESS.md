# CloudFest Hackathon 2026 — Progress Tracker

Live progress for the WP Agentic Admin hackathon project. Updated as milestones are reached.

## Day 3 — March 22

### Settings Tab + Context Window Tuning + E2E Test Runner (PR #168)
- **Settings tab** with GPU detection (device, vendor, architecture, VRAM estimate), per-model context window dropdown defaulting to GPU-recommended value, thinking mode controls
- **Remote provider context window** — separate setting for Ollama/LM Studio/OpenAI (8K–128K)
- **E2E test runner** that mirrors the browser's exact ReAct loop flow

### Local In-Browser RAG (PR #115 by @ivdimova)
Privacy-first codebase search — **all in-browser, no external APIs**. PHP extracts code from active theme + plugins, chunks by function/class boundaries. Transformers.js (`all-MiniLM-L6-v2`, ~23MB) runs embeddings on CPU/WASM to avoid GPU contention. Voy-search for vector similarity, IndexedDB for persistence. Two new abilities: `codebase-index` and `code-search`.

### Bug Fixes (PRs #170, #167)
- **Thumbs down red icon** (PR #170 by @robert81) — CSS selector fix, thumbs down now shows red when active. Fixes #146.
- **External AI infrastructure** (PR #167 by @AlexanderMelde) — increased timeouts for slow local models, o1/o3/gpt-5 parameter mapping, URL normalization, better error messages. 91 lines of unit tests. Fixes #165.

### Voice Input with Local Whisper! (PR #178 by @moritzbappert)
On-device speech-to-text via **Whisper Tiny** (~40MB ONNX) running entirely in a Web Worker — no audio ever leaves the browser. Hold Space bar for push-to-talk (200ms threshold), 30s max with countdown, pulsing red glow during recording, transcribing wave overlay. iOS Safari fallback (audio/mp4 + WASM). Also fixes ReAct agent crash when LLM omits tool name.

### Placeholder Fix + Package Sync (PR #173 by @robert81)
Chat input now shows "Thinking..." during inference instead of stale "Load the AI model first". Fixes #147.

**42 abilities**, **55 PRs merged**, **10 contributors**.

---

## Day 2 — March 21

### Web Search + Dev Tooling + UX (PRs #97, #93, #98)
- **web-search** (PR #97 by @ivdimova) — search the web via DuckDuckGo HTML parsing, no API key needed. The ability @ivdimova was assigned to on Day 1 — now shipped! Closes issue #29.
- **high-performance notice** (PR #93 by @AlexanderMelde) — tip box suggesting `chrome://flags/#force-high-performance-gpu` for users with integrated GPUs
- **build-ability skill** (PR #98 by @ivdimova) — Claude Code interview-driven skill for scaffolding new abilities with patterns reference

### Feedback Thumbs Up/Down Merged! (PR #103, code by @janvogt)
Opt-in thumbs up/down rating on assistant messages. Feedback stored locally in the browser — nothing sent externally. Includes FeedbackOptInBanner, FeedbackTab in settings with rating stats, and server-side opt-in persistence via REST. Cherry-picked from @janvogt's PR #70 onto clean `dev` base.

### read-file + core/get-site-url (PRs #99, #104)
- **read-file** (PR #99 by @moritzbappert) — new contributor! Read WordPress files with code block rendering and sensitive data sanitization. 4/4 tests pass.
- **core/get-site-url** (PR #104 by @0xLoopTheory) — focused site URL query, JS-only ability. 2/2 tests pass.

### current-user-role + agent improvements + crash fix (PRs #138, #137, #136, #135)
- **current-user-role** (PR #138 by @0xLoopTheory) — "who am I logged in as?" / "am I an administrator?" 3/3 tests pass.
- **think after tool calls** (PR #137 by @AlexanderMelde) — LLM now reasons over raw JSON after tool results for better answers. Improved cron-list output with individual event listing. Tradeoff: slower but smarter.
- **crash fix** (PR #136 by @ivdimova) — missing closing brace in class-abilities.php caused PHP fatal
- **branch sync** (PR #135 by @janvogt) — synced nix flake from main into dev

### Remote Provider Fixes (PRs #119, #112)
- **wp-now WASM fallback** (PR #119 by @AlexanderMelde) — LLM proxy falls back to `wp_remote_post` when cURL is unavailable (wp-now/Playground). Streaming degrades gracefully.
- **auto-reconnect remote** (PR #112 by @0xLoopTheory) — page load now respects saved provider preference. If you last used a remote model, it auto-connects instead of loading local WebLLM.

### Interactive Action Buttons + Fine-Tuning Data (PRs #134, #142)
- **action buttons** (PR #134 by @tomepajk) — any ability can return an `actions` array and get interactive buttons in the chat. Plugin-list now shows Activate/Deactivate buttons inline. Bypasses LLM, respects confirmation modals. Also adds `/tools` slash command with AbilityPicker.
- **feedback upload** (PR #142 by @janvogt) — opted-in ratings (with full conversation context) are uploaded anonymously to S3 for model fine-tuning. Privacy copy updated. Closes issue #75.

### Prompt UX — Ability Bundles + Web Search Toggle (PR #140 by @Stefan0x)
Users can now constrain the AI to curated tool sets via a `+` icon in the input area — 6 bundles: Plugins & Themes, Performance, Security, Troubleshooting, Content & Users, Site Overview. Globe icon toggles web search as a pre-step. Send button appears when text is typed. `toolFilter` in ReAct agent constrains the system prompt without mutating global state.

### Security Suite v2 + Action Buttons Fix (PRs #95, #145 by @tomepajk)
- **role-capabilities-check** — detects privilege escalation (e.g., subscriber with admin caps)
- **file-scan** — scans PHP files in themes/plugins/mu-plugins for malware patterns (obfuscation, shell execution, backdoors)
- **uploads-scan** — scans uploads directory
- **Markdown table rendering** — structured security reports with proper tables
- **Hacked workflow** now chains 5 checks: core checksums → plugin checksums → database → file scan → role capabilities
- **Action buttons fix** (#145) — buttons now display correctly regardless of success flag

### Quality + Bug Fixes + Platform Extensions (PRs #157, #155, #154, #153, #152, #151, #159, #50)
- **Plugin vulnerability scanning** (PR #157 by @Lucisu) — new contributor! NVD + MITRE CVE cross-reference for installed plugins.
- **WCAG 2.2 AA accessibility** (PR #155 by @Stefan0x) — ARIA roles/labels, keyboard navigation, focus indicators, reduced motion support across entire chat UI.
- **Fuzzy plugin matching** (PR #154 by @tomepajk) — activate/deactivate now accepts display names with tiered matching and candidate buttons for ambiguous matches. Fixes #53.
- **Ability result status UI** (PR #153 by @0xLoopTheory) — three-state result display (success/info/error) instead of misleading green checkmark on failures. Fixes #74.
- **Prefix global functions** (PR #152 by @AlexanderMelde) — all public PHP functions now use `wp_agentic_admin_` prefix. Fixes #120.
- **Dynamic plugin bundles** (PR #151 by @BoweFrankema) — plugin abilities appear as selectable bundles in the chat dropdown.
- **Rewrite list categorization** (PR #159 by @Lucisu) — categorized rules with balanced sampling instead of raw dump. Fixes #56.
- **HTTP WebGPU error** (PR #50 by @robert81) — clear "please use HTTPS" message instead of confusing WebGPU error. Day 1 PR finally merged!

### Late Day 2 — WebMCP, wp-config, rewrite fix (PRs #161, #160, #162)
- **WebMCP bridge** (PR #161 by @ivdimova) — hackathon goal #32! All abilities exposed to external AI agents via Chrome's `navigator.modelContext` API. 19 unit tests, graceful degradation, two-step confirmation for destructive tools.
- **wp-config-list** (PR #160 by @moritzbappert) — JS-only ability that reads wp-config.php via read-file (gets redaction for free), parses `define()` calls, categorizes into 8 groups. Fixes #51.
- **Rewrite sampling fix** (PR #162 by @Lucisu) — fixes infinite loop bug in sampling logic from #159.

### Bug Fixes (PRs #164, #163, #50)
- **Remove beforeunload popup** (PR #164 by @tomepajk) — model persists via Service Worker, popup was firing constantly with admin bar sidebar.
- **Dry-run confirmation fix** (PR #163 by @ivdimova) — non-destructive operations no longer show red destructive button. Params-aware confirmation messages.
- **HTTP WebGPU error** (PR #50 by @robert81) — clear "please use HTTPS" message. Day 1 PR finally merged!

**40 abilities**, **49 PRs merged**, **10 contributors**.

### Plugin Abilities Platform! (PR #139 by @BoweFrankema)
Strategically the most important PR of the hackathon. The plugin is now an **open extensibility platform** — any WordPress plugin that registers abilities via the WP Abilities API gets AI support automatically. Includes: discover-plugin-abilities (queries the registry), run-plugin-ability (proxy executor), Plugin Abilities tab with toggle controls and token budget bar, dynamic system prompt integration.

---

## Day 1 — March 20 (Hackathon Kickoff)

### Infrastructure
- [x] **Dev branch workflow** — established `feature/*` → `dev` → `main` branching strategy
- [x] **`npm run playground`** — one-command WordPress Playground with plugin activated (PHP 8.3, WP 6.9, debug mode)
- [x] **`/assign` GitHub Action** — contributors can self-assign issues by commenting `/assign`
- [x] **Cross-linked scaling issues** — #20 (tool selection at scale) ↔ #37 (contextual skill loading)
- [x] **Contributor notes posted** on #37 with starting points, constraints, and dev setup

### AI Sidebar Everywhere + Kebab Menu (PRs #80, #91)
- **Admin bar sidebar** (PR #80 by @Stefan0x) — AI chat toggle in the WordPress admin bar, available on every wp-admin page. Slide-in panel with overlay, responsive mobile support, separate webpack entry point.
- **Model unload dropdown** (PR #91) — kebab menu replaces plain "Unload Model" button, room for future model actions.

The AI assistant is now accessible from **3 places**: the plugin settings page, the Gutenberg block editor, and every wp-admin page via the admin bar. **17 PRs merged**.

### 3 More PRs Merged! — write-file, query-database, website-hacked-check
- **write-file** (PR #89 by @ivdimova) — edit WordPress files with automatic backup and append mode
- **query-database** (PR #90 by @ivdimova) — read-only SQL queries for site inspection
- **website-hacked-check** (PR #88 by @tomepajk) — new contributor! 3 security abilities (verify-core-checksums, verify-plugin-checksums, database-check) plus a "check if hacked" workflow

That's **30 abilities**, **15 PRs merged**, **7 contributors**.

### CI/CD is Live! (PR #78 by @0xLoopTheory)
GitHub Actions now run on every PR to `dev` and `main` — PHP lint, JS lint, unit tests, and build check as independent matrix jobs. New contributor @0xLoopTheory. **13 PRs merged**, **6 contributors**.

### Gutenberg Editor Sidebar Merged! (PR #52 by @Stefan0x)
The biggest feature of the hackathon so far. The AI assistant now lives **inside the block editor** — you can ask questions while editing a post without leaving the page. Built as a `PluginSidebar` with its own webpack entry point, it reuses the existing WebLLM model via the Service Worker. Includes a new `core/get-editor-blocks` ability: ask "what blocks are on this page?" and get a structured summary of the editor contents. **25 abilities** total, **12 PRs merged**.

### 3 More Abilities Merged! — error-log-search, opcode-cache-status, backup-check
- **error-log-search** (PR #65) — search/filter the error log by keyword with context lines
- **opcode-cache-status** (PR #67) — check PHP OPcache status and hit rates
- **backup-check** (PR #72) — detect installed backup plugins and last backup status

Full suite **37/39 (95%)** — 2 pre-existing flaky tests. That's **24 abilities**, **11 PRs merged**, 5 contributors, and 3 more PRs in review.

### 2 More Abilities + Gutenberg Sidebar Approved! — security-scan, post-list, editor sidebar
- **security-scan** (PR #57) — 6 security checks grouped by severity
- **post-list** (PR #59) — list posts with natural language filters
- **editor sidebar** (PR #52 by @Stefan0x) — Gutenberg `PluginSidebar` with AI chat. **Merged!**
- **f32 fallback model** (PR #61 by @AlexanderMelde) — auto-detect `shader-f16` and fall back to f32. Changes requested on formatting.
- **HTTP error message** (PR #50 by @robert81) — specific error over HTTP. Changes requested to remove debug file.

### 4 More PRs Merged! — update-check, disk-usage, comment-stats, debug tooling
A batch of 4 PRs merged in one round — all tested together against Qwen 3 1.7B via Ollama, **29/29 (100%)** across all abilities:
- **update-check** (PR #42) — checks for available WordPress core, plugin, and theme updates
- **disk-usage** (PR #46) — wp-content disk usage breakdown (uploads, plugins, themes, cache) with recursive size calculation and depth limiting
- **comment-stats** (PR #49) — comment counts by status (approved, pending, spam, trash) via `wp_count_comments()`
- **system prompt printer** (PR #47) — debug utility to inspect the exact system prompt sent to the LLM

That's **19 abilities** total and **6 PRs merged** on Day 1.

### Second PR Merged! — user-list ability (PR #41 by @ivdimova)
A **user-list ability** that lists all WordPress users with roles, registration dates, and **masked emails** for privacy. Full suite **23/23 (100%)**.

### First PR Merged! — theme-list ability (PR #40 by @ivdimova)
Our first hackathon contribution! A **theme-list ability** listing installed themes with active/inactive status, version, and parent theme info. Full suite **21/21 (100%)**.

### Contributors
- ivdimova — theme-list (#40), user-list (#41), update-check (#42), disk-usage (#46), comment-stats (#49), testing-prompt (#47), security-scan (#57), post-list (#59), error-log-search (#65), opcode-cache-status (#67), backup-check (#72), write-file (#89), query-database (#90), web-search (#97), build-ability skill (#98)
- Stefan0x — editor sidebar (#52), admin bar sidebar (#80), model unload dropdown (#91)
- tomepajk — website-hacked-check (#88)
- 0xLoopTheory — CI/CD GitHub Actions (#78)
- AlexanderMelde — high-performance notice (#93)
- janvogt — nix flake (#81)
- BoweFrankema — instruction mode (#77, in review)
- robert81 — HTTP error message (#50, in review)

---

## Pre-Hackathon (through v0.9.5)

### Core Engine
- [x] Local LLM via WebLLM + WebGPU (Qwen 3 1.7B default, Qwen 2.5 7B alternative)
- [x] Service Worker model hosting — persists across page navigations
- [x] ReAct agent loop with 3-tier routing (workflow → ReAct → conversational)
- [x] Dual-mode: function-calling (Qwen 3) and prompt-based JSON (Qwen 2.5)
- [x] Streaming `<think>` blocks with collapsible UI
- [x] Post-tool nothink optimization for faster answers

### Abilities (33 total)
- [x] 29 plugin abilities: plugin list/activate/deactivate, theme list, user list, update check, disk usage, comment stats, security scan, post list, error log search, opcode cache status, backup check, write file, query database, web search, read file, verify core checksums, verify plugin checksums, database check, cache flush, db optimize, error log, cron list, revision cleanup, rewrite list/flush, site health, transient flush
- [x] 4 core WordPress wrappers: get-site-info, get-site-url, get-environment-info, get-editor-blocks

### Testing
- [x] 43 unit tests (Jest, mock LLM)
- [x] Ability test suite via Ollama (real Qwen 3 1.7B, 100% accuracy)
- [x] E2E test infrastructure

### Documentation
- [x] Architecture guide, Abilities guide, Workflows guide
- [x] 12-topic AI Fundamentals guide
- [x] CONTRIBUTING.md, SECURITY.md, LICENSE

---

## Planned / In Progress

| Issue | Title | Assignee | Status |
|-------|-------|----------|--------|
| #29 | web-search ability | ivdimova | Assigned |
| #37 | Contextual skill loading | — | Open |
| #12 | Sidebar toggle + slide-out panel | — | Open |
| #33 | Gutenberg sidebar integration | — | Open |
| #28 | query-database ability | — | Open |
| #26 | read-file ability | — | Open |
| #27 | write-file ability | — | Open |
| #30 | Edge AI consultation | — | Open |
| #31 | Google Prompt API bridge | — | Open |
| #32 | WebMCP integration | — | Open |
| #22 | CI/CD GitHub Actions | — | Open |

---

*Last updated: March 20, 2026*
