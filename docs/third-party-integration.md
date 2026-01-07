# Third-Party Plugin Integration

This guide explains how third-party WordPress plugins can extend WP-Neural-Admin with custom abilities.

## Overview

WP-Neural-Admin provides a public API that allows any WordPress plugin to register abilities that integrate with the AI chat interface. This works similarly to how Gutenberg exposes `wp.blocks.registerBlockType()`.

## Quick Start

### PHP: Register the Backend

Hook into `wp_neural_admin_register_abilities` to register your ability:

```php
add_action( 'wp_neural_admin_register_abilities', function() {
    register_neural_ability(
        'my-plugin/my-ability',
        array(
            'label'            => __( 'My Ability', 'my-plugin' ),
            'description'      => __( 'Does something awesome.', 'my-plugin' ),
            'category'         => 'sre-tools',
            'input_schema'     => array(
                'type'    => 'object',
                'default' => array(),
            ),
            'output_schema'    => array(
                'type'       => 'object',
                'properties' => array(
                    'success' => array( 'type' => 'boolean' ),
                    'message' => array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => 'my_plugin_execute_ability',
            'permission_callback' => function() {
                return current_user_can( 'manage_options' );
            },
            'meta'             => array(
                'show_in_rest' => true,
                'annotations'  => array(
                    'readonly'    => true,
                    'destructive' => false,
                    'idempotent'  => true,
                ),
            ),
        ),
        array(
            'keywords'       => array( 'my', 'ability' ),
            'initialMessage' => __( 'Running my ability...', 'my-plugin' ),
        )
    );
});

function my_plugin_execute_ability( array $input = array() ): array {
    // Your implementation
    return array(
        'success' => true,
        'message' => 'It worked!',
    );
}
```

### JavaScript: Register the Frontend

Enqueue your script with `wp-neural-admin-extensions` as a dependency:

```php
add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( 'toplevel_page_wp-neural-admin' !== $hook ) {
        return;
    }
    
    wp_enqueue_script(
        'my-plugin-neural-abilities',
        plugins_url( 'assets/js/neural-abilities.js', __FILE__ ),
        array( 'wp-neural-admin-extensions' ),
        '1.0.0',
        true
    );
});
```

Then register your ability in JavaScript:

```javascript
// assets/js/neural-abilities.js
(function() {
    // Wait for the API to be available
    if (typeof wp === 'undefined' || !wp.neuralAdmin) {
        console.warn('WP Neural Admin not available');
        return;
    }
    
    wp.neuralAdmin.registerAbility('my-plugin/my-ability', {
        // Label is used in the AI's system prompt to describe what it can do
        label: 'Do something awesome',
        keywords: ['my', 'ability', 'do something'],
        initialMessage: 'Running my ability...',
        
        // Fallback summary when LLM is not loaded.
        // When LLM IS loaded, it generates a natural response instead.
        summarize: (result) => {
            if (result.success) {
                return result.message || 'Done!';
            }
            return 'Something went wrong.';
        },
        
        execute: async (params) => {
            return await wp.neuralAdmin.executeAbility('my-plugin/my-ability', {});
        },
        
        requiresConfirmation: false,
    });
})();
```

## API Reference

### PHP API

#### `register_neural_ability( $id, $php_config, $js_config )`

Registers an ability with both the WordPress Abilities API and the Neural Admin chat system.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `$id` | string | Unique identifier in `namespace/ability-name` format |
| `$php_config` | array | WordPress Abilities API configuration |
| `$js_config` | array | Chat interface configuration (passed to frontend) |

**PHP Config Options:**

```php
array(
    'label'               => string,    // Human-readable name
    'description'         => string,    // What the ability does
    'category'            => string,    // Category slug (e.g., 'sre-tools')
    'input_schema'        => array,     // JSON Schema for input validation
    'output_schema'       => array,     // JSON Schema for output validation
    'execute_callback'    => callable,  // Function that performs the action
    'permission_callback' => callable,  // Function that checks permissions
    'meta'                => array(
        'show_in_rest' => bool,         // Expose via REST API (required: true)
        'annotations'  => array(
            'readonly'    => bool,      // Doesn't modify data
            'destructive' => bool,      // May cause data loss
            'idempotent'  => bool,      // Safe to repeat
        ),
    ),
)
```

**JS Config Options:**

