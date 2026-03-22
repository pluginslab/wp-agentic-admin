# Abilities Guide

This guide explains how to create new abilities for WP-Agentic-Admin. Abilities are the core building blocks that allow the AI assistant to perform actions on your WordPress site.

## Overview

Each ability consists of two parts:
1. **PHP Backend** - Registers with WordPress Abilities API and executes the actual functionality
2. **JavaScript Frontend** - Integrates with the chat system for keyword detection and response formatting

### Use Case Driven Development

WP-Agentic-Admin follows **use case driven development**: we prioritize abilities based on real-world WordPress administration needs, validated by:

- **WP-CLI command frequency** - Most commonly used commands
- **Hosting company support tickets** - Top customer requests
- **Site admin pain points** - Daily WordPress management tasks

For architectural philosophy (why rigid vs flexible workflows, LLM strategy, etc.), see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Planning a New Ability

Before writing code, consider:

### 1. Is This Ability Actually Needed?

Before creating a new ability, ask:

- **Frequency:** Will site admins use this weekly? Monthly? Once ever?
- **Alternative:** Can existing abilities handle this use case?
- **Workflow:** Should this be part of a workflow instead of standalone?

**Example:**
- ✅ `cache-flush` - Used daily, standalone makes sense
- ✅ `plugin-update` - Frequent operation, needs standalone ability
- ❌ `clear-all-caches-and-optimize-db` - Should be a workflow, not an ability

### 2. What Type of Operation Is This?

Determine the operational characteristics:

| Characteristic | Meaning | Affects |
|----------------|---------|---------|
| **readonly** | Doesn't modify data | HTTP method (GET vs POST) |
| **destructive** | May cause data loss | HTTP method (DELETE), requires confirmation |
| **idempotent** | Safe to call multiple times | Informational annotation only (does NOT affect HTTP method selection) |

> **Note:** The `idempotent` annotation is purely informational metadata. It does not influence HTTP method selection or any runtime behavior in the current codebase. It may be used by external consumers or future features.

**Examples:**
- `plugin-list`: readonly ✓, destructive ✗, idempotent ✓
- `plugin-deactivate`: readonly ✗, destructive ✓, idempotent ✓
- `db-optimize`: readonly ✗, destructive ✗, idempotent ✓

### 3. Does It Have Required Input?

If the ability needs user-provided parameters:

- **Extract from natural language** - Pattern match the user's message
- **Provide clear error messages** - If extraction fails, explain what's missing
- **Use shared helpers** - Don't duplicate extraction logic across similar abilities

**Example:** `plugin-deactivate` needs a plugin slug → extract from "deactivate WooCommerce"

### 4. Should It Use Shared Helpers?

If creating multiple related abilities (e.g., user-list, user-create, user-update):

- Create `includes/abilities/shared/user-helpers.php` for common logic
- Create `src/extensions/abilities/shared/user-helpers.js` for JS utilities
- Keep individual ability files thin (just input validation + helper calls)

