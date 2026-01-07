# Workflows Guide

This guide explains how to create and register multi-step workflows in WP-Neural-Admin.

## Overview

Workflows are sequences of abilities that execute together as a single operation. They enable "agentic" multi-step actions like "clean up the site" that chain together cache clearing, database optimization, and health checks.

**New in v1.1.0**: Workflows use intent-based routing rather than LLM tool-calling, making them compatible with small browser-based models.

## Quick Start

### Register a Workflow

```javascript
(function() {
    if (!wp?.neuralAdmin) return;
    
    wp.neuralAdmin.registerWorkflow('my-plugin/my-workflow', {
        label: 'My Multi-Step Workflow',
        description: 'Does multiple things in sequence.',
        keywords: ['do everything', 'full process', 'run all'],
        steps: [
            {
                abilityId: 'my-plugin/step-one',
                label: 'First step',
            },
            {
                abilityId: 'my-plugin/step-two',
                label: 'Second step',
            },
        ],
        requiresConfirmation: true,
    });
})();
```

## Workflow Definition

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Human-readable name for the workflow |
| `description` | string | What this workflow does |
| `steps` | array | Ordered array of step definitions |

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `keywords` | string[] | `[]` | Trigger words that activate this workflow |
| `requiresConfirmation` | boolean | `true` | Show confirmation dialog before execution |
| `confirmationMessage` | string | Auto-generated | Custom confirmation message |
| `summarize` | function | Auto-generated | Custom function to generate final summary |

## Step Definition

Each step in the `steps` array requires:

| Property | Type | Description |
|----------|------|-------------|
| `abilityId` | string | The ability to execute (must be registered) |
| `label` | string | Human-readable label shown in progress UI |

### Optional Step Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `mapParams` | function | `null` | Transform previous results into this step's params |
| `rollback` | function | `null` | Undo function if a later step fails |
| `requiresConfirmation` | boolean | `false` | Confirm this specific step |
| `optional` | boolean | `false` | Continue workflow if this step fails |

## Examples

### Basic Workflow

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/cleanup', {
    label: 'Quick Cleanup',
    description: 'Clears cache and optimizes database.',
    keywords: ['cleanup', 'clean up', 'tidy up'],
    steps: [
        {
            abilityId: 'wp-neural-admin/cache-flush',
            label: 'Clear caches',
        },
        {
            abilityId: 'wp-neural-admin/db-optimize',
            label: 'Optimize database',
        },
    ],
    requiresConfirmation: true,
    confirmationMessage: 'This will clear caches and optimize the database. Continue?',
});
```

### Workflow with Data Passing

Use `mapParams` to pass data from one step to the next:

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/analyze-and-fix', {
    label: 'Analyze and Fix',
    description: 'Analyzes issues then fixes them.',
    keywords: ['analyze and fix', 'find and fix'],
    steps: [
        {
            abilityId: 'my-plugin/analyze',
            label: 'Analyze issues',
        },
        {
            abilityId: 'my-plugin/fix-issues',
            label: 'Fix detected issues',
            mapParams: (previousResults) => {
                // Previous results is an array of all completed step results
                const analyzeResult = previousResults[0];
                return {
                    issues: analyzeResult.result.issues,
                };
            },
        },
    ],
});
```

### Workflow with Optional Steps

