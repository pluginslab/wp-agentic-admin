# Third-Party Plugin Integration

This guide explains how third-party WordPress plugins can extend WP-Agentic-Admin with custom abilities.

## Overview

WP-Agentic-Admin provides a public API that allows any WordPress plugin to register abilities that integrate with the AI chat interface. This works similarly to how Gutenberg exposes `wp.blocks.registerBlockType()`.

## Quick Start

### PHP: Register the Backend

Hook into `wp_agentic_admin_register_abilities` to register your ability:

```php
add_action( 'wp_agentic_admin_register_abilities', function() {
    register_agentic_ability(
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

Enqueue your script with `wp-agentic-admin` as a dependency:

```php
add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( 'toplevel_page_wp-agentic-admin' !== $hook ) {
        return;
    }
    
    wp_enqueue_script(
        'my-plugin-agentic-abilities',
        plugins_url( 'assets/js/agentic-abilities.js', __FILE__ ),
        array( 'wp-agentic-admin' ),
        '1.0.0',
        true
    );
});
```

Then register your ability in JavaScript:

```javascript
// assets/js/agentic-abilities.js
(function() {
    // Wait for the API to be available
    if (typeof wp === 'undefined' || !wp.agenticAdmin) {
        console.warn('WP Agentic Admin not available');
        return;
    }
    
    wp.agenticAdmin.registerAbility('my-plugin/my-ability', {
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
            return await wp.agenticAdmin.executeAbility('my-plugin/my-ability', {});
        },
        
        requiresConfirmation: false,
    });
})();
```

## API Reference

### PHP API

#### `register_agentic_ability( $id, $php_config, $js_config )`

Registers an ability with both the WordPress Abilities API and the Agentic Admin chat system.

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

> **Auto-forwarded PHP values:** The `get_agentic_abilities_js_config()` function automatically forwards the PHP config's `label` and `description` values to the JavaScript frontend as `phpLabel` and `description` keys respectively. This means you do not need to duplicate label/description information in your JS config -- simply set them in the PHP config and they will be available on the JS side automatically.

#### `unregister_agentic_ability( string $id ): bool`

Removes a previously registered ability. Returns `true` if the ability was found and removed, `false` if it did not exist.

```php
$removed = unregister_agentic_ability( 'my-plugin/my-ability' );
```

#### `get_agentic_abilities(): array`

Returns all registered abilities as an associative array keyed by ability ID. Each entry contains `id`, `php` (PHP config), and `js` (JS config) keys.

```php
$all_abilities = get_agentic_abilities();
foreach ( $all_abilities as $id => $ability ) {
    echo $ability['php']['label'];
}
```

#### `get_agentic_ability( string $id ): ?array`

Returns the configuration for a specific ability, or `null` if not found.

```php
$ability = get_agentic_ability( 'my-plugin/my-ability' );
if ( $ability ) {
    echo $ability['php']['label'];
}
```

#### `agentic_ability_exists( string $id ): bool`

Checks if an ability with the given ID is registered.

```php
if ( agentic_ability_exists( 'my-plugin/my-ability' ) ) {
    // Ability is registered
}
```

### JavaScript API

The public API is available at `wp.agenticAdmin`:

#### `wp.agenticAdmin.registerAbility( id, config )`

Registers an ability with the chat system.

```javascript
wp.agenticAdmin.registerAbility('my-plugin/my-ability', {
    label: 'Human-readable description',  // Used in AI system prompt
    keywords: ['trigger', 'words'],
    initialMessage: 'Processing...',
    summarize: (result, userMessage) => 'Summary text',
    execute: async (params) => { /* return result */ },
    parseIntent: (userMessage) => { /* return structured params */ },
    requiresConfirmation: false,
    confirmationMessage: 'Are you sure?',
});
```

> **Note on `label`:** The `label` property is used to build the AI's system prompt. It tells the LLM what capabilities are available. If omitted, a label is derived from the ability ID (e.g., `my-plugin/user-list` → "user list"). Always provide a descriptive label for best results.

> **Note on `summarize()`:** When the browser-based LLM is loaded, WP-Agentic-Admin uses the LLM to generate natural language summaries from raw tool results. The `summarize()` function serves as a **fallback** for when:
> - The LLM is not yet loaded (user hasn't clicked "Load Model")
> - The LLM fails to generate a response
> - Error scenarios where graceful degradation is needed
>
> You should still implement `summarize()` for all abilities to ensure a good user experience in all scenarios.

> **Note on `parseIntent()`:** The optional `parseIntent` function receives the user's natural language message and returns a structured parameters object. This is called by the orchestrator before `execute()`, `requiresConfirmation()`, and `getConfirmationMessage()`. It is useful when your ability needs to parse specific values (e.g., plugin slugs, post IDs) from the user's message. See `revision-cleanup.js`, `transient-flush.js`, and `core-site-info.js` for real-world examples. Alternatively, you can extract params directly inside your `execute()` function (as `plugin-activate.js` and `plugin-deactivate.js` do with a local `extractParams` helper).

#### `wp.agenticAdmin.executeAbility( id, input )`

Executes an ability and returns the result.

```javascript
const result = await wp.agenticAdmin.executeAbility('my-plugin/my-ability', {
    param1: 'value1',
});
```

#### `wp.agenticAdmin.getAbility( id )`

Returns the configuration for a registered ability.

```javascript
const ability = wp.agenticAdmin.getAbility('my-plugin/my-ability');
```

#### `wp.agenticAdmin.getAbilities()`

Returns all registered abilities.

```javascript
const allAbilities = wp.agenticAdmin.getAbilities();
```

#### `wp.agenticAdmin.hasAbility( id )`

Checks if an ability is registered.

```javascript
if (wp.agenticAdmin.hasAbility('my-plugin/my-ability')) {
    // Ability exists
}
```

#### `wp.agenticAdmin.unregisterAbility( id )`

Removes a registered ability.

```javascript
wp.agenticAdmin.unregisterAbility('my-plugin/my-ability');
```

### Workflow API

Workflows allow you to chain multiple abilities together as a single operation.

#### `wp.agenticAdmin.registerWorkflow( id, config )`

Registers a multi-step workflow.

```javascript
wp.agenticAdmin.registerWorkflow('my-plugin/my-workflow', {
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
| `description` | string | No | What the workflow does |
| `steps` | array | Yes | Array of step definitions |
| `keywords` | string[] | No | Trigger words for detection |
| `requiresConfirmation` | boolean | No | Show confirmation dialog (default: true) |
| `confirmationMessage` | string | No | Custom confirmation text |
| `summarize` | function | **Recommended** | Generate final summary from results |

> **Important:** Unlike single abilities where `summarize` is a fallback, workflow `summarize` functions are the **primary output**. The LLM is not used to generate workflow summaries. A good summarize function is critical for useful workflow output. See the [Workflows Guide - Summarize Deep Dive](./WORKFLOWS-GUIDE.md#summarize-function-deep-dive) for detailed guidance.

**Step Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `abilityId` | string | Yes | The ability to execute |
| `label` | string | Yes | Step label for progress UI |
| `mapParams` | function | No | Transform previous results to params |
| `rollback` | function | No | Undo if later step fails |
| `optional` | boolean | No | Continue if step fails (default: false) |
| `requiresConfirmation` | boolean | No | Show confirmation before this specific step executes (default: false) |
| `includeIf` | function\|object | No | Condition to determine if step should execute (see [Semi-Flexible Workflows](#semi-flexible-workflows)) |

#### `wp.agenticAdmin.unregisterWorkflow( id )`

Removes a registered workflow.

```javascript
wp.agenticAdmin.unregisterWorkflow('my-plugin/my-workflow');
```

#### `wp.agenticAdmin.getWorkflow( id )`

Returns the configuration for a registered workflow.

```javascript
const workflow = wp.agenticAdmin.getWorkflow('my-plugin/my-workflow');
```

#### `wp.agenticAdmin.getWorkflows()`

Returns all registered workflows.

```javascript
const allWorkflows = wp.agenticAdmin.getWorkflows();
```

#### `wp.agenticAdmin.hasWorkflow( id )`

Checks if a workflow is registered.

```javascript
if (wp.agenticAdmin.hasWorkflow('my-plugin/my-workflow')) {
    // Workflow exists
}
```

> **See Also:** For comprehensive workflow documentation including data passing between steps, rollback handling, and best practices, see the [Workflows Guide](./WORKFLOWS-GUIDE.md).

### Semi-Flexible Workflows

Workflows can have conditional step execution using `includeIf`.

#### Function-Based Conditions (Recommended)

Fast, deterministic logic that works with any model size:

```javascript
wp.agenticAdmin.registerWorkflow('my-plugin/smart-cleanup', {
    label: 'Smart Cleanup',
    description: 'Intelligently cleans up based on site state.',
    keywords: ['smart cleanup', 'intelligent cleanup'],
    steps: [
        {
            abilityId: 'my-plugin/analyze-site',
            label: 'Analyze site state',
        },
        {
            abilityId: 'my-plugin/optimize-database',
            label: 'Optimize database',
            // Only optimize if database is large or stale
            includeIf: (previousResults, params) => {
                const analysis = previousResults[0];
                if (!analysis?.success || !analysis.result) {
                    return false; // Skip if analysis failed
                }
                
                const dbSize = analysis.result.database_size || 0;
                const lastOptimized = analysis.result.last_optimized;
                
                // Execute if > 500MB OR not optimized in 30+ days
                if (dbSize > 500 * 1024 * 1024) return true;
                if (!lastOptimized) return true;
                
                const daysSince = (Date.now() - new Date(lastOptimized)) / (1000*60*60*24);
                return daysSince > 30;
            }
        },
        {
            abilityId: 'my-plugin/verify-health',
            label: 'Verify site health',
        },
    ],
    summarize: (results) => {
        const analysis = results.find(r => r.abilityId === 'my-plugin/analyze-site');
        const optimize = results.find(r => r.abilityId === 'my-plugin/optimize-database');
        
        let summary = 'Smart cleanup complete.\n\n';
        
        if (optimize?.skipped) {
            summary += '⊘ **Database:** Optimization skipped (not needed)\n';
        } else if (optimize?.success) {
            summary += '✓ **Database:** Optimized successfully\n';
        }
        
        return summary;
    },
});
```

#### LLM-Based Conditions (Requires 3B+ Model)

Semantic, flexible decisions using the local LLM:

```javascript
wp.agenticAdmin.registerWorkflow('my-plugin/context-aware', {
    label: 'Context-Aware Maintenance',
    keywords: ['context aware', 'smart maintenance'],
    steps: [
        {
            abilityId: 'my-plugin/gather-context',
            label: 'Gather site context',
        },
        {
            abilityId: 'my-plugin/deep-clean',
            label: 'Deep cleaning',
            // LLM decides based on context
            includeIf: {
                prompt: `Should we perform a deep clean?
                
                Context:
                - User said: "{userMessage}"
                - Database size: {dbSize}MB
                - Cache size: {cacheSize}MB
                - Last cleaned: {lastCleaned}
                
                Return JSON: { "execute": true/false, "reason": "explanation" }
                
                Execute if:
                - Database size > 500MB
                - Cache size > 100MB
                - Last cleaned > 14 days ago
                - User mentioned "deep" or "thorough"
                
                Skip if:
                - Recently cleaned (< 7 days)
                - User wants "quick" cleanup only`
            }
        },
    ],
});
```

**Variable Interpolation:**

Available context variables are auto-extracted from previous step results:

| Variable | Source | Example |
|----------|--------|---------|
| `{userMessage}` | Initial user query | "clean up my site" |
| `{dbSize}` | `result.database_size` | "750" |
| `{cacheSize}` | `result.cache_size` | "120" |
| `{lastCleaned}` | `result.last_cleaned` | "2026-01-10" |
| `{step0Result}` | Raw result from step 0 | Full object |
| `{ability-name}` | By ability short ID | `{gather-context}` |

**Best Practices:**

✅ **Use function-based for production** (fast, deterministic, works with any model)  
⚠️ **Use LLM-based for semantic flexibility** (requires 3B+ model for accuracy)  
✅ **Always check `stepResult?.success`** before accessing data  
✅ **Fail-safe defaults:** Steps execute on error (safe behavior)  
✅ **Check `stepResult?.skipped`** in summarize function

> **See Also:** For detailed includeIf examples and best practices, see [Workflows Guide - Semi-Flexible Workflows](./WORKFLOWS-GUIDE.md#semi-flexible-workflows).

## Filters

### `wp_agentic_admin_supported_post_types`

This filter (defined in `class-utils.php`) allows third-party plugins to modify the list of post types that support the block editor. The value is an array of arrays, each with `value` (post type slug) and `label` (human-readable name) keys.

```php
add_filter( 'wp_agentic_admin_supported_post_types', function( $post_types ) {
    // Add a custom post type
    $post_types[] = array(
        'value' => 'my_custom_type',
        'label' => 'My Custom Type',
    );

    // Or remove one
    $post_types = array_filter( $post_types, function( $pt ) {
        return $pt['value'] !== 'attachment';
    });

    return $post_types;
});
```

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

WP-Agentic-Admin uses an **LLM-first, summarize-fallback** approach for generating user-facing responses:

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
wp.agenticAdmin.registerAbility('my-plugin/search', {
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
        
        return await wp.agenticAdmin.executeAbility('my-plugin/search', {
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

| readonly | destructive | Method |
|----------|-------------|--------|
| `true` | - | GET |
| `false` | `false` | POST |
| `false` | `true` | DELETE |

> **Note:** The `idempotent` annotation is stored as metadata but is **informational only** -- it does not affect HTTP method selection. The actual logic in `abilities-api.js` is: `readonly` = GET, `destructive` = DELETE, everything else = POST.

> **Naming convention:** The PHP side uses `readonly` while the JavaScript side uses `isReadOnly`. The `abilities-api.js` checks both for compatibility: `annotations.isReadOnly === true || annotations.readonly === true`. You can use either name in your annotations and it will work correctly.

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
 * Plugin Name: My Agentic Ability
 * Description: Adds a custom ability to WP Agentic Admin
 */

// Register the ability
add_action( 'wp_agentic_admin_register_abilities', function() {
    if ( ! function_exists( 'register_agentic_ability' ) ) {
        return;
    }
    
    register_agentic_ability(
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
    if ( 'toplevel_page_wp-agentic-admin' !== $hook ) {
        return;
    }
    
    wp_enqueue_script(
        'my-plugin-agentic',
        plugins_url( 'agentic.js', __FILE__ ),
        array( 'wp-agentic-admin' ),
        '1.0.0',
        true
    );
});
```

**agentic.js:**
```javascript
(function() {
    if (!wp?.agenticAdmin) return;
    
    wp.agenticAdmin.registerAbility('my-plugin/count-posts', {
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
            
            return await wp.agenticAdmin.executeAbility('my-plugin/count-posts', {
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
console.log(wp.agenticAdmin.getAbilities());
console.log(wp.agenticAdmin.hasAbility('my-plugin/my-ability'));
```

### Test API Directly

Use the Abilities tab in Agentic Admin to test your ability's REST endpoint directly.

### Common Issues

1. **"input is not of type object"** - Add `'default' => array()` to your input_schema
2. **Ability not triggering** - Check keywords match user input
3. **Permission denied** - Verify permission_callback returns true for current user
4. **Script not loading** - Ensure dependency on `wp-agentic-admin`