See the [Shared Helper Functions](#shared-helper-functions-best-practice) section below.

## File Structure

```
wp-agentic-admin/
├── includes/
│   ├── functions-abilities.php      # Public API: register/unregister/exists
│   ├── class-abilities.php          # Loads ability files, fires registration hook
│   └── abilities/                   # Individual PHP ability files
│       ├── shared/                  # Shared helper functions (NEW)
│       │   └── plugin-helpers.php   # Example: shared plugin management logic
│       ├── error-log-read.php
│       ├── cache-flush.php
│       ├── plugin-list.php
│       ├── plugin-activate.php
│       ├── plugin-deactivate.php
│       └── ...
└── src/extensions/
    ├── abilities/                   # Individual JS ability files
    │   ├── shared/                  # Shared helper functions (NEW)
    │   │   └── plugin-helpers.js    # Example: shared parameter extraction
    │   ├── index.js                 # Exports all abilities
    │   ├── error-log-read.js
    │   ├── cache-flush.js
    │   └── ...
    └── services/
        └── agentic-abilities-api.js  # Public API: wp.agenticAdmin.registerAbility()
```

## Creating a New Ability

### Step 1: Create the PHP File

Create a new file in `includes/abilities/` (e.g., `my-new-ability.php`):

```php
<?php
/**
 * My New Ability
 *
 * Description of what this ability does.
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register the my-new-ability.
 *
 * @return void
 */
function wp_agentic_admin_register_my_new_ability(): void {
    wp_agentic_admin_register_ability(
        'wp-agentic-admin/my-new-ability',
        // PHP configuration for WordPress Abilities API
        array(
            'label'               => __( 'My New Ability', 'wp-agentic-admin' ),
            'description'         => __( 'Does something useful.', 'wp-agentic-admin' ),
            'category'            => 'sre-tools',
            'input_schema'        => array(
                'type'                 => 'object',
                'default'              => array(), // REQUIRED for optional input!
                'properties'           => array(),
                'additionalProperties' => false,
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'success' => array(
                        'type'        => 'boolean',
                        'description' => __( 'Whether the operation succeeded.', 'wp-agentic-admin' ),
                    ),
                ),
            ),
            'execute_callback'    => 'wp_agentic_admin_execute_my_new_ability',
            'permission_callback' => function () {
                return current_user_can( 'manage_options' );
            },
            'meta'                => array(
                'show_in_rest' => true,
                'annotations'  => array(
                    'readonly'    => true,
                    'destructive' => false,
                    'idempotent'  => true,
                ),
            ),
        ),
        // JS configuration for chat interface
        array(
            'keywords'       => array( 'my', 'ability', 'keywords' ),
            'initialMessage' => __( 'Working on it...', 'wp-agentic-admin' ),
        )
    );
}

/**
 * Execute my-new-ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_agentic_admin_execute_my_new_ability( array $input = array() ): array {
    // Your implementation here
    return array(
        'success' => true,
    );
}
```

### Step 2: Register the Ability

**For core WP-Agentic-Admin abilities:** Add a call in the `register_core_abilities()` method in `class-abilities.php`:

```php
if ( function_exists( 'wp_agentic_admin_register_my_new_ability' ) ) {
    wp_agentic_admin_register_my_new_ability();
}
```

**For third-party plugins:** Use the `wp_agentic_admin_register_abilities` action hook instead of modifying `class-abilities.php` directly. This hook fires after all core abilities are registered:

```php
add_action( 'wp_agentic_admin_register_abilities', function() {
    if ( function_exists( 'wp_agentic_admin_register_ability' ) ) {
        wp_agentic_admin_register_my_new_ability();
    }
} );
```

### Step 3: Create the JavaScript File

Create a new file in `src/extensions/abilities/` (e.g., `my-new-ability.js`):

```javascript
/**
 * My New Ability
 * 
 * @package WPAgenticAdmin
 */

import { registerAbility, executeAbility } from '../services/agentic-abilities-api';

/**
 * Register the my-new-ability with the chat system.
 */
export function registerMyNewAbility() {
    registerAbility('wp-agentic-admin/my-new-ability', {
        // Label is used in the AI's system prompt to describe available capabilities
        label: 'My new ability description',
        keywords: ['my', 'ability', 'keywords'],
        initialMessage: 'Working on it...',
        
        summarize: (result) => {
            if (result.success) {
                return 'Operation completed successfully!';
            }
            return 'Something went wrong.';
        },
        
        execute: async (params) => {
            return executeAbility('wp-agentic-admin/my-new-ability', {});
        },
        
        requiresConfirmation: false,
    });
}

export default registerMyNewAbility;
```

### Step 4: Export from abilities/index.js

```javascript
export { registerMyNewAbility } from './my-new-ability';

export function registerAllAbilities() {
    // ... existing abilities ...
    registerMyNewAbility();
}
```

### Step 5: Build and Test

```bash
npm run build
```

## Input Schema: The `default` Key

> **CRITICAL**: Always include a top-level `default` in your `input_schema` for abilities that can be called without input.

### Why is this required?

The WP Abilities API determines HTTP method based on annotations:
- `readonly: true` → GET request
- `readonly: false` → POST request

GET requests don't have a JSON body. When no `input` query parameter is provided, the API receives `null`. If your schema says `type: 'object'` but receives `null`, validation fails:

```
Error: Ability "wp-agentic-admin/my-ability" has invalid input. Reason: input is not of type object.
```

### Solution

Add a top-level `default` to normalize `null` to an empty object:

```php
'input_schema' => array(
    'type'    => 'object',
    'default' => array(),  // <-- This fixes the issue!
    'properties' => array(),
),
```

For abilities with parameters that have defaults:

```php
'input_schema' => array(
    'type'    => 'object',
    'default' => array( 'lines' => 50, 'format' => 'text' ),
    'properties' => array(
        'lines' => array(
            'type'    => 'integer',
            'default' => 50,
        ),
        'format' => array(
            'type'    => 'string',
            'default' => 'text',
        ),
    ),
),
```

## Annotations Reference

Annotations control how the ability behaves:

| Annotation | Type | Description |
|------------|------|-------------|
| `readonly` | bool | `true` = GET request, doesn't modify data |
| `destructive` | bool | `true` = May cause data loss, requires confirmation |
| `idempotent` | bool | `true` = Safe to call multiple times with same result |

> **Naming difference:** The PHP side uses `readonly` in annotations, while the JS tool registry uses `isReadOnly`. The `abilities-api.js` `isReadOnly()` method checks **both** names for compatibility:
> ```javascript
> annotations.isReadOnly === true || annotations.readonly === true
> ```
> When writing PHP abilities, use `readonly`. When writing JS-only abilities or checking annotations in JS, either name works.

### HTTP Method Selection

The `abilities-api.js` `getHttpMethod()` function uses only `readonly` and `destructive` to determine the HTTP method. The `idempotent` annotation is not consulted:

| readonly | destructive | HTTP Method |
|----------|-------------|-------------|
| `true` | - | GET |
| `false` | `true` | DELETE |
| `false` | `false` | POST |

## Abilities with Required Input

For abilities that require user-provided parameters (like a plugin name):

### PHP Side

Use the `required` array in input schema:

```php
'input_schema' => array(
    'type'       => 'object',
    'properties' => array(
        'plugin' => array(
            'type'        => 'string',
            'description' => __( 'Plugin file path to deactivate.', 'wp-agentic-admin' ),
        ),
    ),
    'required'             => array( 'plugin' ),
    'additionalProperties' => false,
),
```

### JavaScript Side

Extract parameters from the user's natural language message:

```javascript
execute: async (params) => {
    const { userMessage } = params;
    
    // Extract plugin name from message
    const pluginMatch = userMessage.match(/deactivate\s+(\S+)/i);
    if (!pluginMatch) {
        return { error: 'Could not determine which plugin to deactivate.' };
    }
    
    const pluginSlug = pluginMatch[1];
    return executeAbility('wp-agentic-admin/plugin-deactivate', { 
        plugin: `${pluginSlug}/${pluginSlug}.php` 
    });
},
```

## The Label Property

The `label` property is **important** for the AI experience. It's used to build the LLM's system prompt, which tells the AI what capabilities are available.

### How It Works

When the chat system initializes, it builds a dynamic system prompt:

```
You are a WordPress assistant that can ONLY help with these specific tasks:
- List installed plugins
- Check site health (PHP version, WordPress version, server info)
- Read error logs
- Flush cache
- Optimize database
- Deactivate plugins

If the user asks about something else not listed above, politely explain 
that you can only help with the tasks listed above.
```

Each ability's `label` becomes a line in this list. This helps the LLM:
1. Know what it can do
2. Politely decline requests it can't handle
3. Not hallucinate capabilities it doesn't have

### Best Practices

```javascript
// Good - descriptive and action-oriented
label: 'List installed plugins'
label: 'Check site health (PHP version, WordPress version, server info)'
label: 'Flush object cache'

// Bad - too vague
label: 'Plugins'
label: 'Health'
label: 'Cache'
```

### Label Precedence

Both PHP and JS can define a `label` for the same ability. When both exist, the **JS label takes precedence** because `buildToolConfig()` in `agentic-abilities-api.js` merges configs with JS overriding PHP:

```javascript
const merged = {
    ...phpConfig,  // PHP values go first
    ...jsConfig,   // JS values override PHP
    id,
};
```

The original PHP label is still available as `phpLabel` (set by `wp_agentic_admin_get_abilities_js_config()` in `functions-abilities.php`). This means:
- `tool.label` -- the JS label (or PHP label if JS didn't provide one)
- `tool.phpLabel` -- always the PHP-defined label, if one was registered

### Fallback Behavior

If you don't provide a `label` in either PHP or JS, one is derived from the ability ID:
- `my-plugin/user-list` -> "user list"
- `wp-agentic-admin/cache-flush` -> "cache flush"

This works but isn't as descriptive. Always provide an explicit `label` for best results.

## Summarize Function

The `summarize` function generates human-readable output from ability results.

### Single Ability vs Workflow: Different Behaviors

**Important:** The summarize function behaves differently depending on context:

| Context | Summarize Function Role | When Used |
|---------|------------------------|-----------|
| **Single Ability** | Fallback only | When LLM unavailable or fails |
| **Workflow Step** | Primary output | Always - workflows bypass LLM for summaries |

```
┌─────────────────────────────────────────────────────────┐
│                  SINGLE ABILITY                         │
│  Tool executes → LLM generates response                 │
│                  (summarize only if LLM unavailable)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  WORKFLOW                               │
│  All steps execute → workflow.summarize() generates     │
│                      final output (LLM not used)        │
└─────────────────────────────────────────────────────────┘
```

### Why This Matters

For **single abilities**, the LLM sees your raw result data and generates contextual, natural responses. Your summarize function is a safety net.

For **workflows**, the LLM is bypassed entirely. Your workflow's `summarize` function is the **only** thing that generates the final message. A poor summarize function means users see useless output like "Completed 2 steps" instead of actual data.

### Single Ability Summarize (Fallback)

For individual abilities, provide a basic summarize function as a fallback:

```javascript
registerAbility('my-plugin/list-items', {
    // ... other config ...
    
    summarize: (result, userMessage = '') => {
        // Handle errors - PHP returns { success: false, message: '...' }
        if (!result.success && result.message) {
            return `Failed: ${result.message}`;
        }

        // Basic formatted response
        return `Found **${result.total} items**:\n\n` +
            result.items.map(i => `- ${i.name}`).join('\n');
    },
});
```

**Tips for single ability summaries:**
- Keep it simple - this is a fallback
- Use markdown for formatting
- Handle error cases
- Don't over-engineer - the LLM handles nuanced responses

### Workflow Summarize (Primary Output)

For workflows, the summarize function is **critical**. See the [Workflows Guide](./WORKFLOWS-GUIDE.md#summarize-function-deep-dive) for detailed guidance on writing effective workflow summaries, including:

- Understanding the results array structure
- Extracting data from step results
- Formatting with markdown
- Handling failures gracefully
- Complete production examples

**Quick example:**

```javascript
registerWorkflow('my-plugin/audit', {
    // ... steps ...
    
    summarize: (results) => {
        const itemsResult = results.find(r => r.abilityId === 'my-plugin/list-items');
        
        if (!itemsResult?.success) {
            return 'Audit failed - could not retrieve items.';
        }
        
        const { items = [], total = 0 } = itemsResult.result;
        
        let summary = `Audit complete.\n\n`;
        summary += `**Found ${total} items:**\n`;
        items.forEach(i => {
            summary += `- ${i.name} (${i.status})\n`;
        });
        
        return summary;
    },
});
```

## Bypassing the LLM for Display: `preferSummarize`

By default, after a single ability runs, the LLM generates a natural-language summary of the result. This is ideal for most abilities, but harmful for abilities that return large structured content (file contents, logs, raw data) because:

- The LLM has a 512-token output limit — large content gets truncated.
- The LLM may reformat or paraphrase content, losing accuracy.
- The round-trip to the LLM adds unnecessary latency.

Set `preferSummarize: true` on the JS ability to bypass the LLM entirely. The orchestrator will call `tool.summarize()` directly and display the result instantly, without streaming.

```javascript
registerAbility('wp-agentic-admin/my-ability', {
    // ...

    summarize: (result) => {
        // This output is shown directly — make it complete and well-formatted.
        return `**\`${result.file_path}\`**\n\n\`\`\`php\n${result.content}\n\`\`\``;
    },

    interpretResult: (result, userMessage) => {
        // Still called — gives context to the LLM for multi-tool chains.
        // Keep it brief; the LLM will NOT show this to the user.
        return `File \`${result.file_path}\` was read successfully.`;
    },

    // Bypasses LLM for display; uses summarize() output directly.
    preferSummarize: true,
});
```

### When to use `preferSummarize`

| Use it when… | Don't use it when… |
|---|---|
| Result contains large verbatim content (files, logs) | Result is a status or count the LLM can narrate naturally |
| Accurate formatting matters (code, tables) | You want the LLM to answer follow-up questions from the result |
| You want instant display without LLM latency | The ability is one step in a multi-tool chain |

### How it works

The ReAct agent short-circuits after the tool call — it skips the second LLM pass and returns `summarize()` output as the `finalAnswer`, tagged with `skipStreaming: true`. The chat orchestrator then renders it immediately without the char-by-char stream simulator.

`interpretResult` is still called and its output is still passed to the LLM in multi-tool ReAct chains. Keep it concise — it should confirm what happened, not reproduce the full content.

## Confirmation for Destructive Actions

For abilities that modify or delete data:

### PHP

```php
'meta' => array(
    'annotations' => array(
        'destructive' => true,
    ),
),
```

### JavaScript

Static confirmation (simple boolean and string):

```javascript
requiresConfirmation: true,
confirmationMessage: 'Are you sure? This action cannot be undone.',
```

**Dynamic confirmation:** Both `requiresConfirmation` and `getConfirmationMessage` can also be **functions** that receive the parsed parameters. This allows conditional confirmation based on what the user requested.

```javascript
// requiresConfirmation as a function: (params) => boolean
requiresConfirmation: (params) => {
    // Only require confirmation for actual deletions, not previews
    return !params.dry_run;
},

