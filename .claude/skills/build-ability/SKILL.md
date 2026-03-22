---
name: build-ability
description: Generate a complete ability through an interview-driven workflow
argument-hint: "<ability-name>"
allowed-tools: "Bash(npm *), Bash(npx *), Bash(composer *), Read, Write, Edit, Grep, Glob"
---

# Build Ability

Generate a complete WP-Agentic-Admin ability (PHP backend + JS frontend + index + tests) through an interview-driven workflow. If the user provides an ability name with the command (e.g., `/build-ability theme-list`), use it directly.

## Workflow

### Phase 1: Gather Requirements

If no ability name was provided, ask for it (kebab-case format).

Then ask these questions (batch into 1-2 messages, skip any already answered):

1. **What does this ability do?** (one sentence)
2. **What would a user say to trigger it?** (3-5 natural language examples)
3. **Operation type?**
   - Read-only (just reads data, e.g. list plugins)
   - Write (modifies something reversible, e.g. flush cache)
   - Destructive (may lose data or break things, e.g. deactivate plugin)
4. **Does it need input parameters?** If yes, what are they? Which are required vs optional?
5. **Is this a WordPress core wrapper?** (JS-only, no PHP — for `core/*` abilities)
6. **Does it belong to a family?** (e.g., another plugin-* or user-* ability with existing shared helpers)

Derive from the answers:
- `readonly`, `destructive`, `idempotent` annotations
- Whether `requiresConfirmation` is needed
- Whether `parseIntent` is needed (if input comes from natural language)
- Whether shared helpers should be created or reused
- The `permission_callback` capability (default: `manage_options`)

### Phase 2: Read Existing Patterns

Before generating code, read these files to match project conventions:

1. An existing ability closest to the new one's type:
   - Read-only: `src/extensions/abilities/plugin-list.js` + `includes/abilities/plugin-list.php`
   - Write: `src/extensions/abilities/cache-flush.js` + `includes/abilities/cache-flush.php`
   - Destructive: `src/extensions/abilities/revision-cleanup.js` + `includes/abilities/revision-cleanup.php`
   - With parseIntent: `src/extensions/abilities/revision-cleanup.js`
   - With shared helpers: `src/extensions/abilities/plugin-activate.js` + `src/extensions/abilities/shared/plugin-helpers.js`
2. `src/extensions/abilities/index.js` — to see current registration pattern
3. `tests/abilities/core-abilities.test.js` — to see test case format

Also read the full patterns reference: [references/ability-patterns.md](references/ability-patterns.md)

### Phase 3: Generate Files

Create files in this order:

#### 1. PHP Backend (skip for core wrappers)

File: `includes/abilities/{name}.php`

Rules:
- Function names: `wp_agentic_admin_register_{snake}` and `wp_agentic_admin_execute_{snake}`
- Always include `permission_callback`
- Always include `input_schema` with top-level `default` for optional/no-input abilities
- Always include `output_schema`
- Set `annotations` matching the operation type
- Return `array( 'success' => bool, 'message' => string, ... )`
- Use WordPress spacing: `array( 'key' => 'value' )` not `array('key'=>'value')`
- Use tabs for indentation

#### 2. JS Frontend

File: `src/extensions/abilities/{name}.js`

Rules:
- Export function: `register{PascalCase}`
- `label` and `description` must be **string literals** (test loader uses regex)
- `label`: action-oriented, for LLM system prompt (e.g., "List installed plugins with status")
- `description`: one sentence under 30 words, explains when to use this tool
- `keywords`: array of lowercase trigger words
- `summarize()`: human-readable summary, handle error case (`!result.success`)
- `interpretResult()`: plain-English for LLM, concise single-line format preferred
- `execute()`: call `executeAbility()` with the ability ID and params
- `requiresConfirmation`: true for destructive, false otherwise
- Use WordPress spacing: `registerAbility( 'id', { ... } )` not `registerAbility('id', {...})`
- Use tabs for indentation, single quotes

#### 3. Index Registration

File: `src/extensions/abilities/index.js`

Add:
- Import statement (grouped with other WP-Agentic-Admin or core abilities)
- Re-export statement
- Call inside `registerAllAbilities()`

#### 4. Test Cases

File: `tests/abilities/core-abilities.test.js`

Add 2-3 test cases with different phrasings to the `tests` array.

#### 5. Shared Helpers (if applicable)

If the ability belongs to a family with existing helpers, import and use them.
If creating a new family, create:
- `includes/abilities/shared/{domain}-helpers.php`
- `src/extensions/abilities/shared/{domain}-helpers.js`

### Phase 4: Validate

Run these commands:

```bash
npx wp-scripts lint-js src/extensions/abilities/{name}.js
composer lint -- includes/abilities/{name}.php
npm run build
```

Fix any lint errors before finishing.

### Phase 5: Summary

Print a summary:
- Files created/modified
- Ability ID
- Operation type (readonly/write/destructive)
- How to test: `npm run test:abilities -- --file tests/abilities/core-abilities.test.js`
- Reminder: test in browser chat with natural language prompts from the user's examples