```php
array(
    'keywords'             => array,    // Trigger words for chat detection
    'initialMessage'       => string,   // Shown while executing
    'requiresConfirmation' => bool,     // Show confirmation dialog
    'confirmationMessage'  => string,   // Custom confirmation text
)
```

### JavaScript API

The public API is available at `wp.neuralAdmin`:

#### `wp.neuralAdmin.registerAbility( id, config )`

Registers an ability with the chat system.

```javascript
wp.neuralAdmin.registerAbility('my-plugin/my-ability', {
    label: 'Human-readable description',  // Used in AI system prompt
    keywords: ['trigger', 'words'],
    initialMessage: 'Processing...',
    summarize: (result, userMessage) => 'Summary text',
    execute: async (params) => { /* return result */ },
    requiresConfirmation: false,
    confirmationMessage: 'Are you sure?',
});
```

> **Note on `label`:** The `label` property is used to build the AI's system prompt. It tells the LLM what capabilities are available. If omitted, a label is derived from the ability ID (e.g., `my-plugin/user-list` → "user list"). Always provide a descriptive label for best results.

> **Note on `summarize()`:** When the browser-based LLM is loaded, WP-Neural-Admin uses the LLM to generate natural language summaries from raw tool results. The `summarize()` function serves as a **fallback** for when:
> - The LLM is not yet loaded (user hasn't clicked "Load Model")
> - The LLM fails to generate a response
> - Error scenarios where graceful degradation is needed
>
> You should still implement `summarize()` for all abilities to ensure a good user experience in all scenarios.

#### `wp.neuralAdmin.executeAbility( id, input )`

Executes an ability and returns the result.

```javascript
const result = await wp.neuralAdmin.executeAbility('my-plugin/my-ability', {
    param1: 'value1',
});
```

#### `wp.neuralAdmin.getAbility( id )`

Returns the configuration for a registered ability.

```javascript
const ability = wp.neuralAdmin.getAbility('my-plugin/my-ability');
```

#### `wp.neuralAdmin.getAbilities()`

Returns all registered abilities.

```javascript
const allAbilities = wp.neuralAdmin.getAbilities();
```

#### `wp.neuralAdmin.hasAbility( id )`

Checks if an ability is registered.

```javascript
if (wp.neuralAdmin.hasAbility('my-plugin/my-ability')) {
    // Ability exists
}
```

#### `wp.neuralAdmin.unregisterAbility( id )`

Removes a registered ability.

```javascript
wp.neuralAdmin.unregisterAbility('my-plugin/my-ability');
```

### Workflow API (v1.1+)

Workflows allow you to chain multiple abilities together as a single operation.

#### `wp.neuralAdmin.registerWorkflow( id, config )`

Registers a multi-step workflow.

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/my-workflow', {
    label: 'My Multi-Step Workflow',
    description: 'Does multiple things in sequence.',
    keywords: ['do everything', 'full process'],
    steps: [
        { abilityId: 'my-plugin/step-one', label: 'First step' },
        { abilityId: 'my-plugin/step-two', label: 'Second step' },
    ],
    requiresConfirmation: true,
    confirmationMessage: 'This will run 2 operations. Continue?',
    summarize: (results) => {
        const success = results.every(r => r.success);
        return success ? 'All steps completed!' : 'Some steps failed.';
    },
});
```

**Config Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | string | Yes | Human-readable workflow name |
| `description` | string | Yes | What the workflow does |
| `steps` | array | Yes | Array of step definitions |
| `keywords` | string[] | No | Trigger words for detection |
| `requiresConfirmation` | boolean | No | Show confirmation dialog (default: true) |
| `confirmationMessage` | string | No | Custom confirmation text |
| `summarize` | function | **Recommended** | Generate final summary from results |

> **Important:** Unlike single abilities where `summarize` is a fallback, workflow `summarize` functions are the **primary output**. The LLM is not used to generate workflow summaries. A good summarize function is critical for useful workflow output. See the [Workflows Guide - Summarize Deep Dive](./workflows-guide.md#summarize-function-deep-dive) for detailed guidance.

**Step Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `abilityId` | string | Yes | The ability to execute |
| `label` | string | Yes | Step label for progress UI |
| `mapParams` | function | No | Transform previous results to params |
| `rollback` | function | No | Undo if later step fails |
| `optional` | boolean | No | Continue if step fails (default: false) |

#### `wp.neuralAdmin.unregisterWorkflow( id )`

Removes a registered workflow.

```javascript
wp.neuralAdmin.unregisterWorkflow('my-plugin/my-workflow');
```

#### `wp.neuralAdmin.getWorkflow( id )`

Returns the configuration for a registered workflow.

```javascript
const workflow = wp.neuralAdmin.getWorkflow('my-plugin/my-workflow');
```

#### `wp.neuralAdmin.getWorkflows()`

Returns all registered workflows.

```javascript
const allWorkflows = wp.neuralAdmin.getWorkflows();
```

#### `wp.neuralAdmin.hasWorkflow( id )`

Checks if a workflow is registered.

```javascript
if (wp.neuralAdmin.hasWorkflow('my-plugin/my-workflow')) {
    // Workflow exists
}
```

> **See Also:** For comprehensive workflow documentation including data passing between steps, rollback handling, and best practices, see the [Workflows Guide](./workflows-guide.md).

## Input Schema Best Practices

### Always Include a Default

For abilities that can be called without input, always include a top-level `default`:

```php
'input_schema' => array(
    'type'    => 'object',
    'default' => array(),  // REQUIRED!
    'properties' => array(),
),
```

**Why?** Read-only abilities use GET requests. When no input is provided, the API receives `null`. The `default` ensures `null` is normalized to an empty object before validation.

### Required Parameters

For abilities that need specific input:

```php
'input_schema' => array(
    'type'       => 'object',
    'properties' => array(
        'item_id' => array(
            'type'        => 'integer',
            'description' => 'The item ID to process.',
        ),
    ),
    'required' => array( 'item_id' ),
),
```

### Parameters with Defaults

```php
'input_schema' => array(
    'type'    => 'object',
    'default' => array( 'limit' => 10, 'order' => 'desc' ),
    'properties' => array(
        'limit' => array(
            'type'    => 'integer',
            'default' => 10,
            'minimum' => 1,
            'maximum' => 100,
        ),
        'order' => array(
            'type'    => 'string',
            'enum'    => array( 'asc', 'desc' ),
            'default' => 'desc',
        ),
    ),
),
```

## How Tool Responses Are Generated

WP-Neural-Admin uses an **LLM-first, summarize-fallback** approach for generating user-facing responses:

```
Tool executes → Returns raw data
                    │
                    ▼
            ┌───────────────┐
            │ LLM loaded?   │
            └───────────────┘
                    │
        ┌───────────┴───────────┐
        │ YES                   │ NO
        ▼                       ▼
