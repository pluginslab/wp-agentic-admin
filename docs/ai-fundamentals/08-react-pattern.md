# The ReAct Pattern

ReAct (Reasoning + Acting) is the decision-making framework that powers Agentic Admin for WordPress's AI assistant. Instead of answering questions from memory alone, the AI reasons about what information it needs, uses tools to get that information, and adapts its strategy based on observations.

## What is ReAct?

**ReAct** = **Rea**soning + **Act**ing

It's an AI agent pattern where the model alternates between:
1. **Thought** — Reasoning about what to do next
2. **Action** — Using a tool to gather information or perform a task
3. **Observation** — Analyzing the result
4. **Repeat** — Continue until the goal is achieved

This creates an adaptive loop that bridges natural language understanding with real-world execution.

## Why ReAct Matters

### Traditional Approach: Single-Shot Prompting

Without ReAct, the AI gets one chance to respond:

```
User: "My site is slow"
AI: "Your site might be slow due to:
     - Database needs optimization
     - Object cache disabled
     - Too many plugins
     - Large media files
     Try optimizing your database and enabling caching."
```

**Problems:**
- The AI is guessing — it hasn't checked your actual site
- Generic advice that may not apply to your situation
- No actionable steps
- No verification that suggestions worked

### ReAct Approach: Adaptive Investigation

With ReAct, the AI uses tools to investigate:

```
User: "My site is slow"

[Iteration 1]
Thought: "I should check site health first to identify issues"
Action: site-health
Observation: "PHP 8.2, WordPress 6.9, MySQL optimization recommended, 
              15 unoptimized tables found"

[Iteration 2]
Thought: "Database optimization is needed. I'll run db-optimize."
Action: db-optimize
Observation: "Optimized 15 tables, saved 125MB"

[Iteration 3]
Thought: "Let me verify the site is healthy now"
Action: site-health
Observation: "All systems green, no warnings"

Final Response: "I found and fixed the issue. Your database had 15 
                 unoptimized tables causing slowness. I optimized 
                 them and saved 125MB. Your site should be faster now."
```

**Advantages:**
- ✅ Uses real data from your site
- ✅ Takes concrete action
- ✅ Verifies the fix worked
- ✅ Provides specific details (not generic advice)

## The ReAct Loop

### Visual Representation

```
                    ┌─────────────┐
                    │    START    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   THOUGHT   │◄─────────┐
                    │  (Reasoning) │          │
                    └──────┬──────┘          │
                           │                  │
                           ▼                  │
                   Is goal achieved?          │
                    ┌──────┴──────┐          │
                   YES            NO          │
                    │              │          │
                    │              ▼          │
                    │       ┌─────────────┐  │
                    │       │   ACTION    │  │
                    │       │ (Use Tool)  │  │
                    │       └──────┬──────┘  │
                    │              │          │
                    │              ▼          │
                    │       ┌─────────────┐  │
                    │       │ OBSERVATION │  │
                    │       │  (Result)   │  │
                    │       └──────┬──────┘  │
                    │              │          │
                    │              └──────────┘
                    ▼
             ┌─────────────┐
             │   RESPOND   │
             └──────┬──────┘
                    │
                    ▼
                  [END]
```

### Step-by-Step

**1. Thought (Reasoning)**

The AI considers:
- What does the user want?
- What information do I have?
- What information do I need?
- Which tool should I use next?

**2. Action (Tool Call)**

The AI selects a tool and provides parameters:

```json
{
    "tool": "wp-agentic-admin/error-log-read",
    "arguments": { "lines": 50 }
}
```

**3. Observation (Result)**

The tool executes and returns data:

```json
{
    "success": true,
    "errors": [
        "[10-Mar-2026 18:00:15] PHP Fatal error: Call to undefined function..."
    ]
}
```

**4. Decision**

The AI decides:
- Is the goal achieved? → Respond to user
- Need more information? → Loop back to Thought

**5. Iteration Limit**

To prevent infinite loops, the ReAct agent has a maximum iteration count (typically 5-10). If reached, the agent stops and reports progress.

## Example Flows

### Example 1: Simple Request

