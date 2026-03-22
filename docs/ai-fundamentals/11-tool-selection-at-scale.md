# Tool Selection at Scale (RLM Approach)

As WP Agentic Admin grows from 14 abilities to 50+, a critical challenge emerges: how does a small language model (1.7B-7B parameters) efficiently select the right tool when hundreds are available?

## The Problem

### Context Window Bloat

The ReAct agent presents all registered tools to the LLM in the system prompt:

```
You are a WordPress assistant. Available tools:

1. plugin-list: List installed plugins with status
2. plugin-activate: Activate a specific plugin
3. plugin-deactivate: Deactivate a specific plugin
4. site-health: Check site health information
5. error-log-read: Read error log entries
...
50. user-permission-update: Update user permissions
```

**Current state (14 abilities):**
- Tool list: ~500 tokens
- System prompt total: ~800 tokens
- **Result:** Manageable, no issues

**Future state (50+ abilities):**
- Tool list: ~2000 tokens
- System prompt total: ~2500 tokens
- **Result:** Consumes 1/15th of Qwen 3 1.7B's 32K context window

**At 100+ abilities:**
- Tool list: ~4000 tokens
- System prompt total: ~4500 tokens
- **Result:** Small models struggle to reason over so many options

### Decision Quality Degradation

Even with sufficient context window, small models (1.7B-7B) have limited reasoning capacity:

**With 10 tools:**
```
User: "check for errors"
AI: [Scans 10 tools] → Selects error-log-read ✓
```

**With 100 tools:**
```
User: "check for errors"
AI: [Scans 100 tools] → Selects error-log-read... or site-health... or debug-mode-check... ❓
```

More options = more confusion = worse tool selection accuracy.

### Third-Party Extensions

WP Agentic Admin's extensibility means third-party plugins can register abilities:

```
Core abilities:         14
Hackathon additions:    17
Third-party plugins:    50+ (easily)
─────────────────────────
Total:                  80+
```

The tool selection strategy must handle unbounded growth.

## The Solution: RLM-Inspired Lazy Loading

Inspired by **Recursive Language Models** (Zhang, Kraska, Khattab — Dec 2025), the core insight is:

> Don't load everything into context; search and load only what's needed.

Instead of showing the LLM all 100 tools, show only the 3-5 most relevant ones.

### Three-Phase Approach

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Lightweight Tool Search (No LLM)              │
│  - Keyword matching on user message                     │
│  - Score abilities based on description relevance       │
│  - Select top 3-5 candidates                            │
│  - Cost: 0ms (deterministic)                            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Phase 2: Focused ReAct Execution                       │
│  - Inject only top 3-5 tool schemas into system prompt │
│  - LLM reasons with complete detail but minimal set    │
│  - Context savings: ~400-600 tokens vs ~4000 tokens    │
│  - Cost: 2-5s per iteration (normal ReAct)             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Phase 3: Dynamic Tool Injection (Recursive)            │
│  - If observation reveals need for unlisted tool,      │
│    LLM calls meta-ability: search-tools("cron mgmt")   │
│  - System searches full tool index, injects match      │
│  - Next iteration has expanded tool set                │
│  - Cost: +1 iteration (2-5s)                           │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Lightweight Tool Search

### How It Works

Before involving the LLM, use fast heuristics to narrow the tool set:

**1. Parse User Message**
```javascript
const message = "my site is slow";
const keywords = extractKeywords(message);
// ["site", "slow", "performance"]
```

**2. Score Each Ability**
```javascript
const abilities = getAllAbilities();  // 100 total

abilities.forEach(ability => {
    let score = 0;
    
    // Check registered keywords
    ability.keywords.forEach(keyword => {
        if (message.includes(keyword)) score += 10;
    });
    
    // Check description similarity
    const descWords = ability.description.toLowerCase().split(' ');
    keywords.forEach(kw => {
        if (descWords.includes(kw)) score += 5;
    });
    
    ability.score = score;
});
```

**3. Select Top Candidates**
```javascript
const topAbilities = abilities
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);  // Top 5 only

// Inject only these 5 into system prompt
```

### Example Flow

**User:** "my site is slow"

**Tool scoring:**
```
site-health:       score 25 (keywords: "site", desc: "performance")
db-optimize:       score 20 (keywords: "slow", desc: "optimize")
cache-flush:       score 15 (keywords: "performance")
error-log-read:    score 10 (keywords: "site")
opcode-cache:      score 10 (desc: "performance")
plugin-list:       score 0  (no match)
user-list:         score 0  (no match)
...95 others:      score 0
```