// getConfirmationMessage as a function: (params) => string
getConfirmationMessage: (params) => {
    const keepLast = params.keep_last || 3;
    return `This will delete post revisions, keeping the ${keepLast} most recent per post. Proceed?`;
},
```

When `requiresConfirmation` is a function, the `chat-orchestrator.js` calls it with the output of `parseIntent()` to decide at runtime whether to show the confirmation dialog. See `revision-cleanup.js` for a real-world example that combines `parseIntent`, dynamic `requiresConfirmation`, and `getConfirmationMessage`.

## The `parseIntent` Function

The `parseIntent` function is an optional property on an ability registration that allows the ability to parse the user's natural language message into structured parameters **before** execution. This is called by `chat-orchestrator.js` at the start of `processWithTool()`:

```javascript
const params = tool.parseIntent ? tool.parseIntent(userMessage) : {};
```

The returned params object is then passed to:
1. `requiresConfirmation(params)` -- to decide if confirmation is needed
2. `getConfirmationMessage(params)` -- to build a context-aware confirmation message
3. `execute(params)` -- to execute the ability with structured input

### When to Use `parseIntent`

Use `parseIntent` when your ability needs to extract structured parameters from conversational input. Without `parseIntent`, the `execute` function receives only `{ userMessage }` and must do its own parsing.

### Example

From `revision-cleanup.js`:

```javascript
registerAbility('wp-agentic-admin/revision-cleanup', {
    parseIntent: (message) => {
        const lowerMessage = message.toLowerCase();

        // Extract keep_last count from patterns like "keep 5 revisions"
        let keepLast = 3; // Default
        const keepMatch = lowerMessage.match(/keep\s*(?:last\s*)?(\d+)/);
        if (keepMatch) {
            keepLast = parseInt(keepMatch[1], 10);
        }

        // Check for "delete all" pattern
        if (lowerMessage.includes('all revision') || lowerMessage.includes('delete all')) {
            keepLast = 0;
        }

        // Check for dry run/preview
        const dryRun = lowerMessage.includes('dry run') || lowerMessage.includes('preview');

        return { keep_last: keepLast, dry_run: dryRun };
    },

    // params here comes from parseIntent
    requiresConfirmation: (params) => !params.dry_run,

    execute: async (params) => {
        return executeAbility('wp-agentic-admin/revision-cleanup', {
            keep_last: params.keep_last,
            dry_run: params.dry_run,
        });
    },
});
```

### Abilities Using `parseIntent`

- `transient-flush.js` -- Detects whether to flush only expired or all transients
- `revision-cleanup.js` -- Extracts `keep_last` count and dry-run mode
- `core-site-info.js` -- Detects which site info fields the user is asking about
- `core-environment-info.js` -- Returns empty params (no-op, but follows the pattern)

## Shared Helper Functions (Best Practice)

When creating multiple related abilities (e.g., `plugin-list`, `plugin-activate`, `plugin-deactivate`), extract common logic into shared helper functions to avoid code duplication.

### Why Use Shared Helpers?

Following [WordPress Abilities API best practices](https://developer.wordpress.org/news/2025/11/introducing-the-wordpress-abilities-api/), each ability should represent **one discrete operation** with clear operational characteristics (readonly, destructive, HTTP method). This means:

✅ **Correct:** Three separate abilities
- `wp-agentic-admin/plugin-list` (readonly: true)
- `wp-agentic-admin/plugin-activate` (readonly: false, destructive: false)
- `wp-agentic-admin/plugin-deactivate` (readonly: false, destructive: true)

❌ **Incorrect:** One unified ability with action parameter
- `wp-agentic-admin/plugin-manager` with mixed characteristics

However, separate abilities can lead to code duplication. **Solution: Shared helper functions.**

### PHP Shared Helpers Example

Create `includes/abilities/shared/plugin-helpers.php`:

```php
<?php
/**
 * Shared Plugin Helper Functions
 *
 * @package WPAgenticAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Get all installed plugins with their status.
 *
 * @param string $status_filter Filter by status: 'all', 'active', or 'inactive'.
 * @return array Array with plugins list and counts.
 */
