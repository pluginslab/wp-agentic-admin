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
| **destructive** | May cause data loss | Requires confirmation |
| **idempotent** | Safe to call multiple times | Can retry on failure |

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
│   ├── functions-abilities.php      # Public API: register_agentic_ability()
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
    register_agentic_ability(
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

### Step 2: Register in class-abilities.php

Add a call in the `register_core_abilities()` method:

```php
if ( function_exists( 'wp_agentic_admin_register_my_new_ability' ) ) {
    wp_agentic_admin_register_my_new_ability();
}
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

### HTTP Method Selection

| readonly | destructive | idempotent | HTTP Method |
|----------|-------------|------------|-------------|
| `true` | - | - | GET |
| `false` | `false` | - | POST |
| `false` | `true` | `true` | DELETE |
| `false` | `true` | `false` | POST |

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

### Fallback Behavior

If you don't provide a `label`, one is derived from the ability ID:
- `my-plugin/user-list` → "user list"
- `wp-agentic-admin/cache-flush` → "cache flush"

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
        // Handle errors
        if (result.error) {
            return `Failed: ${result.error}`;
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

```javascript
requiresConfirmation: true,
confirmationMessage: 'Are you sure? This action cannot be undone.',
```

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
    if (result.error) {
        return `Failed: ${result.error}`;
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

## Testing Your Ability

1. **Test PHP directly** - Use the Abilities tab in Agentic Admin to call the REST endpoint
2. **Test keyword detection** - Try various phrases in the chat
3. **Verify the summary** - Check formatting with real data
4. **Test error handling** - Ensure graceful failures
5. **Run WPCS** - Check WordPress Coding Standards: `phpcs --standard=WordPress includes/abilities/your-file.php`
