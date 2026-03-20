# CloudFest Hackathon 2026 — Progress Tracker

Live progress for the WP Agentic Admin hackathon project. Updated as milestones are reached.

## Day 1 — March 20 (Hackathon Kickoff)

### Infrastructure
- [x] **Dev branch workflow** — established `feature/*` → `dev` → `main` branching strategy
- [x] **`npm run playground`** — one-command WordPress Playground with plugin activated (PHP 8.3, WP 6.9, debug mode)
- [x] **`/assign` GitHub Action** — contributors can self-assign issues by commenting `/assign`
- [x] **Cross-linked scaling issues** — #20 (tool selection at scale) ↔ #37 (contextual skill loading)
- [x] **Contributor notes posted** on #37 with starting points, constraints, and dev setup

### 3 More Abilities Merged! — error-log-search, opcode-cache-status, backup-check
- **error-log-search** (PR #65) — search/filter the error log by keyword with context lines
- **opcode-cache-status** (PR #67) — check PHP OPcache status and hit rates
- **backup-check** (PR #72) — detect installed backup plugins and last backup status

Full suite **37/39 (95%)** — 2 pre-existing flaky tests. That's **24 abilities**, **11 PRs merged**, 5 contributors, and 3 more PRs in review.

### 2 More Abilities + Gutenberg Sidebar Approved! — security-scan, post-list, editor sidebar
- **security-scan** (PR #57) — 6 security checks grouped by severity
- **post-list** (PR #59) — list posts with natural language filters
- **editor sidebar** (PR #52 by @Stefan0x) — Gutenberg `PluginSidebar` with AI chat. Approved, merging after conflict resolution.
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
- ivdimova — theme-list (#40), user-list (#41), update-check (#42), disk-usage (#46), comment-stats (#49), testing-prompt (#47), security-scan (#57), post-list (#59), error-log-search (#65), opcode-cache-status (#67), backup-check (#72)
- Stefan0x — editor sidebar (#52, approved), model unload dropdown (#71, in review)
- AlexanderMelde — f32 fallback model (#61, in review)
- robert81 — HTTP error message (#50, in review)
- janvogt — feedback thumbs up/down (#70, in review)

---

## Pre-Hackathon (through v0.9.5)

### Core Engine
- [x] Local LLM via WebLLM + WebGPU (Qwen 3 1.7B default, Qwen 2.5 7B alternative)
- [x] Service Worker model hosting — persists across page navigations
- [x] ReAct agent loop with 3-tier routing (workflow → ReAct → conversational)
- [x] Dual-mode: function-calling (Qwen 3) and prompt-based JSON (Qwen 2.5)
- [x] Streaming `<think>` blocks with collapsible UI
- [x] Post-tool nothink optimization for faster answers

### Abilities (24 total)
- [x] 22 plugin abilities: plugin list/activate/deactivate, theme list, user list, update check, disk usage, comment stats, security scan, post list, error log search, opcode cache status, backup check, cache flush, db optimize, error log, cron list, revision cleanup, rewrite list/flush, site health, transient flush
- [x] 2 core WordPress wrappers: get-site-info, get-environment-info

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
