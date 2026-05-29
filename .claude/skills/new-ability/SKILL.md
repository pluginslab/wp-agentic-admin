---
name: new-ability
description: Scaffold a new ability with PHP backend, JS chat interface, and test case
argument-hint: "<ability-name>"
---

# Scaffold New Ability: $ARGUMENTS

## Before starting

Read these for the full patterns:
- An existing ability PHP file (e.g., `includes/abilities/cache-flush.php`)
- An existing ability JS file (e.g., `src/extensions/abilities/cache-flush.js`)
- `docs/ABILITIES-GUIDE.md` for parseIntent, confirmation, and annotation details

## Steps

1. **PHP backend** — create `includes/abilities/$ARGUMENTS.php`:
   - Use `register_agentic_ability( 'agentic-admin/$ARGUMENTS', $php_config, $js_config )`
   - Include `permission_callback` with appropriate `current_user_can()` check
   - Include `input_schema` with top-level `default` field
   - Include `output_schema`
   - Set `annotations`: `readonly`, `destructive`, `idempotent`
   - Implement `execute_callback` returning `{ success: bool, message: string, ... }`

2. **JS chat interface** — create `src/extensions/abilities/$ARGUMENTS.js`:
   - Use `registerAbility( 'agentic-admin/$ARGUMENTS', { ... } )`
   - Include: `label` (string literal), `description` (string literal), `keywords` (array), `initialMessage`, `summarize()`, `interpretResult()`, `execute()`
   - Set `requiresConfirmation` based on whether the ability is destructive

3. **Register** — add import and call in `src/extensions/abilities/index.js`

4. **Test case** — add at least one test case in `tests/abilities/core-abilities.test.js`

5. **Lint** — run `npx wp-scripts lint-js` on the new JS file and `composer lint` on the new PHP file

6. **Verify** — run `npm run test:abilities -- --file tests/abilities/core-abilities.test.js` to confirm the model selects the new ability correctly