┌───────────────────┐   ┌───────────────────┐
│ LLM generates     │   │ summarize()       │
│ natural summary   │   │ fallback used     │
│ from raw data     │   │                   │
└───────────────────┘   └───────────────────┘
```

### When LLM is Loaded

The LLM receives:
- The user's original question
- The raw JSON result from your tool

It then generates a contextual, natural language response tailored to what the user asked.

### When LLM is Not Loaded (Fallback)

Your `summarize()` function is called with the result data. This ensures users always get a meaningful response, even without the AI model.

### Why You Still Need `summarize()`

Even though the LLM handles most responses, `summarize()` is **required** because:

1. **Graceful degradation** - Users who haven't loaded the model still get useful responses
2. **Error resilience** - If the LLM fails, the fallback kicks in
3. **Testing** - Easier to test abilities without loading a 360MB model
4. **Performance** - Instant responses when LLM isn't needed

## Extracting Parameters from User Messages

When your ability needs input from the user's natural language message:

```javascript
wp.neuralAdmin.registerAbility('my-plugin/search', {
    keywords: ['search', 'find', 'look for'],
    initialMessage: 'Searching...',
    
    execute: async (params) => {
        const { userMessage } = params;
        
        // Extract search term from message
        // "search for widgets" -> "widgets"
        const match = userMessage.match(/(?:search|find|look)\s+(?:for\s+)?(.+)/i);
        const searchTerm = match ? match[1].trim() : '';
        
        if (!searchTerm) {
            return { error: 'What would you like me to search for?' };
        }
        
        return await wp.neuralAdmin.executeAbility('my-plugin/search', {
            query: searchTerm,
        });
    },
    
    summarize: (result) => {
        if (result.error) return result.error;
        if (result.items.length === 0) return 'No results found.';
        return `Found ${result.items.length} results.`;
    },
});
```

## HTTP Method Selection

The HTTP method is determined by annotations:

| readonly | destructive | idempotent | Method |
|----------|-------------|------------|--------|
| `true` | - | - | GET |
| `false` | `false` | - | POST |
| `false` | `true` | `true` | DELETE |
| `false` | `true` | `false` | POST |

## Confirmation Dialogs

For destructive actions, require user confirmation:

**PHP:**
```php
'meta' => array(
    'annotations' => array(
        'destructive' => true,
    ),
),
```

**JavaScript:**
```javascript
{
    requiresConfirmation: true,
    confirmationMessage: 'This will permanently delete all items. Continue?',
}
```

## Example: Complete Integration

Here's a complete example of a third-party plugin adding an ability:

**my-plugin.php:**
```php
<?php
/**
 * Plugin Name: My Neural Ability
 * Description: Adds a custom ability to WP Neural Admin
 */