**Top 5 passed to LLM:**
1. site-health
2. db-optimize
3. cache-flush
4. error-log-read
5. opcode-cache

**Context savings:**
- Without filtering: 100 tools × 40 tokens = 4000 tokens
- With filtering: 5 tools × 40 tokens = 200 tokens
- **Saved:** 3800 tokens (95% reduction)

## Phase 2: Focused ReAct Execution

With only 5 tools in context, the LLM can reason clearly:

**System prompt:**
```
You are a WordPress assistant. Available tools:

1. site-health: Check site health (performance, errors, config)
2. db-optimize: Optimize database tables
3. cache-flush: Flush object cache
4. error-log-read: Read error log entries
5. opcode-cache-status: Check PHP OPcache status

[Instructions for tool usage...]
```

**User:** "my site is slow"

**LLM reasoning:**
```
Thought: "The user reports slowness. I should check site-health first 
          to identify the issue."
Action: site-health
Observation: "Database optimization recommended, 15 unoptimized tables"

Thought: "Database is the issue. I'll run db-optimize."
Action: db-optimize
Observation: "Optimized 15 tables, saved 125MB"

Response: "I found and fixed the issue. Your database had 15 unoptimized 
           tables causing slowness..."
```

**Result:** Correct tool selection with 95% less context.

## Phase 3: Dynamic Tool Injection

### The Recursive Part

Sometimes the initial tool set isn't sufficient:

**User:** "my site is slow"

**Phase 1 selects:**
- site-health, db-optimize, cache-flush, error-log-read, opcode-cache

**LLM executes:**
```
[Iteration 1]
Action: site-health
Observation: "47 orphaned cron events detected"

[Iteration 2]
Thought: "Cron issues detected, but I don't have a cron tool available. 
          I need to search for cron management tools."
Action: search-tools("cron management")
```

### Meta-Ability: search-tools

A special ability that searches the full tool index:

```javascript
registerAbility('wp-agentic-admin/search-tools', {
    label: 'Search for additional tools by description',
    
    execute: async ({ query }) => {
        const allAbilities = getAllAbilities();
        const matches = allAbilities.filter(ability => {
            return ability.description.toLowerCase().includes(query.toLowerCase()) ||
                   ability.keywords.some(kw => query.includes(kw));
        });
        
        return {
            matches: matches.map(a => ({
                id: a.id,
                label: a.label,
                description: a.description,
            })),
        };
    },
});
```

**Observation:**
```json
{
    "matches": [
        {
            "id": "wp-agentic-admin/cron-list",
            "label": "List scheduled cron events",
            "description": "Get all WordPress cron events with schedules"
        }
    ]
}
```

**System response:**
```
[Tool cron-list has been added to your available tools]
```

**Next iteration:**
```
[Iteration 3]
Thought: "Now I can list the cron events"
Action: cron-list
Observation: "47 events listed, 42 are orphaned"

Response: "I found 42 orphaned cron events causing performance issues..."
```

### Why This Works

The LLM discovers tools **on-demand** based on observations, not upfront. This is the "recursive" part — the LLM can expand its own tool set mid-conversation.

## Implementation Notes

### Keyword Index

Each ability already has a `keywords` array:

```javascript
registerAbility('wp-agentic-admin/plugin-list', {
    keywords: ['plugin', 'list', 'installed', 'active'],
    // ...
});
```

**Phase 1 uses this directly** — no new metadata required.

### Description Field

The `description` field (added in v0.4.x) provides searchable text:

```php
'description' => 'Get comprehensive site health information including PHP version, WordPress version, database status, and server configuration'
```

**Phase 1 & 3 use this for scoring** — already implemented.

### Fallback Behavior

If keyword matching finds **zero** candidates:

```javascript
if (topAbilities.length === 0) {
    // Fallback: load all tools (current behavior)
    topAbilities = getAllAbilities();
}
```

Ensures the system never fails to present tools (just degrades to current behavior).

### Third-Party Compatibility

Third-party abilities automatically work:

```php
// Third-party plugin
wp_agentic_admin_register_ability(
    'my-plugin/backup-restore',
    array(
        'description' => 'Restore site from backup file',
        // ...
    ),
    array(
        'keywords' => ['backup', 'restore', 'recovery'],
    )
);
```

**Phase 1 indexes it automatically** — no special registration needed.

## Performance Impact

### Token Savings

| Scenario | Without RLM | With RLM | Savings |
|----------|-------------|----------|---------|
| 14 abilities | 500 tokens | 200 tokens | 60% |
| 50 abilities | 2000 tokens | 200 tokens | 90% |
| 100 abilities | 4000 tokens | 200 tokens | 95% |

