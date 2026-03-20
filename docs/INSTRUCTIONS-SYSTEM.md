# Instruction System — Progressive Disclosure for Small LLMs

## What is this?

The instruction system groups the plugin's 14+ tools into 6 domain-specific **instructions** (plugins, cache, database, diagnostics, routing, cron). Instead of dumping every tool description into the system prompt on every request, the LLM sees a compact index and loads full tool definitions on demand.

**Before (flat mode):**
```
TOOLS:
- wp-agentic-admin/plugin-list: List all installed plugins...
- wp-agentic-admin/plugin-activate: Activate a plugin...
- wp-agentic-admin/cache-flush: Flush object cache...
- wp-agentic-admin/site-health: Run site health check...
... (14 tools, ~280 tokens)
```

**After (instruction mode):**
```
TOOLS (you can call these directly):
- load_instruction: Load an instruction set to access its tools
- unload_instruction: Unload an instruction set you no longer need
- wp-agentic-admin/theme-list: List installed themes...
- wp-agentic-admin/user-list: List all users...

INSTRUCTIONS (call load_instruction first to unlock their tools):
- plugins: List, activate, and deactivate plugins
- cache: Flush object cache and transients
- database: Optimize database tables and clean up revisions
- diagnostics: Site health, error logs, and environment info
- routing: List and flush rewrite rules
- cron: List WordPress cron jobs and scheduled tasks
```

The LLM calls `load_instruction` with an instruction ID, and on the next iteration the system prompt is rebuilt with those tools visible.

## Why does this matter?

### Context window pressure
Qwen 3 1.7B has a 4096-token context window. Every tool description eats into that budget. With 14 tools at ~20 tokens each, that's ~280 tokens just for tool definitions — before the user's message, conversation history, or thinking. As we add more abilities, this gets worse.

Instructions cut the cold-start tool section to ~120 tokens (2 meta-tools + 2 ungrouped tools + 6 one-line instruction descriptions), freeing ~160 tokens for actual reasoning.

### Tool selection accuracy
Small models struggle with large tool lists. With 14+ tools, the model sometimes picks a close-but-wrong tool (e.g., `cache-flush` when the user asked about `transient-flush`). With instructions, it first narrows to a domain (cache), then picks from just 2 tools — a much easier task.

### Session persistence
Active instructions persist across turns within a chat session. If a user loads the plugins instruction in turn 1, it stays loaded for turn 2. The `resetSession()` method clears active instructions when starting a new chat.

## The 6 Instructions

| ID | Description | Tools |
|----|------------|-------|
| `plugins` | List, activate, and deactivate plugins | plugin-list, plugin-activate, plugin-deactivate |
| `cache` | Flush object cache and transients | cache-flush, transient-flush |
| `database` | Optimize database tables and clean up revisions | db-optimize, revision-cleanup |
| `diagnostics` | Site health, error logs, and environment info | site-health, error-log-read, get-site-info, get-environment-info |
| `routing` | List and flush rewrite rules | rewrite-list, rewrite-flush |
| `cron` | List WordPress cron jobs and scheduled tasks | cron-list |

**Ungrouped tools** (always visible, no load_instruction needed): `theme-list`, `user-list`

## How the ReAct loop handles it

1. User says "flush the cache"
2. System prompt shows the instruction index but not cache tools
3. LLM responds: `{"action": "tool_call", "tool": "load_instruction", "args": {"instruction": "cache"}}`
4. Agent adds "cache" to `activeInstructions`, rebuilds system prompt with cache tools visible
5. LLM now sees `cache-flush` and `transient-flush`, picks the right one
6. Normal tool execution continues

The system prompt is rebuilt at the start of every iteration, so load/unload takes effect immediately.

## How to test

### Ollama test runner — same tests, both modes (~60s each)

One test file (`core-abilities.test.js`) defines 23 prompts with expectations for **both** modes. The `--mode` flag switches between them:

