# Testing Guide

This project has three layers of testing: **unit tests** (automated, fast), **ability tests** (automated, Ollama-backed), and **E2E browser tests** (manual via Claude Code, slow).

---

## Unit Tests

Standard Jest tests that run against the JavaScript source without a browser.

### Running

```bash
npm test
```

### Structure

```
src/extensions/services/__tests__/
  react-agent.test.js     # ReAct agent: JSON parsing, tool routing, error handling
  message-router.test.js  # Message router: 3-tier routing (workflow, ReAct, conversational)
```

### What they cover

- JSON parsing and sanitization (malformed JSON, single quotes, control characters)
- Tool call extraction from LLM responses
- Repeated tool call detection
- Message routing and intent classification
- Edge cases (empty responses, multiple JSON objects, missing fields)

### Writing new tests

Tests use `@wordpress/scripts` (Jest). Place test files in `__tests__/` directories next to the source they test. Follow the existing pattern:

```js
import { ReactAgent } from '../react-agent';

describe( 'ReactAgent', () => {
    it( 'should parse valid tool call', async () => {
        // ...
    } );
} );
```

---

## Ability Tests (Ollama)

Ability tests validate that the LLM correctly selects the right tool for a given user prompt. They use a local Ollama instance running Qwen 3 1.7B — the same model and system prompt as the browser-based ReAct agent, but without WebLLM, WebGPU, or a browser.

### Prerequisites

