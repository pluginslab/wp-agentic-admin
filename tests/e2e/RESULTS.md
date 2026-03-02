# E2E Test Results — Hermes 2 Pro 7B (Prompt-Based Mode)

**Date:** 2026-03-02
**Model:** Hermes-2-Pro-Mistral-7B-q4f16_1-MLC (Q4, ~4.5GB)
**Mode:** Prompt-based (WebLLM FC limitation workaround)
**Browser:** Chrome via DevTools MCP
**WordPress:** 6.9.1, PHP 8.3.29, nginx/1.29.5

---

## Summary

| Category | Tests | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| L2: Single Tool Selection | 5 | 4 | 1 | 80% |
| L2: Conversational (No Tools) | 3 | 3 | 0 | 100% |
| L2: Multi-Tool Chains | 3 | 2 | 1 | 67% |
| L2: Error Recovery | 2 | 2 | 0 | 100% |
| L2: JSON Reliability | 8 | 5 | 3 | 63% |
| L3: Goal Completion | 3 | 2 | 1 | 67% |
| L3: Complex Multi-Step | 2 | 1 | 1 | 50% |
| L3: Conditional Logic | 1 | 1 | 0 | 100% |
| **Total** | **27** | **20** | **7** | **74%** |

**Overall: 74% pass rate (20/27)**

---

## Detailed Results

### L2: Single Tool Selection (4/5 = 80%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| List plugins | "list all installed plugins" | PASS | plugin-list | 16s |
| Site health | "check my site health status" | PASS | site-health | 14s |
| Error log | "show me the PHP error log" | PASS | error-log-read | 42s |
| DB optimize | "optimize the database" | PASS (retry) | db-optimize, transient-flush | 8s |
| Flush cache | "flush the object cache" | PASS | transient-flush, transient-list | 25s |

Notes:
- All 5 passed. Test 3 had graceful repeated-tool-call recovery. Test 4 initially failed JSON parse but succeeded on retry.
- Tool name mismatch: test expected `error-log` but actual tool is `error-log-read`.

### L2: Conversational — No Tools (3/3 = 100%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| What is WordPress? | "what is WordPress?" | PASS | None | 9s |
| Password reset | "how do I reset my WordPress password?" | PASS | None | 11s |
| Posts vs pages | "what is the difference between posts and pages?" | PASS | None | 7s |

Notes:
- All conversational responses were accurate and informative.
- Model correctly identified these as informational queries not requiring tools.

### L2: Multi-Tool Chains (2/3 = 67%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| Health + Optimize | "check site health and optimize the database" | PASS | 2 tools | 5s |
| Plugins + Health | "list my plugins and check site health" | PASS | 2 tools | 5s |
| Errors + Cache | "check the error log and flush the cache" | FAIL | None | 9s |

Notes:
- Test 3 failed with "Unknown action type" — model output JSON with unrecognized action format.

### L2: Error Recovery (2/2 = 100%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| Nonexistent tool | "activate the jetpack plugin" | PASS | plugin-activate | 15s |
| Vague request | "fix my website" | PASS | None | 15s |

Notes:
- Test 1: Model found the actual `plugin-activate` tool (the premise that no tool exists was wrong).
- Test 2: Model gracefully responded "I had trouble understanding. Could you rephrase?"

### L2: JSON Reliability (5/8 = 63%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| list my plugins | Varied | FAIL (wrong tools) | 5 unrelated tools | 7s |
| show site health | — | FAIL (parse error) | None | 7s |
| check the error log | — | PASS | error-log-read | 41s |
| flush all caches | — | FAIL (parse error) | None | 11s |
| what plugins are active? | — | PASS | plugin-list | 13s |
| is WP up to date? | — | FAIL (parse error) | None | 11s |
| check site health status | — | PASS | site-health + 3 more | 43s |
| show server info | — | PASS | core/get-environment-info | 13s |

Notes:
- 3 failures from "Failed to parse LLM response" — model output wasn't valid JSON.
- 1 failure from calling wrong/random tools.
- Temperature 0.3 still introduces variance. Some prompts work reliably, others are flaky.

### L3: Goal Completion (2/3 = 67%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| Stop after listing | "list all installed plugins" | PASS | plugin-list (1 tool) | 13s |
| Stop after cache flush | "flush the object cache" | PARTIAL | cache-flush + 2 more (3 tools) | 25s |
| Stop after DB optimize | "run database optimization" | FAIL | None | 9s |

Notes:
- Test 1: Perfect — called 1 tool, gave clean summary "You have 3 plugins installed."
- Test 2: Over-eager — called 3 tools instead of stopping after flush. Functional but not goal-efficient.
- Test 3: Failed with "Unknown action type."

### L3: Complex Multi-Step (1/2 = 50%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| Diagnose slow site | "my site is slow, find out why and fix what you can" | PASS | 6 tools | 57s |
| Errors then optimize | "check error log and if DB errors, optimize" | PARTIAL | db-optimize (skipped error log step) | 31s |

Notes:
- Test 1: Impressive — called 6 diagnostic tools (db-optimize, transient-flush, rewrite-list, site-health, server-info, error-check). Hit context window limit but data was collected.
- Test 2: Skipped the error log check, went straight to optimization. Partial credit.

### L3: Conditional Logic (1/1 = 100%)

| Test | Input | Result | Tools Called | Time |
|------|-------|--------|-------------|------|
| Health then optimize | "check site health and if DB needs attention, optimize it" | PASS | 2 tools | 5s |

Notes:
- Correctly checked health first, then optimized. Good conditional reasoning.

---

## Key Findings

### Strengths
1. **Tool selection accuracy**: When the model produces valid JSON, it consistently picks the right tool(s).
2. **Conversational awareness**: 100% accuracy in identifying no-tool informational queries.
3. **Multi-step reasoning**: Successfully performed 6-tool diagnostic chains for complex requests.
4. **Conditional logic**: Correct conditional tool selection (check first, then act).
5. **Error recovery**: Graceful handling of vague requests and repeated tool calls.

### Weaknesses
1. **JSON reliability**: ~37% of JSON reliability tests failed due to parse errors. The model sometimes outputs malformed JSON or echoes system prompt examples instead of structured output.
2. **Non-determinism**: Same prompt ("list my plugins") succeeded on first run but failed on later run. Temperature 0.3 still causes variance.
3. **Goal over-shooting**: Model sometimes calls extra tools beyond what's needed (e.g., cache flush triggered 3 tools).
4. **System prompt leakage**: Final answers sometimes contain fragments of few-shot examples from the system prompt.
5. **"Unknown action type" errors**: Some responses use incorrect JSON action format, suggesting the prompt could be clearer about valid action types.

### Recommendations
1. **Reduce temperature to 0.1-0.2** for more deterministic tool calling.
2. **Simplify system prompt** — fewer/shorter examples to reduce prompt echo.
3. **Add JSON schema validation** with retry on parse failure.
4. **Consider structured output** — constrain model output to valid JSON via grammar sampling if WebLLM supports it.
5. **Shorten context window** to prevent the model from losing focus on long conversations.

---

## Technical Notes

- **WebLLM Hermes FC limitation**: Hermes-2-Pro cannot use `ChatCompletionRequest.tools` with custom system prompts in WebLLM. Workaround: force prompt-based mode with JSON output.
- **Service Worker persistence**: Model stays loaded across page reloads (cache hit).
- **Context window**: 4096 tokens configured, 32768 available. Some complex tests hit the limit.
- **Repeated tool call detection**: Built-in safety prevents infinite loops when model tries to call the same tool twice.