function wp_agentic_admin_get_all_plugins( string $status_filter = 'all' ): array {
    if ( ! function_exists( 'get_plugins' ) ) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $all_plugins    = get_plugins();
    $active_plugins = get_option( 'active_plugins', array() );
    $plugins        = array();
    $active_count   = 0;

    foreach ( $all_plugins as $plugin_file => $plugin_data ) {
        $is_active = in_array( $plugin_file, $active_plugins, true );

        if ( 'active' === $status_filter && ! $is_active ) {
            continue;
        }
        if ( 'inactive' === $status_filter && $is_active ) {
            continue;
        }

        if ( $is_active ) {
            ++$active_count;
        }

        $plugins[] = array(
            'name'    => $plugin_data['Name'],
            'slug'    => $plugin_file,
            'version' => $plugin_data['Version'],
            'author'  => $plugin_data['Author'],
            'active'  => $is_active,
        );
    }

    return array(
        'plugins' => $plugins,
        'total'   => count( $plugins ),
        'active'  => $active_count,
    );
}

/**
 * Activate a plugin by its slug.
 *
 * @param string $plugin_file The plugin file path (slug) to activate.
 * @return array Result with success status and message.
 */
function wp_agentic_admin_activate_plugin_by_slug( string $plugin_file ): array {
    // Implementation with validation, error handling, etc.
}
```

Then your ability files become thin wrappers:

```php
// includes/abilities/plugin-list.php
function wp_agentic_admin_execute_plugin_list( array $input = array() ): array {
    $status = isset( $input['status'] ) ? $input['status'] : 'all';
    return wp_agentic_admin_get_all_plugins( $status );
}

