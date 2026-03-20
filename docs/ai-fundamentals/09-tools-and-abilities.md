# Tools & Abilities

Tools (also called "abilities") are the actions the AI can perform on your WordPress site. They bridge the gap between natural language requests and actual system operations.

## What Are Abilities?

An **ability** is a discrete operation the AI can execute. Think of abilities as functions the AI can call:

```
User: "List my plugins"
       ↓
AI: Calls the "plugin-list" ability
       ↓
WordPress: Executes get_plugins()
       ↓
Result: Returns list of 24 installed plugins
       ↓
AI: Formats response for user
```

Each ability has:
- **ID** — Unique identifier (e.g., `wp-agentic-admin/plugin-list`)
- **Description** — What it does (for the AI to understand)
- **Input Schema** — What parameters it accepts
- **Output Schema** — What data it returns
- **Execute Callback** — PHP function that does the work
- **Permissions** — Who can use it (WordPress capabilities)

## Abilities vs Tools: What's the Difference?

These terms are used interchangeably, but technically:

**Ability:**
- WordPress ecosystem term
- Used in WordPress Abilities API (core feature in WP 6.9+)
- PHP-side concept
- Example: `wp-agentic-admin/cache-flush`

**Tool:**
- AI/LLM ecosystem term
- Used in OpenAI, Anthropic APIs ("function calling", "tool use")
- Describes any executable function the AI can invoke
- Example: The AI's "tools" include all registered abilities

**In WP Agentic Admin:**
- **Abilities** = backend PHP functions registered with WordPress
- **Tools** = frontend JS wrappers + AI tool descriptions

Both refer to the same underlying operations.

## How Abilities Work

### Registration (PHP Side)

Abilities are registered with WordPress using the Abilities API:

```php
register_agentic_ability(
    'wp-agentic-admin/plugin-list',  // Unique ID
    array(
        'label'               => 'List installed plugins',
        'description'         => 'Get all installed WordPress plugins',
        'category'            => 'sre-tools',
        'input_schema'        => array(
            'type'       => 'object',
            'default'    => array(),
            'properties' => array(),
        ),
        'output_schema'       => array(
            'type'       => 'object',
            'properties' => array(
                'plugins' => array( 'type' => 'array' ),
                'total'   => array( 'type' => 'integer' ),
            ),
        ),
        'execute_callback'    => 'wp_agentic_admin_execute_plugin_list',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
        'meta'                => array(
            'annotations' => array(
                'readonly'    => true,
                'destructive' => false,
                'idempotent'  => true,
            ),
        ),
    )
);
```

### Execution (Backend)

When the AI calls an ability, WordPress:

1. Validates the user has permission (`permission_callback`)
2. Validates input against `input_schema`
3. Calls the `execute_callback` function
4. Validates output against `output_schema`
5. Returns result via REST API

```php
function wp_agentic_admin_execute_plugin_list( array $input = array() ): array {
    if ( ! function_exists( 'get_plugins' ) ) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $all_plugins    = get_plugins();
    $active_plugins = get_option( 'active_plugins', array() );
    $plugins        = array();

    foreach ( $all_plugins as $plugin_file => $plugin_data ) {
        $plugins[] = array(
            'name'    => $plugin_data['Name'],
            'version' => $plugin_data['Version'],
            'active'  => in_array( $plugin_file, $active_plugins, true ),
        );
    }

    return array(
        'plugins' => $plugins,
        'total'   => count( $plugins ),
    );
}
```

### Tool Description (JavaScript Side)

The frontend registers a JS wrapper that tells the AI about the ability:

```javascript
registerAbility('wp-agentic-admin/plugin-list', {
    label: 'List installed plugins with status',
    keywords: ['plugin', 'list', 'installed'],
    
    execute: async (params) => {
        return executeAbility('wp-agentic-admin/plugin-list', {});
    },
    
    summarize: (result) => {
        return `You have **${result.total} plugins** installed:\n` +
            result.plugins.map(p => 
                `- ${p.name} (${p.active ? 'active' : 'inactive'})`
            ).join('\n');
    },
});
```

## Current Abilities (14 Total)

WP Agentic Admin ships with 14 abilities across different categories:

### Cache & Performance (4)

| Ability | Description | Type |
|---------|-------------|------|
| `cache-flush` | Flush WordPress object cache | Write |
| `db-optimize` | Optimize database tables | Write |
| `transient-flush` | Clear expired transients | Write |
| `rewrite-flush` | Flush rewrite rules | Write |

### Diagnostics (5)

| Ability | Description | Type |
|---------|-------------|------|
| `site-health` | Get comprehensive site health info | Read-only |
| `error-log-read` | Read recent debug.log entries | Read-only |
| `cron-list` | List scheduled cron events | Read-only |
| `rewrite-list` | List registered rewrite rules | Read-only |
| `core/get-environment-info` | Get PHP/DB/server info | Read-only |

### Plugin Management (3)