```bash
# Compare flat vs instruction mode side by side
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode flat
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode instruction

# Default (auto-detect): uses instruction mode since the file exports instructions
npm run test:abilities -- --file tests/abilities/core-abilities.test.js

# With verbose output (shows raw LLM responses)
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode instruction --verbose

# Disable thinking mode (faster, sometimes less accurate)
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode instruction --no-think

# Use a different model
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --model qwen3:4b
```

Each test defines both expectations:

```js
{
    input: 'flush the cache',
    expectTool: 'wp-agentic-admin/cache-flush',   // flat mode: call directly
    expectInstruction: { id: 'cache' },             // instruction mode: load_instruction first
}
```

**Current results with Qwen 3 1.7B:**

| Mode | Accuracy | Notes |
|------|----------|-------|
| Flat | 23/23 (100%) | Direct tool selection, all tools visible |
| Instruction | 18/23 (78%) | Pure instruction mode, 8 instruction categories |

The instruction mode failures are consistent patterns:
- Model sometimes calls the instruction ID as a tool name (e.g., `"tool": "routing"`)
- Ambiguous prompts ("what PHP version?", "site name?") may get final_answer instead of load_instruction
- "cron" vs "diagnostics" confusion on scheduling-related prompts

### Browser debugging

- **"Show System Prompt" button** in the chat header opens a WordPress Modal showing the current system prompt (with active instructions reflected)
- **Console log** on iteration 0 prints the system prompt (search for `TODO: Remove after testing` in react-agent.js)

### Unit tests

The existing Jest unit tests (43 tests) mock the LLM and don't test instruction loading directly. They still pass:

```bash
npm test
```

## Key files

| File | Role |
|------|------|
| `src/extensions/services/instruction-registry.js` | Singleton registry — stores instruction definitions |
| `src/extensions/instructions/index.js` | Registers the 8 instruction sets with abilities, keywords, context |
| `src/extensions/services/react-agent.js` | Builds instruction-aware prompt, handles load/unload in ReAct loop |
| `src/extensions/services/message-router.js` | Keyword detection — returns `preloadInstructions` on matched routes |
| `src/extensions/services/chat-orchestrator.js` | Wires instructionRegistry into ReactAgent, preloads from router |
| `tests/abilities/runner.js` | Ollama test runner — `--mode flat\|instruction` flag, dual expectations |
| `tests/abilities/core-abilities.test.js` | 23 test cases with both flat and instruction expectations |

## What could go wrong

### The model calls the instruction ID as a tool name
Instead of `{"tool": "load_instruction", "args": {"instruction": "cache"}}`, the model outputs `{"tool": "cache", "args": {}}`. The ReAct agent will return a "tool not found" error. The model usually self-corrects on the next iteration if the error message is clear.

The prompt wording matters a lot here. The key improvements that got us from 53% to 93%:
- Labeling sections "TOOLS (you can call these directly)" vs "INSTRUCTIONS (call load_instruction first)"
- Adding an explicit rule: "IMPORTANT: For plugins, cache, database, diagnostics, routing, cron — you MUST call load_instruction first"
- Providing multiple short examples covering different instruction IDs

### The model skips load_instruction and calls the tool directly
For prompts like "activate WooCommerce", the model might try `wp-agentic-admin/plugin-activate` directly. Since that tool isn't in the TOOLS section (it's behind the plugins instruction), the agent returns "tool not found" and the model should try `load_instruction` next.

### Adding a new ability
If you add a new ability that belongs to an existing instruction, add its ID to the `abilityIds` array in `src/extensions/instructions/index.js`. If it's a new domain, create a new instruction. Every ability should be in an instruction — no ungrouped tools in pure instruction mode.

Remember to also add the instruction to the test file's `instructions` array in `tests/abilities/core-abilities.test.js`.

## Next steps

- [ ] Remove the `console.log` TODO in react-agent.js
- [ ] Decide whether to keep the "Show System Prompt" button for production
- [ ] Test with larger models (qwen3:4b, qwen3:8b) to see if accuracy improves
- [ ] Consider auto-preloading instructions when the message router detects keywords (already partially implemented via `preloadInstructions` in the router)
- [ ] Prompt tune instruction mode to close the gap with flat mode (currently 78% vs 100%)