Mark steps as optional to continue even if they fail:

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/full-check', {
    label: 'Full System Check',
    description: 'Runs all diagnostic checks.',
    keywords: ['full check', 'diagnose everything'],
    steps: [
        {
            abilityId: 'wp-neural-admin/site-health',
            label: 'Check site health',
        },
        {
            abilityId: 'wp-neural-admin/error-log-read',
            label: 'Review error logs',
            optional: true, // Continue if error log unavailable
        },
        {
            abilityId: 'my-plugin/custom-check',
            label: 'Run custom diagnostics',
            optional: true,
        },
    ],
    requiresConfirmation: false, // Read-only operations
});
```

### Workflow with Custom Summary

Provide a `summarize` function to generate a meaningful final message:

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/deploy', {
    label: 'Deploy Changes',
    description: 'Deploys changes to production.',
    keywords: ['deploy', 'push changes', 'go live'],
    steps: [
        {
            abilityId: 'my-plugin/backup',
            label: 'Create backup',
        },
        {
            abilityId: 'my-plugin/deploy',
            label: 'Deploy changes',
        },
        {
            abilityId: 'my-plugin/verify',
            label: 'Verify deployment',
        },
    ],
    requiresConfirmation: true,
    summarize: (results) => {
        const allSucceeded = results.every(r => r.success);
        const backupResult = results.find(r => r.abilityId === 'my-plugin/backup');
        
        if (allSucceeded) {
            return `Deployment successful! Backup created at ${backupResult.result.path}`;
        }
        
        const failed = results.filter(r => !r.success);
        return `Deployment failed at: ${failed.map(r => r.label).join(', ')}`;
    },
});
```

### Workflow with Rollback

Add rollback functions to undo completed steps if later steps fail:

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/migration', {
    label: 'Data Migration',
    description: 'Migrates data with automatic rollback on failure.',
    keywords: ['migrate', 'migration', 'transfer data'],
    steps: [
        {
            abilityId: 'my-plugin/backup-data',
            label: 'Backup existing data',
        },
        {
            abilityId: 'my-plugin/transform-data',
            label: 'Transform data format',
            rollback: async (stepResult, allResults) => {
                // Called if a later step fails
                console.log('Rolling back transformation...');
                await wp.neuralAdmin.executeAbility('my-plugin/restore-data', {
                    backupId: allResults[0].result.backupId,
                });
            },
        },
        {
            abilityId: 'my-plugin/import-data',
            label: 'Import transformed data',
        },
    ],
    requiresConfirmation: true,
});
```

## API Reference

### `wp.neuralAdmin.registerWorkflow(id, config)`

Registers a workflow with the chat system.

```javascript
wp.neuralAdmin.registerWorkflow('namespace/workflow-id', {
    label: 'Workflow Name',
    description: 'What it does',
    keywords: ['trigger', 'words'],
    steps: [/* step definitions */],
    requiresConfirmation: true,
});
```

### `wp.neuralAdmin.unregisterWorkflow(id)`

Removes a registered workflow.

```javascript
wp.neuralAdmin.unregisterWorkflow('my-plugin/my-workflow');
```

### `wp.neuralAdmin.getWorkflow(id)`

Returns a workflow definition by ID.

```javascript
const workflow = wp.neuralAdmin.getWorkflow('my-plugin/my-workflow');
console.log(workflow.steps.length); // Number of steps
```

### `wp.neuralAdmin.getWorkflows()`

Returns all registered workflows.

```javascript
const allWorkflows = wp.neuralAdmin.getWorkflows();
allWorkflows.forEach(w => console.log(w.label));
```

### `wp.neuralAdmin.hasWorkflow(id)`

Checks if a workflow is registered.

```javascript
if (wp.neuralAdmin.hasWorkflow('my-plugin/my-workflow')) {
    // Workflow exists
}
```

## How Workflow Execution Works

When a user triggers a workflow (via keywords or explicit selection):

```
User message → Keyword detection → Match workflow
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Show confirmation │
                              │ (if required)     │
                              └──────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Execute Step 1   │
                              └──────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Execute Step 2   │◄── mapParams(previousResults)
                              └──────────────────┘
                                        │
                                        ▼
                                      ...
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Execute Step N   │
                              └──────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Generate summary │◄── summarize(allResults)
                              └──────────────────┘