// includes/abilities/plugin-activate.php
function wp_agentic_admin_execute_plugin_activate( array $input = array() ): array {
    if ( empty( $input['plugin'] ) ) {
        return array(
            'success' => false,
            'message' => __( 'No plugin specified.', 'wp-agentic-admin' ),
        );
    }
    return wp_agentic_admin_activate_plugin_by_slug( $input['plugin'] );
}
```

**Important:** Make sure `class-abilities.php` loads shared helpers before individual abilities:

```php
private function load_ability_files(): void {
    $abilities_dir = WP_AGENTIC_ADMIN_PLUGIN_DIR . 'includes/abilities/';

    // Load shared helper functions first
    $shared_helpers = $abilities_dir . 'shared/plugin-helpers.php';
    if ( file_exists( $shared_helpers ) ) {
        require_once $shared_helpers;
    }

    // Then load individual abilities
    $ability_files = glob( $abilities_dir . '*.php' );
    foreach ( $ability_files as $file ) {
        require_once $file;
    }
}
```

### JavaScript Shared Helpers Example

Create `src/extensions/abilities/shared/plugin-helpers.js`:

```javascript
/**
 * Extract plugin parameters from user message.
 *
 * @param {string} userMessage - The user's message.
 * @param {string[]} actionKeywords - Action-specific keywords.
 * @return {Object|null} Object with { plugin: "path/file.php" } or null.
 */
