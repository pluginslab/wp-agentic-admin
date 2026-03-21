# Ability Patterns Reference

Quick reference for common patterns when building abilities.

## Annotations → HTTP Method Mapping

PHP annotations control the HTTP method the server expects:

| `readonly` | `destructive` | `idempotent` | HTTP Method |
|------------|---------------|--------------|-------------|
| `true`     | `false`       | `true`       | GET         |
| `false`    | `false`       | `false`      | POST        |
| `false`    | `true`        | `true`       | DELETE      |
| `false`    | `false`       | `true`       | POST        |

**Important**: `destructive: true` + `idempotent: true` → DELETE. If your ability writes data but isn't truly destructive, use `destructive: false`.

## PHP input_schema Default

Always include a top-level `default` in `input_schema`, even for abilities with no required input. Without it, GET requests fail with "input is not of type object".

```php
'input_schema' => array(
    'type'       => 'object',
    'default'    => array(), // Required for GET abilities
    'properties' => array( ... ),
),
```

## JS String Literals for label/description

The test loader extracts `label` and `description` via regex. They must be string literals:

```javascript
// GOOD
label: 'List installed plugins',
description: 'Show all plugins with their status and version.',

// BAD — test loader can't extract these
label: __( 'List installed plugins' ),
description: `Show all ${ type } plugins`,
```

## interpretResult vs summarize

- `interpretResult()` — fed to the LLM as context. Keep concise, single-line preferred. No markdown, no URLs in complex formats. The LLM must fit this in its 4096-token context window.
- `summarize()` — displayed to the user in the tool result UI. Can use markdown formatting.

## parseIntent Pattern

Use when input parameters come from natural language rather than structured args:

```javascript
parseIntent: ( message ) => {
    const lower = message.toLowerCase();
    let keepLast = 3;
    const keepMatch = lower.match( /keep\s*(?:last\s*)?(\d+)/ );
    if ( keepMatch ) {
        keepLast = parseInt( keepMatch[ 1 ], 10 );
    }
    return { keep_last: keepLast };
},
```

## Dynamic Confirmation

Use a function instead of a boolean when confirmation depends on parameters:

```javascript
requiresConfirmation: ( params ) => {
    return ! params.dry_run; // Only confirm actual operations
},
```

## Shared Helpers

For ability families (e.g., plugin-activate, plugin-deactivate):

- PHP: `includes/abilities/shared/{domain}-helpers.php`
- JS: `src/extensions/abilities/shared/{domain}-helpers.js`

Example: `plugin-helpers.js` provides `findPluginByName()` used by both activate and deactivate.

## PHP Return Format

Always return this structure:

```php
return array(
    'success' => true,
    'message' => 'Human-readable result.',
    // ... additional data fields
);
```

## Context Window Constraints

- 1.7B model: 4096 tokens, 7B model: 32768 tokens
- Tool descriptions are sent every request — keep `label` and `description` concise
- Tool results truncated to 2000 chars
- `interpretResult()` output replaces raw JSON for the LLM — keep it short