**User:** "List my plugins"

```
[Iteration 1]
Thought: "User wants to see installed plugins. I'll use plugin-list."
Action: plugin-list
Observation: { plugins: [...], total: 24 }

Goal achieved: Yes
Response: "You have 24 plugins installed:
           - Akismet (active)
           - WooCommerce (active)
           - Yoast SEO (inactive)
           ..."
```

**Total iterations:** 1

### Example 2: Multi-Step Investigation

**User:** "Check for problems"

```
[Iteration 1]
Thought: "I should check overall site health first"
Action: site-health
Observation: { status: 'warning', issues: ['PHP errors detected'] }

[Iteration 2]
Thought: "There are PHP errors. Let me read the error log."
Action: error-log-read
Observation: { errors: ['Fatal error in broken-plugin'] }

[Iteration 3]
Thought: "The problem is broken-plugin. I should recommend deactivation."
Goal achieved: Yes
Response: "I found a critical issue: the 'broken-plugin' plugin is 
           throwing fatal errors. I recommend deactivating it."
```

**Total iterations:** 3

### Example 3: Conditional Logic

**User:** "Optimize database if needed"

```
[Iteration 1]
Thought: "I need to check if optimization is needed"
Action: site-health
Observation: { db_optimization: 'recommended', tables: 15 }

[Iteration 2]
Thought: "Optimization is recommended. I'll run db-optimize."
Action: db-optimize
Observation: { success: true, optimized: 15, saved: '125MB' }

Goal achieved: Yes
Response: "Your database needed optimization. I optimized 15 tables 
           and saved 125MB."
```

**Total iterations:** 2

### Example 4: Goal Already Met

**User:** "Optimize database if needed"

```
[Iteration 1]
Thought: "I need to check if optimization is needed"
Action: site-health
Observation: { db_optimization: 'not_needed', tables: 0 }

Goal achieved: Yes
Response: "Your database is already optimized. No action needed."
```

**Total iterations:** 1 (avoided unnecessary optimization)

## System Prompt

The ReAct agent's behavior is controlled by a **system prompt** that defines:

1. **Role** — "You are a WordPress site reliability engineer"
2. **Capabilities** — List of available tools (abilities)
3. **Constraints** — What the AI should NOT do
4. **Format** — How to structure tool calls (JSON)
5. **Examples** — Sample thought → action sequences

**Example system prompt (simplified):**

```
You are a WordPress assistant that helps with site administration.

Available tools:
- plugin-list: List installed plugins
- error-log-read: Read error log entries
- site-health: Get site health information
- db-optimize: Optimize database tables
- cache-flush: Clear object cache

Instructions:
1. Use tools to gather information before responding
2. Output tool calls as JSON: {"tool": "...", "arguments": {...}}
3. After each observation, decide if you need more information
4. When goal is achieved, respond to the user

If the user asks about something you cannot help with, politely 
explain your capabilities are limited to WordPress administration.

Do not make up information. Always use tools to get real data.
```

