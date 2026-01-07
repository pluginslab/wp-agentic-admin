# Abilities Guide

This guide explains how to create new abilities for WP-Neural-Admin. Abilities are the core building blocks that allow the AI assistant to perform actions on your WordPress site.

## Overview

Each ability consists of two parts:
1. **PHP Backend** - Registers with WordPress Abilities API and executes the actual functionality
2. **JavaScript Frontend** - Integrates with the chat system for keyword detection and response formatting

## File Structure

```
wp-neural-admin/
├── includes/
│   ├── functions-abilities.php      # Public API: register_neural_ability()
│   ├── class-abilities.php          # Loads ability files, fires registration hook
│   └── abilities/                   # Individual PHP ability files
│       ├── error-log-read.php
│       ├── cache-flush.php
│       └── ...
└── src/extensions/
    ├── abilities/                   # Individual JS ability files
    │   ├── index.js                 # Exports all abilities
    │   ├── error-log-read.js
    │   ├── cache-flush.js
    │   └── ...
    └── services/
        └── neural-abilities-api.js  # Public API: wp.neuralAdmin.registerAbility()
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
 * @package WPNeuralAdmin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register the my-new-ability.
 *
 * @return void
 */
function wp_neural_admin_register_my_new_ability(): void {
    register_neural_ability(
        'wp-neural-admin/my-new-ability',
        // PHP configuration for WordPress Abilities API
        array(
            'label'               => __( 'My New Ability', 'wp-neural-admin' ),
            'description'         => __( 'Does something useful.', 'wp-neural-admin' ),
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
                        'description' => __( 'Whether the operation succeeded.', 'wp-neural-admin' ),
                    ),
                ),
            ),
            'execute_callback'    => 'wp_neural_admin_execute_my_new_ability',
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
            'initialMessage' => __( 'Working on it...', 'wp-neural-admin' ),
        )
    );
}

/**
 * Execute my-new-ability.
 *
 * @param array $input Input parameters.
 * @return array
 */
function wp_neural_admin_execute_my_new_ability( array $input = array() ): array {
    // Your implementation here
    return array(
        'success' => true,
    );
}
```

### Step 2: Register in class-abilities.php

Add a call in the `register_core_abilities()` method:

```php
if ( function_exists( 'wp_neural_admin_register_my_new_ability' ) ) {
    wp_neural_admin_register_my_new_ability();
}
```

### Step 3: Create the JavaScript File

Create a new file in `src/extensions/abilities/` (e.g., `my-new-ability.js`):

```javascript
/**
 * My New Ability
 * 
 * @package WPNeuralAdmin
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the my-new-ability with the chat system.
 */
export function registerMyNewAbility() {
    registerAbility('wp-neural-admin/my-new-ability', {
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
            return executeAbility('wp-neural-admin/my-new-ability', {});
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
Error: Ability "wp-neural-admin/my-ability" has invalid input. Reason: input is not of type object.
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
            'description' => __( 'Plugin file path to deactivate.', 'wp-neural-admin' ),
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
    return executeAbility('wp-neural-admin/plugin-deactivate', { 
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
- `wp-neural-admin/cache-flush` → "cache flush"

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

For workflows, the summarize function is **critical**. See the [Workflows Guide](./workflows-guide.md#summarize-function-deep-dive) for detailed guidance on writing effective workflow summaries, including:

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

## Testing Your Ability

1. **Test PHP directly** - Use the Abilities tab in Neural Admin to call the REST endpoint
2. **Test keyword detection** - Try various phrases in the chat
3. **Verify the summary** - Check formatting with real data
4. **Test error handling** - Ensure graceful failures
