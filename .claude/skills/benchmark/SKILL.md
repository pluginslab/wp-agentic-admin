---
name: benchmark
description: "Run the ability test suite against Ollama in both flat and instruction modes, then generate a comparison report. Use this skill whenever the user says 'run benchmark', 'compare modes', 'test flat vs instruction', 'run ability tests', 'benchmark instructions', or after adding/modifying abilities or instructions to verify nothing regressed."
---

# Benchmark: Flat vs Instruction Mode

Run the shared test suite (`tests/abilities/core-abilities.test.js`) against a local Ollama instance in both modes and produce a comparison report.

## What the modes are

- **Flat mode**: All tools listed directly in the system prompt. The LLM picks the right tool in one step.
- **Instruction mode**: Tools are grouped behind instructions. The LLM calls `load_instruction` first to unlock the right group, then picks the tool. This scales better as the tool count grows.

Both modes use the same test file with dual expectations (`expectTool` for flat, `expectInstruction` for instruction).

## How to run

Execute both modes sequentially from the project root. Capture the full output of each run.

```bash
# Run flat mode
node tests/abilities/runner.js --file tests/abilities/core-abilities.test.js --mode flat 2>&1

# Run instruction mode
node tests/abilities/runner.js --file tests/abilities/core-abilities.test.js --mode instruction 2>&1
```

Optional flags:
- `--verbose` — show raw LLM responses (useful for debugging failures)
- `--no-think` — disable Qwen 3 thinking mode (faster but sometimes less accurate)
- `--model <id>` — use a different Ollama model (default: `qwen3:1.7b`)

If a test fails in instruction mode, re-run that single mode with `--verbose` to capture the raw LLM response for the report.

## Report format

After both runs complete, produce a markdown report with this structure:

```markdown
# Benchmark Report: Flat vs Instruction Mode

**Date:** YYYY-MM-DD
**Model:** qwen3:1.7b
**Test file:** tests/abilities/core-abilities.test.js
**Tests:** N test cases

## Results

| Mode | Passed | Total | Accuracy | Time |
|------|--------|-------|----------|------|
| Flat | X | N | X% | Xs |
| Instruction | Y | N | Y% | Ys |

## Instruction Mode Failures

(If any — list each failure with the input, what the model returned, and what was expected)

| Input | Expected | Got | Failure Type |
|-------|----------|-----|-------------|
| ... | load_instruction(cron) | load_instruction(diagnostics) | Wrong instruction |

### Failure categories:
- **Wrong instruction**: Model picked the wrong instruction ID
- **Direct tool call**: Model used instruction ID as tool name instead of calling load_instruction
- **Answered directly**: Model gave final_answer instead of loading an instruction
- **Other**: Anything else

## Flat Mode Failures

(If any — same format)

## Instructions & Abilities

List the current instruction definitions and which abilities they contain,
plus any ungrouped abilities (should be none in pure instruction mode).

## Observations

Note any patterns: which instructions are most/least reliable,
which types of prompts cause confusion, suggestions for prompt tuning.
```

Save the report to `tests/abilities/benchmark-report.md`.

## When tests fail

If instruction mode has failures, check these common causes:

1. **Model calls instruction ID as tool name** (e.g., `"tool": "routing"` instead of `"tool": "load_instruction"`) — the system prompt may need stronger wording
2. **Model answers directly instead of loading instruction** — the prompt needs to emphasize that site-specific questions require tools
3. **Model picks wrong instruction** — the instruction descriptions may need to be more distinct, or a new instruction category is needed
4. **New ability not in any instruction** — add it to an instruction in `src/extensions/instructions/index.js` and update the test file's `instructions` array

## Key files

- `tests/abilities/runner.js` — test runner with `--mode flat|instruction` support
- `tests/abilities/core-abilities.test.js` — shared test cases with dual expectations
- `tests/abilities/load-abilities.js` — auto-loads ability metadata from source files
- `src/extensions/instructions/index.js` — instruction definitions (production)
- `src/extensions/services/react-agent.js` — production system prompt builder