export function extractPluginParams(userMessage, actionKeywords = []) {
    // 1. Check static mappings for common plugins
    const pluginMappings = {
        'hello.php': ['hello dolly'],
        'akismet/akismet.php': ['akismet'],
        // ...
    };

    // 2. Check dynamic plugin list from plugin-list ability
    if (window.wpAgenticAdmin?.pluginsList) {
        // Fuzzy match against actual plugin names
    }

    // 3. Extract with regex using action keywords
    if (actionKeywords.length > 0) {
        const pattern = new RegExp(
            `(?:${actionKeywords.join('|')})\\s+(?:the\\s+)?(?:plugin\\s+)?["']?([a-z0-9-_ ]+)["']?`,
            'i'
        );
        // ...
    }

    return null;
}

/**
 * Format plugin action result for display.
 */
export function formatPluginActionResult(result, defaultMessage) {
    // PHP error responses use { success: false, message: '...' }
    if (result.success === false) {
        return `Failed: ${result.message}`;
    }
    return result.message || defaultMessage;
}
```

Then import and use in your ability files:

```javascript
// src/extensions/abilities/plugin-activate.js
import { extractPluginParams, formatPluginActionResult } from './shared/plugin-helpers';

function extractParams(userMessage) {
    return extractPluginParams(userMessage, ['activate', 'enable', 'turn on']);
}