The system prompt is dynamically generated based on registered abilities — see [ABILITIES-GUIDE.md](../ABILITIES-GUIDE.md#the-label-property).

## Tool Call Format

The AI generates tool calls as JSON:

### Basic Tool Call

```json
{
    "tool": "wp-agentic-admin/plugin-list",
    "arguments": {}
}
```

### Tool Call with Parameters

```json
{
    "tool": "wp-agentic-admin/error-log-read",
    "arguments": {
        "lines": 100,
        "severity": "error"
    }
}
```

### Multiple Tool Calls (Sequential)

The ReAct agent processes tools **one at a time**, observing results before deciding the next action:

```
[Iteration 1] → plugin-list → Observation
[Iteration 2] → site-health → Observation
[Iteration 3] → Respond
```

**Not supported:**
```json
[
    {"tool": "plugin-list", "arguments": {}},
    {"tool": "site-health", "arguments": {}}
]
```

Parallel tool execution is not implemented. Each tool call requires a new iteration.

## Error Handling

The ReAct loop handles errors gracefully:

### Tool Execution Failure

```
Action: plugin-deactivate { plugin: "nonexistent.php" }
Observation: { success: false, message: "Plugin not found" }

Thought: "The plugin doesn't exist. I'll inform the user."
Response: "I couldn't find a plugin with that name. Here are your 
           installed plugins: [...]"
```

### Malformed Tool Call

If the AI generates invalid JSON:

```
Action: {tool: plugin-list}  // Missing quotes
Parser: [Sanitizes JSON] → {"tool": "plugin-list"}
Observation: [Executes successfully]
```

The parser attempts to fix common JSON issues (single quotes, trailing commas, etc.) before execution.

### Iteration Limit Reached

If the agent hits max iterations without achieving the goal:

```
[Iteration 5 - MAX]
Thought: "I need more information but have reached the iteration limit"
Response: "I'm still investigating your issue. So far I've found:
           - [summary of findings]
           - [actions taken]
           Please try: [suggested next steps]"
```

## Stopping Conditions

The ReAct loop stops when:

1. **Goal Achieved** — AI determines it has enough information to respond
2. **Max Iterations** — Typically 5-10 iterations (configurable)
3. **No Tool Selected** — AI decides no tools are needed (conversational response)
4. **Error** — Critical failure (e.g., model crash)

## ReAct vs Workflows

Agentic Admin for WordPress uses two execution modes:

### ReAct (Adaptive)

- **When:** User asks open-ended questions or complex tasks
- **How:** AI decides tools dynamically based on observations
- **Example:** "Check for problems" → site-health → error-log-read → plugin-deactivate

### Workflows (Pre-Defined)

- **When:** User triggers known multi-step sequences
- **How:** Fixed sequence of tools, no AI decision-making
- **Example:** "Site cleanup" → cache-flush → db-optimize → site-health

See [WORKFLOWS-GUIDE.md](../WORKFLOWS-GUIDE.md) for workflow details.

**Key difference:**

| Feature | ReAct | Workflow |
|---------|-------|----------|
| **Tool Selection** | AI decides at runtime | Pre-defined sequence |
| **Conditional Logic** | Supports "if X then Y" | Linear execution |
| **Flexibility** | High (adapts to observations) | Low (fixed steps) |
| **Speed** | Slower (LLM reasoning) | Faster (no reasoning) |

## Observability

Agentic Admin for WordPress exposes the ReAct loop for debugging via `window.__wpAgenticTestHook`:

```javascript
// Get last ReAct execution details
const result = window.__wpAgenticTestHook.getLastReactResult();

console.log(result.toolsUsed);      // ['site-health', 'error-log-read']
console.log(result.iterations);     // 2
console.log(result.observations);   // [{ tool: 'site-health', result: {...} }, ...]
```

This is useful for:
- E2E testing (verifying correct tool selection)
- Debugging unexpected behavior
- Performance analysis (iteration count)

See [TESTING.md](../../tests/TESTING.md) for E2E test examples.

## Performance Characteristics

### Latency per Iteration

```
Thought (LLM reasoning):  2-5 seconds
Action (tool execution):  0.1-2 seconds (depends on tool)
Total per iteration:      2-7 seconds
```

Multi-iteration flows take longer but provide more accurate results.

### Token Usage

Each iteration adds tokens to the context:

```
System prompt:        ~500 tokens
User message:         ~50 tokens
[Iteration 1]
  Thought:            ~100 tokens
  Observation:        ~200 tokens
[Iteration 2]
  Thought:            ~100 tokens
  Observation:        ~200 tokens
Response:             ~200 tokens

Total:                ~1,350 tokens
```

With Qwen 3 1.7B (32K context window), you can handle ~20 iterations before hitting limits. In practice, most flows complete in 1-3 iterations.

## Limitations

### 1. Small Model Reasoning

Small models (1.7B-7B) occasionally:
- Select suboptimal tools
- Repeat the same tool unnecessarily
- Miss conditional logic ("if X then Y")

**Mitigation:** Use larger models (7B+) for complex flows, or pre-defined workflows for known sequences.

### 2. Iteration Overhead

Each iteration requires LLM inference (2-5 seconds). For simple tasks, this is slower than direct execution.

**Mitigation:** Keyword-based routing (see [Message Router](../../ARCHITECTURE.md#2-tier-routing)) bypasses ReAct for known commands.

### 3. No Parallel Execution

The agent processes tools sequentially, not in parallel:

```
Slow:   site-health (2s) → error-log-read (1s) → Total: 3s
Can't:  site-health + error-log-read in parallel → Total: 2s
```

**Future enhancement:** Parallel tool execution is possible but not yet implemented.

## End-to-End Walkthrough

Here's what happens from the moment a user types a message to the final response. This traces the full path through the system.

**User types:** *"Why is my site slow?"*

### Step 1: Message Router (< 1ms)

The `MessageRouter` receives the raw text and extracts keywords:

```
Input:  "Why is my site slow?"
Keywords extracted: ["site", "slow"]
```

It scores every registered ability by keyword overlap. `site-health` scores highest because its keywords include `["site", "health", "slow", "performance"]`.

**Result:** Top 5 abilities selected → passed to the ReAct agent.

### Step 2: System Prompt Assembly (< 1ms)

The `ReactAgent` builds a system prompt containing:
1. The agent's role and behavioral rules
2. Tool descriptions for only the top 5 abilities (not all 14+)
3. The expected JSON format for tool calls
4. The conversation history

This keeps the prompt well within the 4,096 token context window.

### Step 3: ReAct Iteration 1 — Reasoning (2-3s)

The LLM generates its first response:

```
Thought: The user reports slow performance. I should run a site health
check to gather diagnostics before making recommendations.

Action: {"tool": "site-health", "input": {}}
```

The JSON parser extracts the tool call. Since `site-health` is read-only, no confirmation dialog is shown.

### Step 4: Ability Execution (100-500ms)

The system calls the WordPress REST API:

```
GET /wp-json/wp-agentic-admin/v1/abilities/site-health/execute
```

WordPress runs the PHP callback, which gathers page load time, active plugin count, PHP version, memory usage, and database health. The response is truncated to 2,000 characters and fed back as an **Observation**.

### Step 5: ReAct Iteration 2 — Follow-up (2-3s)

The LLM now has real data:

```
Observation: {"success": true, "page_load": "4.2s", "active_plugins": 38,
"memory_usage": "245MB/256MB", "php_version": "8.2.4"}

Thought: The site has 38 active plugins and is nearly out of memory
(245MB/256MB). The high plugin count is likely the main cause.
I have enough information to advise the user.

Response: Your site is loading in 4.2 seconds, which is slow. The main
issues are: **38 active plugins** (most sites need 15-20) and **memory
nearly maxed out** (245MB of 256MB). I'd recommend deactivating unused
plugins and increasing PHP memory_limit to 512MB.
```

No tool call in the response → the ReAct loop ends. The response streams to the user token-by-token.

### Step 6: Chat UI

The `ChatContainer` component renders the streamed response with markdown formatting. The conversation is saved to `ChatSession` for history persistence.

**Total time:** ~5-7 seconds (keyword match + 2 LLM iterations + 1 REST API call).

## Future Improvements

**Planned for hackathon/post-hackathon:**

1. **Tool Selection at Scale (RLM)** — Pre-filter tools before ReAct to handle 50+ abilities efficiently
2. **Self-Reflection** — Agent evaluates its own decisions and corrects mistakes
3. **Memory** — Persist learnings across conversations (e.g., "user prefers dry-run first")
4. **Multi-Step Planning** — Agent outlines full plan before executing (like a TODO list)

See [CLOUDFEST_HACKATHON.md § Tool Selection at Scale](../../CLOUDFEST_HACKATHON.md#tool-selection-at-scale-rlm-approach) for details.

## Summary

The ReAct pattern enables Agentic Admin for WordPress's AI to reason adaptively: it uses tools to gather information, observes results, and adjusts strategy in real-time. This bridges natural language understanding with WordPress operations, providing accurate, data-driven assistance. The loop continues until the goal is achieved or max iterations is reached, with each iteration consisting of Thought → Action → Observation.

**Next:** [Tools & Abilities](09-tools-and-abilities.md)