| Ability | Description | Type |
|---------|-------------|------|
| `plugin-list` | List installed plugins | Read-only |
| `plugin-activate` | Activate a plugin | Write |
| `plugin-deactivate` | Deactivate a plugin | Destructive |

### Content Management (2)

| Ability | Description | Type |
|---------|-------------|------|
| `revision-cleanup` | Remove old post revisions | Destructive |
| `core/get-site-info` | Get site name/URL/version | Read-only |
| `core/get-editor-blocks` | List available Gutenberg blocks | Read-only |

### Hackathon Goal: 17 More Abilities

The CloudFest Hackathon aims to add 17 new abilities:

**Site Management (6):**
- theme-list, theme-activate, user-list, user-role-update, permalink-update, maintenance-mode

**Content Operations (4):**
- post-list, post-publish, comment-stats, comment-moderate

**Security & Diagnostics (5):**
- error-log-search, security-scan, backup-check, update-check, disk-usage

**Performance (2):**
- opcode-cache-status, slow-query-log

See [CLOUDFEST_HACKATHON.md](../../CLOUDFEST_HACKATHON.md#2-expanded-abilities-library) for details.

## Ability Characteristics

Each ability has operational characteristics that control how it behaves:

### Readonly

**readonly: true** — Does not modify data, safe to call anytime

```php
'annotations' => array( 'readonly' => true )
```

- Uses GET HTTP method
- No confirmation required
- Can be called repeatedly without side effects

**Examples:** plugin-list, site-health, error-log-read

**readonly: false** — Modifies data, requires caution

```php
'annotations' => array( 'readonly' => false )
```

- Uses POST or DELETE HTTP method
- May require confirmation
- Changes system state

**Examples:** cache-flush, plugin-activate, db-optimize

### Destructive

**destructive: true** — May cause data loss or significant changes

```php
'annotations' => array( 'destructive' => true )
```

- Uses DELETE HTTP method
- Requires explicit user confirmation
- Cannot be easily undone

**Examples:** plugin-deactivate, revision-cleanup

**destructive: false** — Safe operations with no data loss

```php
'annotations' => array( 'destructive' => false )
```

- Uses GET or POST HTTP method
- May not require confirmation
- Changes are reversible

**Examples:** cache-flush, db-optimize

### Idempotent

**idempotent: true** — Calling multiple times has the same effect as calling once

```php
'annotations' => array( 'idempotent' => true )
```

- Safe to retry on failure
- No cumulative effects

**Examples:** cache-flush (flushing twice = flushing once), plugin-activate

**idempotent: false** — Each call may have different effects

```php
'annotations' => array( 'idempotent' => false )
```

- Retry may cause issues
- Results vary by call

**Examples:** revision-cleanup (if you delete "all but 3", calling twice might delete different revisions)

**Note:** `idempotent` is informational metadata only. It does not affect HTTP method selection or runtime behavior in the current implementation.

## HTTP Method Selection

Abilities automatically use the correct HTTP method based on annotations:

| readonly | destructive | HTTP Method |
|----------|-------------|-------------|
| `true` | - | **GET** |
| `false` | `true` | **DELETE** |
| `false` | `false` | **POST** |

This is handled automatically by `abilities-api.js` — you don't specify HTTP methods manually.

## Input & Output Schemas

Abilities use JSON Schema to define expected inputs and outputs:

### Input Schema Example

```php
'input_schema' => array(
    'type'       => 'object',
    'default'    => array( 'lines' => 50 ),
    'properties' => array(
        'lines' => array(
            'type'        => 'integer',
            'default'     => 50,
            'minimum'     => 1,
            'maximum'     => 1000,
            'description' => 'Number of log lines to read',
        ),
    ),
),
```

**Why the top-level `default`?**

Abilities with `readonly: true` use GET requests, which don't have a JSON body. If no input is provided, WordPress receives `null`. The top-level `default` normalizes `null` to an empty object, preventing validation errors.

See [ABILITIES-GUIDE.md § Input Schema: The default Key](../ABILITIES-GUIDE.md#input-schema-the-default-key).

### Output Schema Example

```php
'output_schema' => array(
    'type'       => 'object',
    'properties' => array(
        'success' => array(
            'type'        => 'boolean',
            'description' => 'Whether the operation succeeded',
        ),
        'message' => array(
            'type'        => 'string',
            'description' => 'Human-readable result message',
        ),
    ),
),
```

## How the AI Decides Which Tool to Use

The ReAct agent uses several mechanisms to select the right tool:

### 1. System Prompt

The AI receives a list of available tools in its system prompt:

```
Available tools:
- plugin-list: List installed plugins with status
- site-health: Check site health (PHP version, WordPress version, server info)
- error-log-read: Read recent error log entries
- cache-flush: Flush object cache
...
```

The AI reasons about which tool matches the user's intent.

### 2. Keyword Matching (Pre-Filter)

Before calling the AI, the message router checks keywords:

```javascript
// User: "list my plugins"
// Keywords: ['plugin', 'list', 'installed']
// Match: plugin-list ability
```

If a strong keyword match is found, the ability is passed to the AI as a suggestion.

### 3. Tool Descriptions

Each ability has a `description` field (PHP) and `label` (JS) that the AI uses to understand what the tool does:

```php
'description' => 'Get comprehensive site health information including PHP version, WordPress version, database status, and server configuration'
```

Better descriptions = better tool selection.

### 4. Observations (ReAct Loop)

The AI observes previous tool results to decide what to do next:

```
[Iteration 1]
Tool: site-health
Result: { status: 'warning', message: 'PHP errors detected' }

[Iteration 2]
AI Decision: "Errors detected, I should read the error log"
Tool: error-log-read
```

This adaptive behavior is the core of the ReAct pattern.

## Confirmation System

Destructive abilities require user confirmation before execution:

### JavaScript Configuration

```javascript
registerAbility('wp-agentic-admin/plugin-deactivate', {
    requiresConfirmation: true,
    confirmationMessage: 'Deactivating a plugin may break site functionality. Continue?',
    
    // Or dynamic:
    requiresConfirmation: (params) => !params.dry_run,
    getConfirmationMessage: (params) => {
        return `Deactivate ${params.plugin}? This may affect site functionality.`;
    },
});
```

### User Flow

```
User: "deactivate WooCommerce"
       ↓
AI: Selects plugin-deactivate tool
       ↓
System: Shows confirmation dialog
       ↓ 
User: Clicks "Confirm"
       ↓
Ability: Executes deactivation
       ↓
AI: Reports success
```

If the user clicks "Cancel", the ability is not executed and the AI is informed.

## Error Handling

Abilities return structured error responses:

### Success Response

```json
{
    "success": true,
    "message": "Cache flushed successfully",
    "data": { "cleared": 1247 }
}
```

### Error Response

```json
{
    "success": false,
    "message": "Plugin not found: nonexistent.php"
}
```

The AI sees these errors and can respond appropriately:

```
User: "activate nonexistent plugin"
AI calls: plugin-activate { plugin: "nonexistent.php" }
Result: { success: false, message: "Plugin not found" }
AI response: "I couldn't find a plugin with that name. Here are your installed plugins: [...]"
```

## Permissions & Security

Abilities respect WordPress permissions:

```php
'permission_callback' => function() {
    return current_user_can( 'manage_options' );
}
```

If a user lacks permissions:

```json
{
    "success": false,
    "message": "You do not have permission to perform this action"
}
```

The AI cannot bypass WordPress security — it operates within the logged-in user's capabilities.

## Third-Party Abilities

Other plugins can register custom abilities:

```php
add_action( 'wp_agentic_admin_register_abilities', function() {
    register_agentic_ability(
        'my-plugin/custom-ability',
        array(
            'label'            => 'My Custom Action',
            'description'      => 'Does something custom',
            'execute_callback' => 'my_plugin_execute_custom_ability',
            // ... full config
        )
    );
} );
```

The AI automatically discovers and uses third-party abilities — no core plugin changes needed.

See [THIRD-PARTY-INTEGRATION.md](../THIRD-PARTY-INTEGRATION.md) for details.

## Ability Lifecycle

### Registration

Happens on every page load:

```php
// In includes/class-abilities.php
add_action( 'init', array( $this, 'register_core_abilities' ) );

public function register_core_abilities() {
    wp_agentic_admin_register_plugin_list();
    wp_agentic_admin_register_site_health();
    // ... all core abilities
}
```

### Discovery

JavaScript queries the REST API for available abilities:

```javascript
const abilities = await fetch('/wp-json/abilities/v1/list');
// Returns all registered abilities with schemas
```

### Tool Registry

Abilities are stored in a registry accessible to the AI:

```javascript
const tools = getAvailableTools();
// Returns tool objects with execute(), summarize(), etc.
```

### Execution

When the AI calls a tool:

```javascript
const result = await executeAbility('wp-agentic-admin/plugin-list', {});
// Makes REST API request to WordPress
// Returns result to AI for observation
```

## Performance Considerations

### REST API Overhead

Each tool call makes an HTTP request to WordPress:

```
Tool call → REST API request (50-200ms) → PHP execution → Response
```

For multi-iteration ReAct flows, this adds 150-600ms overhead per iteration.

### Tool Count and Context Size

With 14 abilities, the tool list adds ~500 tokens to the system prompt. With 50+ abilities (post-hackathon), this could grow to ~2000 tokens.

**Solution:** Tool selection at scale (RLM approach) pre-filters tools before passing to the AI. See [Tool Selection at Scale](11-tool-selection-at-scale.md).

## Summary

Tools (abilities) are the executable functions that bridge AI understanding with WordPress operations. Each ability has a PHP backend (registered with WordPress Abilities API) and a JavaScript frontend (integrated with the chat system). The AI selects tools based on system prompts, keyword matching, and ReAct observations. Abilities have operational characteristics (readonly, destructive, idempotent) that control HTTP methods and confirmation requirements. Third-party plugins can register custom abilities, which the AI automatically discovers and uses.

**Next:** [Performance & Optimization](10-performance-optimization.md)