```

### On Failure

If a step fails and is not marked as `optional`:

1. Execution stops immediately
2. Rollback functions are called in reverse order (N-1 → 1)
3. Error message is shown to user

## Built-in Workflows

WP-Neural-Admin includes these workflows out of the box:

| ID | Label | Steps |
|----|-------|-------|
| `wp-neural-admin/site-cleanup` | Full Site Cleanup | Cache flush → DB optimize → Site health |
| `wp-neural-admin/performance-check` | Quick Performance Check | Site health → Error log |
| `wp-neural-admin/plugin-audit` | Plugin Audit | Plugin list → Site health |
| `wp-neural-admin/database-maintenance` | Database Maintenance | DB optimize → Cache flush |

## Best Practices

### 1. Use Descriptive Keywords

Include multiple variations of how users might phrase their request:

```javascript
keywords: [
    'full cleanup',        // Direct match
    'clean up site',       // Natural phrasing
    'maintenance',         // Related concept
    'optimize everything', // Alternative action
],
```

### 2. Read-Only Workflows Don't Need Confirmation

Set `requiresConfirmation: false` for workflows that only read data:

```javascript
{
    steps: [
        { abilityId: 'my-plugin/read-status', label: 'Check status' },
        { abilityId: 'my-plugin/read-logs', label: 'Read logs' },
    ],
    requiresConfirmation: false, // Safe - no modifications
}
```

### 3. Make Critical Steps Non-Optional

Only mark truly optional steps as `optional: true`. Critical steps should fail the workflow:

```javascript
{
    abilityId: 'my-plugin/backup',
    label: 'Create backup',
    optional: false, // MUST succeed before proceeding
},
```

### 4. Write Data-Driven Summaries

The `summarize` function is **critical** for workflow UX. Unlike single abilities (where the LLM generates responses), workflow summaries use your `summarize` function directly as the final output shown to users.

**Why this matters:** Without a good summarize function, users see generic messages like "Completed 2 steps" instead of useful information like "Found 5 plugins (3 active, 2 inactive)".

```javascript
summarize: (results) => {
    // Access specific step results by abilityId
    const backupResult = results.find(r => r.abilityId === 'my-plugin/backup');
    
    // Build contextual summary with actual data
    if (backupResult?.success) {
        return `Completed with backup at: ${backupResult.result.path}`;
    }
    return 'Completed (no backup created).';
},
```

See the dedicated **Summarize Function Deep Dive** section below for detailed guidance.

### 5. Namespace Your Workflow IDs

Use the `namespace/workflow-name` format to avoid conflicts:

```javascript
// Good
'my-plugin/site-cleanup'
'acme-seo/full-audit'

// Bad
'cleanup'
'site-cleanup'
```

## Debugging

### Check Registered Workflows

```javascript
// In browser console
console.log(wp.neuralAdmin.getWorkflows());
```

### Test Workflow Detection

The chat system logs workflow detection. Check the console for:

```
[WorkflowRegistry] Detected workflow: my-plugin/cleanup (score: 12)
```

### Common Issues

1. **Workflow not triggering** - Check keywords match user input (case-insensitive)
2. **Ability not found** - Ensure all `abilityId` values are registered before the workflow
3. **mapParams not working** - Remember it receives an array of all previous results

## Integration with Abilities

Workflows chain together existing abilities. Make sure your abilities are registered before your workflows:

```javascript
// 1. First, register abilities
wp.neuralAdmin.registerAbility('my-plugin/step-one', { /* ... */ });
wp.neuralAdmin.registerAbility('my-plugin/step-two', { /* ... */ });

// 2. Then, register workflow that uses them
wp.neuralAdmin.registerWorkflow('my-plugin/my-workflow', {
    steps: [
        { abilityId: 'my-plugin/step-one', label: 'Step 1' },
        { abilityId: 'my-plugin/step-two', label: 'Step 2' },
    ],
});
```

See [Third-Party Integration](./third-party-integration.md) for details on creating abilities.

## Summarize Function Deep Dive

The `summarize` function is one of the most important parts of a workflow. It transforms raw ability results into human-readable output.

### Why Summarize Functions Matter

Unlike single abilities where the LLM generates contextual responses, **workflow summaries bypass the LLM entirely**. Your `summarize` function output is shown directly to users. A poor summarize function leads to useless output:

```
❌ Bad: "The workflow completed successfully with the following results:
         1. Listed All Installed Plugins: Success
         2. Checked for Plugin-Related Issues: Success"

