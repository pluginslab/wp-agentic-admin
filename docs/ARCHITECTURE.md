# WP-Agentic-Admin Architecture

This document explains the philosophical and architectural decisions behind WP-Agentic-Admin's approach to AI-assisted WordPress administration using the ReAct (Reasoning + Acting) pattern.

## Table of Contents

- [Philosophy](#philosophy)
- [Target Audience](#target-audience)
- [Design Principles](#design-principles)
- [ReAct Loop Architecture](#react-loop-architecture)
- [Workflow Detection](#workflow-detection)
- [Why Not Agent Skills Format?](#why-not-agent-skills-format)
- [Small Model Optimizations](#small-model-optimizations)
- [Testing](#testing)
- [Evolution](#evolution)
- [Codebase Overview](#codebase-overview)

---

## Philosophy

### The Core Question: Pre-planned vs Adaptive

During the development of WP-Agentic-Admin, we grappled with a fundamental question:

> **Should we pre-plan every action sequence, or let the AI adapt based on what it discovers?**

The answer is: **Mostly adaptive (ReAct), with pre-defined workflows for common patterns.**

### Our Approach

WP-Agentic-Admin uses a **ReAct (Reasoning + Acting) pattern** that balances:

1. **Adaptive execution** - AI decides tools based on observations
2. **Safety first** - Confirmations for destructive actions
3. **Local-first** - Works with 7B parameter models running on-device
4. **Workflow shortcuts** - Keyword-based triggers for common multi-step operations

### How ReAct Works

```
User: "My site is slow"
  ↓
AI: "I should check site health first"
  ↓
Tool: site-health → Returns database is 2.5GB
  ↓
AI: "Database is large, I should optimize it"
  ↓
Tool: db-optimize → Optimizes 15 tables
  ↓
AI: "Your database was causing slowness. I optimized it and saved 125MB."
```

The AI decides **one action at a time**, observing results and adapting its strategy. This is more flexible than pre-planned workflows but still reliable because:
- Max 10 iterations prevents infinite loops
- Repeated call detection stops oscillation
- Confirmation required for destructive actions
- Tool errors are observed and handled gracefully

---

## Target Audience

Our design decisions are optimized for these user personas:

### Primary: Site Admins & Hosting Companies

- **Non-technical WordPress site owners** who want AI assistance with maintenance
- **Hosting company support staff** who need intelligent troubleshooting
- **Require:** Reliability, safety, transparency

**What they need:**
- Natural language queries: "something is broken" → AI investigates intelligently
- Adaptive diagnostics: AI chooses tools based on what it finds
- Confirmation before destructive actions
- Clear explanations of what was done

### Secondary: Plugin Developers

- **WordPress developers** extending the system with new capabilities
- **Require:** Clear APIs, WordPress coding standards compliance, extensibility

**What they need:**
- Simple `register_agentic_ability()` API
- PHP/JavaScript dual registration pattern
- WordPress Abilities API integration
- Shared helper functions to avoid duplication

---

## Design Principles

### 1. WordPress-First

We extend the [WordPress Abilities API](https://developer.wordpress.org/news/2025/11/introducing-the-wordpress-abilities-api/) (introduced in WP 6.9) rather than creating a parallel system.

**Why:** Integration with core WordPress, REST API compliance, ecosystem alignment.

### 2. Adaptive by Default

The ReAct loop lets the AI adapt to what it discovers, rather than following rigid scripts.

**Why:** More flexible, handles edge cases better, feels more intelligent.

**Safety mechanisms:**
- Max iterations (10)
- Repeated call detection
- Confirmation for destructive actions
- Context window overflow handling

### 3. Local-First

Everything runs in the browser using WebLLM and WebGPU. No server-side AI required.

**Why:** Privacy, zero server costs, GDPR compliant by design.

**Service Worker Architecture:** The AI model is hosted in a Service Worker (`sw.js`) using `ServiceWorkerMLCEngineHandler` from WebLLM. This allows the model to persist in GPU memory across wp-admin page navigations — the model stays loaded as long as at least one browser tab is connected. Client pages communicate with the Service Worker via `postMessage`. This avoids re-downloading and re-loading the model on every page change.

### 4. Optimized for Local Models

Two models are available, both running locally via WebGPU:
- **Qwen 3 1.7B** (default in code, `Qwen3-1.7B-q4f16_1-MLC`) — Fast inference (~1.2GB), 93% E2E accuracy, native function calling
- **Qwen 2.5 7B** (alternative, `Qwen2.5-7B-Instruct-q4f16_1-MLC`) — Higher accuracy (96%), better multi-step reasoning (~4.5GB), prompt-based JSON mode

**Why:** Local models deliver 93–96% accuracy on agentic tasks while running on consumer hardware. No cloud API needed.

---

## ReAct Loop Architecture

### Message Routing

The router uses **3-tier routing** based on workflow detection, tool keyword matching, and action intent:

```
User Message
  ↓
1. Does it match a workflow keyword? (e.g., "full site cleanup")
   ↓ Yes → Execute Workflow (pre-defined steps)
   ↓ No
2. Does it contain a tool keyword + action verb? (e.g., "list plugins")
   ↓ Yes → ReAct Loop with thinking DISABLED (fast path, ~2-3s)
   ↓ No
3. Does it contain a tool keyword but no action? (e.g., "my site is slow")
   ↓ Yes → ReAct Loop with thinking ENABLED (ambiguous, needs reasoning)
   ↓ No
4. Is it a knowledge question about a tool topic? (e.g., "what is a transient?")
   ↓ Yes → Direct LLM (conversational, skip ReAct entirely)
   ↓ No
5. No tool relevance → Direct LLM (conversational)
```

This routing eliminates unnecessary LLM thinking for clear action commands (saving ~8-10s per interaction) while preserving full reasoning for ambiguous inputs. Knowledge questions bypass ReAct entirely and go straight to the LLM for a direct answer.

**How it works:** The router checks the user message against all registered tool `keywords` arrays. If a match is found, it checks for action verbs (`list`, `show`, `check`, `flush`, `optimize`, etc.) to determine intent. Knowledge question patterns (`what is`, `explain`, `define`, etc.) are routed to conversational mode. New abilities automatically participate in routing through their `keywords` — no changes to the router needed.

### ReAct Loop Flow

> **Note:** The ReAct agent supports TWO execution modes: **function-calling mode** (for models that support native tool use) and **prompt-based JSON mode** (for models that need structured prompts). The default model (Qwen 3 1.7B) uses function-calling mode with native tool use. The alternative model (Qwen 2.5 7B) uses prompt-based JSON mode. The mode is auto-detected on the first inference call.

```javascript
while (iteration < maxIterations) {
  // AI decides next action
  const action = await llm.chooseAction(observations);

  if (action.type === 'tool_call') {
    // Execute tool
    const result = await executeTool(action.tool, action.args);

    // Add to observations
    observations.push({ tool: action.tool, result });

    // Check for repeated calls
    if (lastTool === action.tool) {
      // Stop loop, provide summary
      return buildSummary(observations);
    }

    iteration++;
  } else if (action.type === 'final_answer') {
    // AI is done
    return action.content;
  }
}

// Max iterations reached
return "I reached the maximum number of steps...";
```

### Key Components

**1. React Agent (`react-agent.js`)**
- Core ReAct loop implementation
- Dual-mode support: Function calling + Prompt-based JSON
- Observation tracking
- Confirmation handling
- Error recovery

**2. Message Router (`message-router.js`)**
- 3-tier routing: workflow → ReAct → conversational
- Tool keyword matching against registered abilities
- Action intent detection (verb + keyword → fast ReAct without thinking)
- Knowledge question detection → direct LLM (skip ReAct)

**3. Tool Registry (`tool-registry.js`)**
- Registers all available abilities
- Converts to function calling format
- Handles tool execution

---

## Workflow Detection

For common multi-step operations, pre-defined workflows can be triggered via keywords:

### Why Workflows?

- **Efficiency:** Known patterns execute faster than ReAct exploration
- **Consistency:** Same steps every time for common tasks
- **User expectations:** "full site cleanup" should be comprehensive and predictable

### How It Works

```javascript
// Simplified overview - actual execution goes through WorkflowOrchestrator.execute()
// which handles: confirmation prompts, includeIf conditions, mapParams,
// rollback support, optional steps, and abort.
const workflow = workflowRegistry.detectWorkflow(userMessage);

if (workflow) {
  // WorkflowOrchestrator handles the full execution lifecycle:
  // - Prompts for confirmation if requiresConfirmation is set
  // - Evaluates includeIf conditions per step (may skip steps)
  // - Resolves mapParams from previous step results
  // - Tracks rollback stack for write operations
  // - Marks optional steps as skipped on failure instead of aborting
  // - Calls workflow.summarize() to build final user message
  await workflowOrchestrator.execute(workflow.id, { userMessage });
} else {
  // Fall back to ReAct loop
  await reactAgent.execute(userMessage);
}
```

### Workflow Examples

**"full site cleanup"** → Semi-flexible workflow:
1. Flush cache (always runs)
2. Optimize database (conditional `includeIf` -- skips if not needed, e.g., optimized recently or user did not mention database)
3. Check site health (always runs)

**"check site performance"** → Semi-flexible workflow:
1. Get site health info (always runs)
2. Read error log (optional, with `includeIf` condition -- only runs if debug mode is enabled or user mentioned errors)

**"my site is slow"** → ReAct loop (adaptive):
- AI decides what to check first
- Adapts based on findings
- May call different tools depending on the situation

---

## Why Not Agent Skills Format?

We considered using the [Agent Skills specification](https://github.com/microsoft/autogen/tree/main/autogen/skills) but chose a simpler approach:

### Agent Skills (Rejected)

```yaml
skills:
  - name: database-cleanup
    steps:
      - check-db-size
      - optimize-if-large
      - verify-result
```

**Downsides:**
- Another spec to learn
- Over-engineering for our use case
- Doesn't leverage WordPress Abilities API
- Complex for third-party developers

### WordPress Abilities (Chosen)

```php
register_agentic_ability('wp-agentic-admin/db-optimize', [
    'label' => 'Optimize Database',
    'description' => 'Optimize database tables',
    'category' => 'sre-tools',
]);
```

**Benefits:**
- WordPress-native
- Simple registration
- REST API integration
- Ecosystem alignment
- Easy for plugin developers

---

## Model Optimizations

WP-Agentic-Admin runs models locally via WebGPU. Two models are available:

### Model Comparison

| Model | Size | Pass Rate | JSON Reliability | Strengths |
|-------|------|-----------|-----------------|-----------|
| **Qwen 3 1.7B** (default) | ~1.2GB | 93% (14/15) | 100% | Fast inference, native tool calling, lightweight |
| **Qwen 2.5 7B** | ~4.5GB | 96% (26/27) | 100% | Multi-step reasoning, complex workflows, precise tool selection |

The 1.7B model is recommended for most users — it loads faster, uses less VRAM, and handles single-tool and multi-tool tasks reliably. The 7B model is available for users who need advanced multi-step reasoning or have sufficient GPU memory.

### Challenges Solved

1. **JSON formatting** - 7B models produce valid JSON consistently (100% parse success with Qwen2.5-7B). Robust parsing still handles edge cases: try native `JSON.parse` first, then fall back to quote sanitization.
2. **Goal efficiency** - Qwen2.5-7B calls exactly 1 tool for single-goal tasks (no over-shooting).
3. **Multi-step reasoning** - 100% success on conditional logic and diagnose-then-fix chains.
4. **Context limits** - 4096 token context window configured (models support up to 32K).

### Safety Mechanisms

- Repeated call detection (same tool twice = stop)
- Max 10 iterations
- Tool result truncation (2000 chars max in prompt-based mode)
- Context window overflow handling
- JSON envelope unwrapping (prevents raw `{"action": "final_answer", ...}` leaking to user)

### Question Handling

- Knowledge questions (e.g., "what is a transient?") are routed directly to the LLM, bypassing ReAct entirely
- The message router detects question patterns (`what is`, `explain`, `define`, etc.) and routes to conversational mode
- This avoids the expensive ReAct LLM call for questions that don't need tools

### Thinking Mode Optimization

- Qwen 3 generates internal `<think>...</think>` blocks before responding (~200-300 tokens of reasoning)
- **Thinking UI:** Thinking tokens stream live in the chat interface — shown expanded with a purple pulsing timeline dot while generating, then collapsed into a peekable "Thought process" entry (same pattern as tool call results). Users can click to expand/peek at the reasoning at any time
- **Thinking persistence:** Completed thinking blocks are persisted as `THINKING` message type in the session, appearing in the chat timeline alongside tool calls and responses
- **Streaming in both paths:** Both the ReAct loop (switched to streaming LLM calls) and the conversational path stream thinking via `onThinkingStart/Chunk/End` callbacks
- **Per-iteration thinking control:** Thinking is disabled at two levels:
  - **Router-level:** For clear action commands (keyword + action verb), thinking is disabled via `/nothink` on the system prompt — saves ~8-10s per interaction
  - **Post-tool:** After tool results are available (`disableThinkingAfterTool: true` in config), `/nothink` is appended to tool result messages. The LLM has concrete data and only needs to summarize, so reasoning is unnecessary. This saves ~8-10s on the final answer generation. Empty `<think>` blocks are suppressed from the UI
- For ambiguous inputs (keyword only, no clear action), thinking remains enabled on the first iteration for accurate tool selection
- Tool selection accuracy is 100% with thinking disabled on clear action commands (verified via ability test harness)

### Dual-Mode Support

- Function calling for models that support it
- Prompt-based JSON fallback
- Auto-detection on first run

---

## Testing

WP-Agentic-Admin has three layers of testing:

### Unit Tests (43 tests)
- `react-agent.test.js` - ReAct loop: JSON parsing, tool routing, iteration limits, repeated call detection, error handling
- `message-router.test.js` - 3-tier message routing (workflow, ReAct with/without thinking, conversational)
- Mocked LLM responses for deterministic testing
- Run with `npm test`

### Ability Tests (Ollama-backed)
- Test tool selection accuracy using a local Ollama instance running Qwen 3 1.7B
- Same system prompt and JSON parser as the browser ReAct agent
- Pure Node.js — no browser, WebGPU, or webpack build needed
- Auto-installs Ollama and pulls model on first run
- **Results:** 100% accuracy (8/8 core tests) in ~20s
- Run with `npm run test:abilities -- --file tests/abilities/core-abilities.test.js`

### E2E Browser Tests (27 tests)
- Run the actual AI model in a real browser against a live WordPress instance
- Validate the full pipeline: user message → LLM reasoning → tool selection → tool execution → response
- Test levels: L2 (basic agentic) and L3 (advanced multi-step reasoning)
- Uses `window.__wpAgenticTestHook` for observability
- Requires Chrome DevTools MCP plugin for Claude Code
- **Results:** Qwen2.5-7B achieves 96% pass rate (26/27)

See [tests/TESTING.md](../tests/TESTING.md) for the full testing guide.

---

## Evolution

**v0.1.x:**
- ReAct loop for adaptive execution
- Workflow keyword detection for common patterns
- 3B models — 74% E2E accuracy

**v0.3.0:**
- Upgraded to 7B models — 96% E2E accuracy with Qwen2.5-7B
- 100% JSON reliability (up from 63% with 3B models)
- JSON envelope fix (prevents raw action wrappers leaking to users)
- Inline loading indicators ("Thinking..." / "Running tool..." in message flow)
- E2E browser test suite (27 tests across 8 categories)
- Test observability hook (`window.__wpAgenticTestHook`)
- 4 workflows tested at 100% pass rate

**v0.4.0:**
- Added Qwen 3 1.7B as default model — 93% E2E accuracy, ~3x faster inference
- Qwen 2.5 7B retained as alternative for advanced reasoning
- Multi-model support — users can choose from dropdown
- Model preference persisted in localStorage

**v0.5.0:**
- 3-tier message routing: workflow → ReAct (with/without thinking) → conversational
- Thinking blocks stream live in the chat UI, then collapse into peekable timeline entries
- ReAct switched to streaming LLM calls for live thinking display
- Post-tool `/nothink` optimization — thinking disabled after tool results for faster answers
- Per-message speed stats (prefill/decode tokens per second)
- `THINKING` message type persisted in session alongside tool calls

**v0.6.0:**
- Production-ready code quality overhaul
- Comprehensive AI Fundamentals documentation (12 topics)

**v0.9.0 (current):**
- Ability test runner replaced: Puppeteer + WebGPU → Ollama (local LLM server)
- Tests run in ~20s (was 5+ minutes with browser-based harness)
- Removed Puppeteer dependency, test-harness webpack build, and browser test page
- Same system prompt and JSON parser as the browser ReAct agent — results are directly comparable
- Qwen 3 1.7B baseline: 100% tool selection accuracy (8/8 core tests)

**Future Enhancements:**
- Expanded abilities library (16+ new abilities proposed)
- Chat UI sidebar for persistent access
- Cloud model fallback for devices without WebGPU

The goal is to make the AI **more reliable and helpful** while keeping it **local-first and privacy-preserving**.

---

## Codebase Overview

### Service Modules

The following service modules live in `src/extensions/services/` and `src/extensions/utils/`:

- **ChatOrchestrator** (`chat-orchestrator.js`) - Main message coordinator. Routes messages via MessageRouter to workflow or ReAct paths. Builds system prompts, manages LLM summary generation, and truncates tool results to 1500 chars for summary prompts.
- **ChatSession** (`chat-session.js`) - Chat history management with `localStorage` persistence. Tracks messages, tool calls, thinking blocks, and session metadata. Message types: `USER`, `ASSISTANT`, `SYSTEM`, `TOOL_REQUEST`, `TOOL_RESULT`, `THINKING`, `ERROR`.
- **StreamSimulator** (`stream-simulator.js`) - Typewriter-style text streaming for chat responses, providing a natural reading experience.
- **ModelLoader** (`model-loader.js`) - WebLLM model management. Handles model download, loading, and inference. Uses a Service Worker (`sw.js`) for model persistence across page navigations.
- **AbilitiesAPI** (`abilities-api.js`) - REST client for the WordPress Abilities API. Fetches registered abilities from the server.
- **AgenticAbilitiesAPI** (`agentic-abilities-api.js`) - Public JavaScript registration API exposed as `wp.agenticAdmin.*`. Allows JS-side ability and workflow registration.
- **ToolRegistry** (`tool-registry.js`) - JavaScript-side ability registration and keyword matching. Converts abilities to function-calling format for the LLM.
- **WorkflowRegistry** (`workflow-registry.js`) - Workflow registration and keyword-based detection. Matches user messages to pre-defined workflows.
- **WorkflowOrchestrator** (`workflow-orchestrator.js`) - Workflow execution engine with rollback support, `includeIf` conditional steps, `mapParams`, optional steps, confirmation prompts, and abort handling.
- **MessageRouter** (`message-router.js`) - 3-tier message routing: workflow (keyword matching), ReAct (tool keyword + action intent, with optional thinking), and conversational (direct LLM for knowledge questions).
- **ReactAgent** (`react-agent.js`) - Core ReAct loop with streaming LLM calls and dual-mode support (function-calling and prompt-based JSON). Streams `<think>` blocks live via `onThinkingStart/Chunk/End` callbacks. Handles observation tracking, confirmation, repeated-call detection, and error recovery.
- **Logger** (`utils/logger.js`) - Centralized logging with configurable levels. Used across all services via `createLogger('ModuleName')`.

### React UI Components

The frontend is built with React (via `@wordpress/element`) in `src/extensions/`:

- **App.jsx** - Root component with two tabs: **Chat** and **Abilities**
- **ChatContainer.jsx** - Chat panel layout, manages message flow between ChatInput and MessageList
- **ChatInput.jsx** - User input field with send button
- **MessageList.jsx** - Scrollable message display area
- **MessageItem.jsx** - Individual message rendering (user, assistant, tool results, thinking blocks, confirmations)
- **AbilityBrowser.jsx** - Abilities tab, lists all registered abilities and workflows
- **WebGPUFallback.jsx** - Fallback UI shown when the browser does not support WebGPU
- **ModelStatus.jsx** - Model loading progress indicator and status display

### Settings System

The PHP settings system is managed by `class-settings.php` (`includes/class-settings.php`):

- **Model selection** - Choose which AI model to use (currently only Qwen 2.5 7B in settings UI; the default model `Qwen3-1.7B` is hardcoded in `model-loader.js`)
- **Confirm destructive actions** - Toggle requiring user confirmation before executing destructive abilities (enabled by default)
- **Max log lines** - Configure the maximum number of log lines to read at once (default: 100)

Settings are stored as a single WordPress option (`wp_agentic_admin_settings`) and accessed via the `Settings` singleton.

---

## References

- [WordPress Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)
- [Abilities Guide](ABILITIES-GUIDE.md)
- [Workflows Guide](WORKFLOWS-GUIDE.md)