- **Ollama**: Auto-installed via Homebrew on macOS if not present. On other platforms, install manually from [ollama.com](https://ollama.com/download).
- The model (`qwen3:1.7b`) is auto-pulled on first run.

### Running

```bash
npm run test:abilities -- --file tests/abilities/core-abilities.test.js
```

Options:

```bash
--model qwen3:1.7b    # Ollama model ID (default: qwen3:1.7b)
--no-think             # Disable Qwen 3 thinking mode
--verbose              # Show full LLM responses
```

### How it works

1. Runner checks for Ollama (installs via `brew install --cask ollama` if missing)
2. Starts Ollama server if not running
3. Pulls the model if not available locally
4. Builds the same system prompt as `react-agent.js` (tool list + JSON format rules)
5. For each test case, sends a single message to Ollama's OpenAI-compatible API (`/v1/chat/completions`)
6. Parses the JSON response using the same parser as the ReAct agent
7. Evaluates: did the model pick the expected tool (or correctly pick no tool)?

### Test file format

```js
module.exports = {
    abilities: [
        {
            id: 'agentic-admin/plugin-list',
            label: 'List installed plugins',
            description: 'List all installed WordPress plugins...',
        },
    ],
    tests: [
        { input: 'list plugins', expectTool: 'agentic-admin/plugin-list' },
        { input: 'what is a transient?', expectTool: null },  // No tool expected
        { input: 'is debug mode on?', expectTool: ['tool-a', 'tool-b'] },  // Either is acceptable
    ],
};
```

### Writing new test files

Copy `tests/abilities/example.test.js` and modify it. Each test file defines:
- `abilities` — the tools the model can choose from (id, label, description)
- `tests` — input prompts with expected tool selection

### Baseline results

Qwen 3 1.7B achieves **100% accuracy** (8/8) on core ability tests in ~20s.

---

## E2E Browser Tests

These tests run the actual AI model in a real browser against a live WordPress instance. They validate that the full pipeline works: user message → LLM reasoning → tool selection → tool execution → response.

### Prerequisites

1. A running WordPress instance with the plugin activated
2. Claude Code with the **Chrome DevTools MCP** plugin installed
3. A machine with WebGPU support and ~6GB free VRAM

### How they work

The E2E tests are **not automated scripts**. They are test definitions designed to be executed by Claude Code using Chrome DevTools MCP tools. The flow is:

1. Claude Code navigates the browser to WordPress and logs in
2. Loads the AI model (first load downloads ~4.5GB, cached after)
3. Injects a test hook (`window.__wpAgenticTestHook`) for observability
4. Sends messages via the hook and polls for completion
5. Asserts on tools called, response content, and iteration count

### Running

Ask Claude Code to run the E2E tests:

```
Run the E2E tests in tests/e2e/ against my local WordPress at https://your-site.local
```

Claude Code will:
1. Read `tests/e2e/config.js` for URLs, credentials, and selectors
2. Follow the steps in `tests/e2e/runner.js`
3. Execute each test suite and collect results

### Configuration

Edit `tests/e2e/config.js` to match your environment:

```js
export const config = {
    urls: {
        login: 'https://your-site.local/wp-login.php',
        plugin: 'https://your-site.local/wp-admin/admin.php?page=agentic-admin',
    },
    credentials: {
        username: 'your-username',
        password: 'your-password',
    },
    models: {
        default: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    },
    // ...
};
```

### Structure

```
tests/e2e/
  config.js                        # URLs, credentials, selectors, timeouts
  runner.js                        # Step-by-step orchestration guide
  helpers/
    assertions.js                  # Assertion engine
  suites/
    l2-single-tool.js              # Single correct tool selection (5 tests)
    l2-multi-tool.js               # Multi-tool chains (3 tests)
    l2-error-recovery.js           # Graceful failure handling (2 tests)
    l2-conversational.js           # No-tool informational queries (3 tests)
    l2-json-reliability.js         # Diverse requests produce valid JSON (10 tests)
    l3-complex-multistep.js        # Diagnose-then-fix reasoning (2 tests)
    l3-conditional.js              # Conditional tool selection (1 test)
    l3-goal-completion.js          # Agent stops after achieving goal (3 tests)
```

### Test levels

| Level | What it tests | Example |
|-------|--------------|---------|
| **L2** | Basic agentic: correct tool selection, JSON output, error handling | "list my plugins" → calls `plugin-list` |
| **L3** | Advanced agentic: multi-step reasoning, conditional logic, goal awareness | "check errors and if DB issues, optimize" → calls `error-log-read` then `db-optimize` |

### Assertions

Each test defines assertions that are checked against the actual result:

```js
{
    name: 'List plugins',
    input: 'list all installed plugins',
    assertions: {
        toolsCalled: ['agentic-admin/plugin-list'],  // Exact tools expected
        toolsCalledExactly: 1,                          // Exact count
        responseNotEmpty: true,                         // Non-trivial response
        responseContainsAny: ['plugin', 'installed'],   // Keyword checks
    },
}
```

Available assertions:
- `toolsCalled: [...]` — these specific tools must have been called
- `toolsCalledExactly: N` — exactly N tools called
- `toolsCalledMinimum: N` / `toolsCalledMaximum: N` — count bounds
- `toolsCalledInOrder: true` — tools called in the specified order
- `noToolsCalled: true` — no tools should be called (conversational)
- `responseContains: [...]` — response must contain all keywords
- `responseContainsAny: [...]` — response must contain at least one keyword
- `responseNotEmpty: true` — response must not be empty
- `conditionalAssertions: [...]` — if tool A returned X, then tool B should also be called

### Test hook API

The plugin exposes `window.__wpAgenticTestHook` with these methods:

| Method | Returns | Description |
|--------|---------|-------------|
| `getMessages()` | `Array` | All messages in the current chat session |
| `getLastReactResult()` | `Object` | Last ReAct execution result (tools, observations, iterations) |
| `getToolsUsed()` | `string[]` | Tool IDs called in last execution |
| `getObservations()` | `Object[]` | Tool results from last execution |
| `isProcessing()` | `boolean` | Whether the agent is currently processing |
| `sendMessage(msg)` | `void` | Send a message to the agent |
| `clearChat()` | `void` | Clear all messages and reset state |

### Design decisions

- **sendMessage via JS hook** instead of DOM interaction — more reliable, avoids textarea focus issues
- **Poll `isProcessing()`** instead of watching DOM — deterministic completion detection
- **Load model once, run all tests** — avoids 5-minute reload between tests
- **Best-of-3 runs** for flaky tests — LLMs are non-deterministic at temperature > 0
- **70% pass threshold** per category — accounts for probabilistic model behavior

### Writing new tests

Add a new file in `tests/e2e/suites/` following the existing pattern:

```js
export const suite = {
    name: 'L2: My New Suite',
    category: 'L2',
    tests: [
        {
            name: 'Descriptive test name',
            input: 'the message to send to the agent',
            assertions: {
                toolsCalled: ['agentic-admin/some-tool'],
                responseNotEmpty: true,
            },
        },
    ],
};

export default suite;
```

Then import it in `tests/e2e/runner.js`.

---

## CI Integration

Unit tests run via `npm test` and can be added to any CI pipeline. Ability tests run via `npm run test:abilities` and require Ollama installed on the CI runner. E2E tests require a browser with WebGPU and are currently manual-only.
