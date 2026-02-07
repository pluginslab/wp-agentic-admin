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
3. **Local-first** - Works with small (1.5B-3B parameter) models running on-device
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

**Why:** Privacy, zero server costs, works offline, GDPR compliant by design.

### 4. Small Model Friendly

Optimized for 1.5B-3B parameter models (Qwen, Phi-3, Gemma).

**Why:** Runs on consumer hardware, lower memory usage, faster inference.

---

## ReAct Loop Architecture

### Message Routing

```
User Message
  ↓
Is it a question? (e.g., "what is a transient?")
  ↓ Yes → Conversational Mode (LLM answers directly)
  ↓ No
  ↓
Does it match a workflow keyword? (e.g., "full site cleanup")
  ↓ Yes → Execute Workflow (pre-defined steps)
  ↓ No
  ↓
ReAct Loop (AI-driven adaptive execution)
```

### ReAct Loop Flow

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
- Question detection (regex patterns)
- Workflow keyword matching
- Default to ReAct loop

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
const workflow = workflowRegistry.detectWorkflow(userMessage);

if (workflow) {
  // Execute pre-defined steps
  for (const step of workflow.steps) {
    await executeAbility(step.abilityId, step.params);
  }
} else {
  // Fall back to ReAct loop
  await reactAgent.execute(userMessage);
}
```

### Workflow Examples

**"full site cleanup"** → Rigid workflow:
1. Flush cache
2. Optimize database
3. Check site health

**"check site performance"** → Rigid workflow:
1. Get site health info
2. Read error log

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
register_agentic_ability('db-optimize', [
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

## Small Model Optimizations

WP-Agentic-Admin is optimized to work well with 1.5B-3B parameter models running locally.

### Challenges with Small Models

1. **JSON formatting** - Small models struggle with structured output
2. **Over-eagerness** - Calling too many tools
3. **Error recovery** - Poor handling of tool failures
4. **Context limits** - 4096 tokens for Qwen 2.5 1.5B

### Our Solutions

**1. Robust JSON Parsing**
- Sanitize control characters
- Fix common syntax errors (single quotes, missing quotes)
- Extract first valid JSON object
- Graceful fallback on parse failure

**2. Safety Mechanisms**
- Repeated call detection (same tool twice = stop)
- Max 10 iterations
- Tool result truncation (1000 chars max)
- Context window overflow handling

**3. Pre-filtering**
- Questions detected before ReAct (regex patterns)
- Prevents "what is a transient?" from calling tools
- Reduces unnecessary LLM calls

**4. Dual-Mode Support**
- Function calling for models that support it (Hermes)
- Prompt-based JSON for models that don't (Qwen, Flash)
- Auto-detection on first run

### TODO: Hackathon Improvements

Several areas identified for future exploration:

1. **Prompt Engineering** - Simplify language for smaller models
2. **Error Recovery** - Better handling of tool failures
3. **JSON Robustness** - Smarter parsing strategies
4. **Question Detection** - Better than regex for small models

See inline `TODO Hackathon` comments in the codebase for details.

---

## Testing

WP-Agentic-Admin includes comprehensive automated tests:

- Automated tests covering ReAct loop, message routing, and edge cases
- Mocked LLM responses for deterministic testing
- Real-world test cases based on manual testing findings

Run tests with `npm test` to verify functionality.

---

## Evolution

The architecture will continue to evolve:

**Current (v0.1.0):**
- ReAct loop for adaptive execution
- Workflow keyword detection for common patterns
- Optimized for 1.5B-3B models

**Future Enhancements:**
- Improved prompt engineering for smaller models
- Better error recovery strategies
- More sophisticated workflow composition
- Support for larger models (7B+) when available

The goal is to make the AI **more reliable and helpful** while keeping it **local-first and privacy-preserving**.

---

## References

- [WordPress Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)
- [Abilities Guide](ABILITIES-GUIDE.md)
- [Workflows Guide](WORKFLOWS-GUIDE.md)