### Latency

**Phase 1 (Keyword Matching):**
- Cost: < 1ms (JavaScript array operations)
- Negligible impact

**Phase 2 (Focused ReAct):**
- Cost: Same as current (2-5s per iteration)
- No added latency

**Phase 3 (Dynamic Injection):**
- Cost: +1 iteration when needed (~3s)
- Only used when initial set is insufficient (~10% of queries)

**Overall:** 95% of queries have zero latency penalty, 5% pay one extra iteration.

## Accuracy Considerations

### Will Keyword Matching Miss Relevant Tools?

**Potential issue:**
```
User: "is debug mode enabled?"
Keywords: ["debug", "mode", "enabled"]

Ability: error-log-read
Keywords: ["error", "log", "debug"]
Description: "Read debug.log entries"

Match? Yes (shared "debug")
```

**However:**
```
User: "is debug mode enabled?"

Ability: get-wp-config
Keywords: ["config", "wp-config"]
Description: "Read WordPress configuration options"

Match? No (no shared keywords)
```

The `get-wp-config` ability is actually more relevant but has no overlapping keywords.

**Solution:** Phase 3 (search-tools) allows the LLM to discover missed tools:

```
[Iteration 1]
Action: error-log-read  (from Phase 1 selection)
Observation: "Log is empty, but that doesn't tell me if debug mode is enabled"

[Iteration 2]
Thought: "I need to check WP_DEBUG configuration"
Action: search-tools("configuration debug")
Observation: "Found: get-wp-config"

[Iteration 3]
Action: get-wp-config
Observation: "WP_DEBUG = false"

Response: "Debug mode is disabled (WP_DEBUG = false)"
```

### Semantic Matching (Future Enhancement)

Keyword matching is deterministic but limited. **Future improvement:** Use embedding-based semantic search:

```javascript
// Compute embeddings for all ability descriptions (one-time)
const abilityEmbeddings = await computeEmbeddings(abilities.map(a => a.description));

// User query embedding
const queryEmbedding = await computeEmbedding(userMessage);

// Cosine similarity ranking
const scores = abilityEmbeddings.map(emb => cosineSimilarity(queryEmbedding, emb));
const topAbilities = selectTopK(abilities, scores, 5);
```

**Benefit:** Handles indirect relevance (e.g., "speed up my site" → db-optimize, even without keyword "speed")

**Cost:** Requires embedding model (~50MB) + inference (~50ms)

**Status:** Planned post-hackathon

## Testing Strategy

### Unit Tests

**Test keyword matching accuracy:**
```javascript
test('should select site-health for "my site is slow"', () => {
    const message = "my site is slow";
    const topTools = selectTopTools(message, abilities, 5);
    
    expect(topTools[0].id).toBe('wp-agentic-admin/site-health');
});

test('should fall back to all tools when no match', () => {
    const message = "xyzabc12345";  // Nonsense
    const topTools = selectTopTools(message, abilities, 5);
    
    expect(topTools.length).toBe(abilities.length);  // All tools
});
```

### E2E Tests

**Test end-to-end flows:**
```javascript
test('should use dynamic injection for cron issues', async () => {
    const message = "my site is slow";
    const result = await processMessageWithRLM(message);
    
    // Should start with site-health (Phase 1 selection)
    expect(result.toolsUsed[0]).toBe('site-health');
    
    // If cron issues found, should search and use cron-list (Phase 3)
    if (result.observations[0].includes('cron')) {
        expect(result.toolsUsed).toContain('search-tools');
        expect(result.toolsUsed).toContain('cron-list');
    }
});
```

## Rollout Plan

### Stage 1: Implement Phase 1 (Hackathon)
- Keyword-based tool filtering
- Top-K selection (K=5)
- Fallback to all tools if zero matches
- **Deliverable:** Working tool pre-filter

### Stage 2: Implement Phase 3 (Hackathon)
- Meta-ability `search-tools`
- Dynamic tool injection
- E2E tests for recursive discovery
- **Deliverable:** Self-expanding tool set

### Stage 3: Semantic Search (Post-Hackathon)
- Integrate lightweight embedding model
- Replace/augment keyword matching
- Benchmark accuracy improvements
- **Deliverable:** Smarter tool selection

## Alternative Approaches Considered

### A. Category-Based Routing

**Idea:** Group tools into categories, ask LLM to pick category first