// Register the ability
add_action( 'wp_neural_admin_register_abilities', function() {
    if ( ! function_exists( 'register_neural_ability' ) ) {
        return;
    }
    
    register_neural_ability(
        'my-plugin/count-posts',
        array(
            'label'            => __( 'Count Posts', 'my-plugin' ),
            'description'      => __( 'Count posts by type.', 'my-plugin' ),
            'category'         => 'sre-tools',
            'input_schema'     => array(
                'type'       => 'object',
                'default'    => array( 'post_type' => 'post' ),
                'properties' => array(
                    'post_type' => array(
                        'type'    => 'string',
                        'default' => 'post',
                    ),
                ),
            ),
            'output_schema'    => array(
                'type'       => 'object',
                'properties' => array(
                    'count'     => array( 'type' => 'integer' ),
                    'post_type' => array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => 'my_plugin_count_posts',
            'permission_callback' => function() {
                return current_user_can( 'edit_posts' );
            },
            'meta'             => array(
                'show_in_rest' => true,
                'annotations'  => array(
                    'readonly'    => true,
                    'destructive' => false,
                    'idempotent'  => true,
                ),
            ),
        ),
        array(
            'keywords'       => array( 'count posts', 'how many posts', 'post count' ),
            'initialMessage' => __( 'Counting posts...', 'my-plugin' ),
        )
    );
});

function my_plugin_count_posts( array $input = array() ): array {
    $post_type = $input['post_type'] ?? 'post';
    $count = wp_count_posts( $post_type );
    
    return array(
        'count'     => (int) $count->publish,
        'post_type' => $post_type,
    );
}

// Enqueue JS
add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( 'toplevel_page_wp-neural-admin' !== $hook ) {
        return;
    }
    
    wp_enqueue_script(
        'my-plugin-neural',
        plugins_url( 'neural.js', __FILE__ ),
        array( 'wp-neural-admin-extensions' ),
        '1.0.0',
        true
    );
});
```

**neural.js:**
```javascript
(function() {
    if (!wp?.neuralAdmin) return;
    
    wp.neuralAdmin.registerAbility('my-plugin/count-posts', {
        label: 'Count posts by type',
        keywords: ['count posts', 'how many posts', 'post count', 'number of posts'],
        initialMessage: 'Counting posts...',
        
        // Fallback: used when LLM is not loaded.
        // When LLM IS loaded, it receives the raw {count, post_type} data
        // and generates a natural response based on the user's question.
        summarize: (result, userMessage) => {
            const type = result.post_type === 'post' ? 'posts' : result.post_type;
            return `You have **${result.count}** published ${type}.`;
        },
        
        execute: async (params) => {
            const { userMessage } = params;
            
            // Try to detect post type from message
            let postType = 'post';
            if (userMessage.toLowerCase().includes('page')) {
                postType = 'page';
            } else if (userMessage.toLowerCase().includes('product')) {
                postType = 'product';
            }
            
            return await wp.neuralAdmin.executeAbility('my-plugin/count-posts', {
                post_type: postType,
            });
        },
    });
})();
```

## Debugging

### Check Registration

```javascript
// In browser console
console.log(wp.neuralAdmin.getAbilities());
console.log(wp.neuralAdmin.hasAbility('my-plugin/my-ability'));
```

### Test API Directly

Use the Abilities tab in Neural Admin to test your ability's REST endpoint directly.

### Common Issues

1. **"input is not of type object"** - Add `'default' => array()` to your input_schema
2. **Ability not triggering** - Check keywords match user input
3. **Permission denied** - Verify permission_callback returns true for current user
4. **Script not loading** - Ensure dependency on `wp-neural-admin-extensions`
