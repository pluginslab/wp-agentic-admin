# Instruction Scenarios — Test Cases

Common user requests to verify that the instruction system loads the right tools
and injects the right context. Try these in the wp-admin chat.

## Scenario 1: "What plugins do I have?"

**Expected behavior:**
1. Router detects keyword "plugins" → pre-loads `plugins` instruction
2. System prompt includes plugin-list, plugin-activate, plugin-deactivate tools
3. System prompt includes context: "After listing plugins, tell the user how many are active vs inactive..."
4. Agent calls `plugin-list` → summarizes active/inactive count

**What to verify:**
- Agent reports active vs inactive counts (context guidance working)
- Agent doesn't mention tools from other instructions (progressive disclosure working)

## Scenario 2: "My site is broken"

**Expected behavior:**
1. Router detects keyword "broken" → pre-loads `diagnostics` instruction
2. System prompt includes site-health, error-log-read, site-info, environment-info tools
3. System prompt includes context: "Start with error-log-read when the user reports something broken..."
4. Agent calls `error-log-read` first (not site-health), because the context says to start there

**What to verify:**
- Agent reads error log FIRST (context guidance steering tool order)
- If errors mention a plugin path, agent suggests loading plugins instruction (cross-instruction hint)

## Scenario 3: "Clean up my database"

**Expected behavior:**
1. Router detects keyword "database" → pre-loads `database` instruction
2. System prompt includes db-optimize and revision-cleanup tools
3. System prompt includes context: "Run revision-cleanup before db-optimize..."
4. Agent calls `revision-cleanup` first, then `db-optimize`

**What to verify:**
- Agent runs revision-cleanup BEFORE db-optimize (context guidance on ordering)
- Agent reports revision count and space before asking to confirm deletion