✅ Good: "Plugin audit complete.

         **Plugins Overview:**
         - Total: 5 plugins
         - Active: 3
         - Inactive: 2 ⚠️

         **Active Plugins:**
         - Akismet Anti-spam (v5.3)
         - WooCommerce (v8.5.1)
         - Yoast SEO (v22.0)

         **Inactive Plugins** (consider removing):
         - Hello Dolly (v1.7.2)
         - Classic Editor (v1.6.3)"
```

### Understanding the Results Array

The `summarize` function receives an array of `StepResult` objects:

```javascript
summarize: (results) => {
    // results is an array like:
    // [
    //   {
    //     abilityId: 'wp-neural-admin/plugin-list',
    //     label: 'List all installed plugins',
    //     stepIndex: 0,
    //     success: true,
    //     result: { plugins: [...], total: 5, active: 3 },  // <-- The actual data!
    //     duration: 234
    //   },
    //   {
    //     abilityId: 'wp-neural-admin/site-health',
    //     label: 'Check site health',
    //     stepIndex: 1,
    //     success: true,
    //     result: { wordpress_version: '6.9', php_version: '8.2', ... },
    //     duration: 156
    //   }
    // ]
}
```

**Key insight:** The actual data is in `stepResult.result` - this contains whatever the PHP ability returned.

### Step-by-Step: Writing a Good Summarize Function

#### 1. Find the results you need

```javascript
summarize: (results) => {
    // Find specific step results by abilityId
    const pluginResult = results.find(r => r.abilityId === 'wp-neural-admin/plugin-list');
    const healthResult = results.find(r => r.abilityId === 'wp-neural-admin/site-health');
```

#### 2. Check success before accessing data

```javascript
    // Always check success - failed steps may have error objects instead of data
    if (!pluginResult?.success || !pluginResult.result) {
        return 'Plugin audit failed - could not retrieve plugin list.';
    }
```

#### 3. Extract the actual data

```javascript
    // Destructure the data you need from the result
    const { plugins = [], total = 0, active = 0 } = pluginResult.result;
    const inactive = total - active;
```

#### 4. Build a formatted summary with markdown

```javascript
    let summary = 'Plugin audit complete.\n\n';
    
    summary += `**Plugins Overview:**\n`;
    summary += `- Total: ${total} plugins\n`;
    summary += `- Active: ${active}\n`;
    summary += `- Inactive: ${inactive}${inactive > 0 ? ' ⚠️' : ''}\n\n`;
```

#### 5. Include relevant details from the data

```javascript
    // Show actual plugin names, not just counts
    if (plugins.length > 0) {
        const activePlugins = plugins.filter(p => p.active);
        const inactivePlugins = plugins.filter(p => !p.active);
        
        if (activePlugins.length > 0) {
            summary += `**Active Plugins:**\n`;
            activePlugins.forEach(p => {
                summary += `- ${p.name} (v${p.version})\n`;
            });
            summary += '\n';
        }
        
        if (inactivePlugins.length > 0) {
            summary += `**Inactive Plugins** (consider removing):\n`;
            inactivePlugins.forEach(p => {
                summary += `- ${p.name} (v${p.version})\n`;
            });
        }
    }
    
    return summary;
}
```

### Complete Example: Plugin Audit

Here's a full, production-quality summarize function:

```javascript
wp.neuralAdmin.registerWorkflow('my-plugin/plugin-audit', {
    label: 'Plugin Audit',
    description: 'Lists all plugins and checks for issues.',
    keywords: ['plugin audit', 'audit plugins', 'check plugins'],
    steps: [
        { abilityId: 'wp-neural-admin/plugin-list', label: 'List plugins' },
        { abilityId: 'wp-neural-admin/site-health', label: 'Check health' },
    ],
    requiresConfirmation: false,
    
    summarize: (results) => {
        const pluginResult = results.find(r => r.abilityId === 'wp-neural-admin/plugin-list');
        const healthResult = results.find(r => r.abilityId === 'wp-neural-admin/site-health');
        
        let summary = 'Plugin audit complete.\n\n';
        
        // Plugin data
        if (pluginResult?.success && pluginResult.result) {
            const { plugins = [], total = 0, active = 0 } = pluginResult.result;
            const inactive = total - active;
            
            summary += `**Plugins Overview:**\n`;
            summary += `- Total: ${total} plugins\n`;
            summary += `- Active: ${active}\n`;
            summary += `- Inactive: ${inactive}${inactive > 0 ? ' ⚠️' : ''}\n\n`;
            
            if (plugins.length > 0) {
                const activePlugins = plugins.filter(p => p.active);
                const inactivePlugins = plugins.filter(p => !p.active);
                
                if (activePlugins.length > 0) {
                    summary += `**Active Plugins:**\n`;
                    activePlugins.forEach(p => {
                        summary += `- ${p.name} (v${p.version})\n`;
                    });
                    summary += '\n';
                }
                
                if (inactivePlugins.length > 0) {
                    summary += `**Inactive Plugins** (consider removing):\n`;
                    inactivePlugins.forEach(p => {
                        summary += `- ${p.name} (v${p.version})\n`;
                    });
                    summary += '\n';
                }
            }
        } else {
            summary += `**Plugins:** Could not retrieve list\n\n`;
        }
        
        // Health data
        if (healthResult?.success && healthResult.result) {
            const h = healthResult.result;
            summary += `**Environment:** WordPress ${h.wordpress_version || '?'}, `;
            summary += `PHP ${h.php_version || '?'}, `;
            summary += `Theme: ${h.active_theme?.name || 'unknown'}`;
        }
        
        return summary;
    },
});
```

### Formatting Tips

Use markdown for better readability:

| Format | Syntax | Use For |
|--------|--------|---------|
| Bold | `**text**` | Section headers, key values |
| Line break | `\n` | Separating lines |
| Paragraph | `\n\n` | Separating sections |
| List item | `- item` | Lists of items |
| Warning | `⚠️` | Issues that need attention |
| Success | `✓` | Completed items |
| Failure | `✗` | Failed items |

### Common Patterns

#### Show counts with context
```javascript
summary += `- Active: ${active}\n`;
summary += `- Inactive: ${inactive}${inactive > 0 ? ' ⚠️' : ''}\n`;
```

#### Limit long lists
```javascript
const displayItems = items.slice(0, 5);
displayItems.forEach(item => {
    summary += `- ${item.name}\n`;
});
if (items.length > 5) {
    summary += `- ...and ${items.length - 5} more\n`;
}
```

#### Handle missing data gracefully
```javascript
summary += `WordPress ${h.wordpress_version || 'unknown'}`;
```

#### Show success/failure indicators
```javascript
if (cacheResult?.success) {
    summary += `✓ **Cache:** Flushed successfully\n`;
} else {
    summary += `✗ **Cache:** Failed to flush\n`;
}
```

### Testing Your Summarize Function

1. **Log the raw results** to see what data you have:
   ```javascript
   summarize: (results) => {
       console.log('Workflow results:', JSON.stringify(results, null, 2));
       // ... rest of function
   }
   ```

2. **Test with edge cases:**
   - What if a step fails?
   - What if the result is empty (e.g., no plugins)?
   - What if optional fields are missing?

3. **Check the output formatting** - markdown should render correctly in the chat UI