```
Categories: diagnostics, performance, content, security

[Iteration 1]
Thought: "User has performance issue"
Action: select-category("performance")

[Iteration 2]
System: [Loads only performance tools]
Thought: "I'll check site-health"
Action: site-health
```

**Pros:**
- Conceptually clean
- Easy for third parties (just tag with category)

**Cons:**
- Multi-category queries ("check errors AND optimize database")
- Extra LLM iteration for category selection
- Categories are subjective (is `error-log-read` diagnostics or debugging?)

**Decision:** RLM approach is more flexible (no rigid categories, handles cross-category queries naturally).

### B. Two-Stage LLM Selection

**Idea:** Use a tiny classifier model to pre-select tools, then main LLM uses them

```
[Stage 1: Classifier]
Input: "my site is slow"
Output: [site-health, db-optimize, cache-flush] (predicted relevant tools)

[Stage 2: Main LLM]
Tools: [site-health, db-optimize, cache-flush] (only 3)
Reasoning: Full ReAct loop
```

**Pros:**
- Higher accuracy than keyword matching
- Still fast (tiny classifier is quick)

**Cons:**
- Requires training/fine-tuning a classifier
- Adds deployment complexity (two models)
- Doesn't help if classifier makes wrong prediction (no Phase 3 recovery)

**Decision:** Keyword matching is simpler, deterministic, and Phase 3 provides recovery mechanism.

## Testing Tool Selection (For LLM Testers)

If you're writing tests for tool selection accuracy, here's how to approach it.

### What to Test

Tool selection has two layers that need separate testing:

1. **Keyword matching (Phase 1)** — deterministic, fast, testable with unit tests
2. **LLM tool choice (Phase 2)** — probabilistic, requires ability tests against a real model

### Writing Keyword Matching Tests

These go in `src/extensions/services/__tests__/` and run with `npm test`. They verify that the right abilities surface for a given message:

```javascript
// Test obvious matches
test( 'selects plugin-list for "show me my plugins"', () => {
    const result = router.selectTools( 'show me my plugins' );
    expect( result[ 0 ].id ).toContain( 'plugin-list' );
} );

// Test ambiguous messages (user doesn't use exact keywords)
test( 'selects site-health for "everything feels sluggish"', () => {
    const result = router.selectTools( 'everything feels sluggish' );
    expect( result.map( t => t.id ) ).toContain( 'wp-agentic-admin/site-health' );
} );

// Test zero-match fallback
test( 'falls back to all tools for unrecognizable input', () => {
    const result = router.selectTools( 'asdfghjkl' );
    expect( result.length ).toBeGreaterThan( 5 );
} );
```

### Writing Edge-Case Prompts

The hardest cases for keyword matching are messages that don't use obvious terms. These are the most valuable tests to write:

| User says | Expected ability | Why it's hard |
|-----------|-----------------|---------------|
| "everything feels sluggish" | `site-health` | No keyword "slow", "performance", or "health" |
| "I think I got hacked" | `security-scan` | No keyword "security" — uses colloquial language |
| "clean up old drafts" | `revision-cleanup` | "drafts" isn't "revisions" |
| "what's eating my disk space" | `disk-usage` | Metaphorical phrasing |
| "check if anything needs updating" | `update-check` | Indirect reference |

If a test fails, the fix is usually adding a keyword to the ability's `keywords` array — not changing the matching algorithm.

### Writing Ability Tests (Full LLM Loop)

These go in `tests/abilities/core-abilities.test.js` and run against Ollama with a real Qwen 3 1.7B model:

```javascript
{
    name: 'should select site-health for vague performance complaint',
    message: 'my WordPress admin is taking forever to load pages',
    expectedTool: 'site-health',
}
```

These tests verify that the full pipeline (keyword match → LLM reasoning → tool call) selects the right tool. Run with `npm run test:abilities`.

### When to Add Tests

- **New ability added** → add at least one obvious and one ambiguous test prompt
- **User reports wrong tool selected** → add their exact message as a regression test
- **Keywords changed** → re-run full suite to check for regressions

## Summary

Tool selection at scale uses a three-phase RLM-inspired approach: (1) Keyword-based pre-filtering reduces 100+ tools to top 5 candidates with zero latency, (2) Focused ReAct executes with minimal context, (3) Dynamic injection allows the LLM to search for additional tools mid-conversation. This strategy saves 90-95% of context window space, maintains decision quality, and works automatically with third-party abilities. Implementation is deterministic (Phase 1), flexible (Phase 3), and extensible (future semantic search).

**Next:** [Debugging & Development](12-debugging-development.md)