export function registerPluginActivate() {
    registerAbility('wp-agentic-admin/plugin-activate', {
        // ...
        summarize: (result) => formatPluginActionResult(
            result, 
            'Plugin activated successfully.'
        ),
        execute: async ({ userMessage }) => {
            const params = extractParams(userMessage);
            if (!params) {
                return { error: 'Could not determine which plugin to activate.' };
            }
            return executeAbility('wp-agentic-admin/plugin-activate', params);
        },
    });
}
```

### Benefits of Shared Helpers

✅ **Maintains WordPress Abilities API principles** - Each ability is still distinct  
✅ **Eliminates code duplication** - Common logic in one place  
✅ **Easier maintenance** - Bug fixes update all abilities  
✅ **Better testability** - Shared functions can be unit tested  
✅ **Scalable** - Easy to add more related abilities (e.g., `plugin-install`, `plugin-update`)

### When to Use Shared Helpers

Use shared helpers when you have:
- Multiple abilities that operate on the same domain (plugins, posts, users, etc.)
- Common validation logic
- Similar parameter extraction patterns
- Shared error handling
- Common data formatting needs

## Wrapping WordPress Core Abilities (`core/*`)

WordPress 6.9+ ships with built-in abilities under the `core/*` namespace (e.g., `core/get-site-info`, `core/get-environment-info`). These are registered automatically by WordPress -- they have no PHP counterpart in `includes/abilities/`.

To provide a chat interface for a core ability, create **only a JS file** that wraps the core ability:

```javascript
// src/extensions/abilities/core-site-info.js
import { registerAbility, executeAbility } from '../services/agentic-abilities-api';

export function registerCoreSiteInfo() {
    registerAbility('core/get-site-info', {
        label: 'Check site information (name, URL, version, etc.)',
        keywords: ['site info', 'site name', 'wordpress version', 'site url'],
        initialMessage: 'Fetching site information...',

        parseIntent: (message) => {
            // Parse which fields the user wants
            const fields = [];
            if (message.includes('version')) fields.push('version');
            if (message.includes('name')) fields.push('name');
            return { fields: fields.length > 0 ? fields : undefined };
        },

        summarize: (result) => {
            return `**Site:** ${result.name}\n**URL:** ${result.url}\n**Version:** ${result.version}`;
        },

        execute: async (params) => {
            return executeAbility('core/get-site-info', params);
        },

        requiresConfirmation: false,
    });
}
```

Key differences from regular abilities:
- **No PHP file** in `includes/abilities/` -- WordPress core handles backend registration
- **No entry in `class-abilities.php`** -- the ability already exists in the WP Abilities API
- The ability ID uses the `core/` namespace (e.g., `core/get-site-info`), not `wp-agentic-admin/`
- See `core-site-info.js` and `core-environment-info.js` for working examples

## PHP API Reference

All public PHP functions are defined in `functions-abilities.php`.

### `wp_agentic_admin_register_ability( string $id, array $php_args, array $js_args = array() ): bool`

Registers an ability with both the WordPress Abilities API (backend) and stores JS configuration for the frontend. See the [Creating a New Ability](#creating-a-new-ability) section for full usage.

### `wp_agentic_admin_unregister_ability( string $id ): bool`

Removes a previously registered ability. Returns `true` if the ability was unregistered, `false` if it did not exist. Also calls `wp_unregister_ability()` if the WordPress Abilities API is available.

```php
// Example: conditionally remove an ability
if ( wp_agentic_admin_ability_exists( 'wp-agentic-admin/cache-flush' ) ) {
    wp_agentic_admin_unregister_ability( 'wp-agentic-admin/cache-flush' );
}
```

### `wp_agentic_admin_ability_exists( string $id ): bool`

Checks whether an ability with the given ID is currently registered. Useful for guard checks before registering or unregistering.

```php
if ( ! wp_agentic_admin_ability_exists( 'my-plugin/my-ability' ) ) {
    wp_agentic_admin_register_ability( 'my-plugin/my-ability', $php_args, $js_args );
}
```

### `wp_agentic_admin_get_abilities(): array`

Returns all registered abilities as an associative array keyed by ability ID.

### `wp_agentic_admin_get_ability( string $id ): ?array`

Returns the configuration for a single ability, or `null` if not found.

### `wp_agentic_admin_get_abilities_js_config(): array`

Returns JS-facing configurations for all abilities. Used internally by `wp_localize_script()` to pass ability metadata to the frontend. Includes `phpLabel`, `description`, and `annotations` from the PHP config.

## Testing Your Ability

1. **Test PHP directly** - Use the Abilities tab in Agentic Admin to call the REST endpoint
2. **Test keyword detection** - Try various phrases in the chat
3. **Verify the summary** - Check formatting with real data
4. **Test error handling** - Ensure graceful failures
5. **Run WPCS** - Check WordPress Coding Standards: `phpcs --standard=WordPress includes/abilities/your-file.php`
