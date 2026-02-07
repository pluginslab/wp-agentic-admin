# Workflows Guide

This guide explains how to create and register multi-step workflows in WP-Agentic-Admin.

## Overview

Workflows are sequences of abilities that execute together as a single operation. They enable "agentic" multi-step actions like "clean up the site" that chain together cache clearing, database optimization, and health checks.

Workflows use keyword-based routing and execute pre-defined sequences, making them fast and predictable compared to the ReAct loop.

### Architectural Philosophy

WP-Agentic-Admin uses a **hybrid approach** balancing deterministic execution with progressive LLM enhancement. Workflows can be:

- **Rigid** - Fixed sequences (e.g., security protocols, maintenance routines)
- **Semi-flexible** - Conditional branches based on context (e.g., performance optimization)
- **Flexible/Template** - LLM-composed from available steps (future enhancement)

The choice depends on safety requirements and task predictability. For detailed architectural decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).

> **Current Focus:** We focus on rigid and semi-flexible workflows optimized for local 1.5B-3B models. The system is designed to scale as capabilities mature.

## Quick Start

### Register a Workflow

```javascript
(function() {
    if (!wp?.agenticAdmin) return;

    wp.agenticAdmin.registerWorkflow('my-plugin/my-workflow', {
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
| `includeIf` | function\|object | `null` | Condition to decide if step should execute (see Semi-Flexible Workflows) |

## Examples

### Basic Workflow

```javascript
wp.agenticAdmin.registerWorkflow('my-plugin/cleanup', {
    label: 'Quick Cleanup',
    description: 'Clears cache and optimizes database.',
    keywords: ['cleanup', 'clean up', 'tidy up'],
    steps: [
        {
            abilityId: 'wp-agentic-admin/cache-flush',
            label: 'Clear caches',
        },
        {
            abilityId: 'wp-agentic-admin/db-optimize',
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
wp.agenticAdmin.registerWorkflow('my-plugin/analyze-and-fix', {
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
wp.agenticAdmin.registerWorkflow('my-plugin/full-check', {
    label: 'Full System Check',
    description: 'Runs all diagnostic checks.',
    keywords: ['full check', 'diagnose everything'],
    steps: [
        {
            abilityId: 'wp-agentic-admin/site-health',
            label: 'Check site health',
        },
        {
            abilityId: 'wp-agentic-admin/error-log-read',
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
wp.agenticAdmin.registerWorkflow('my-plugin/deploy', {
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
wp.agenticAdmin.registerWorkflow('my-plugin/migration', {
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
                await wp.agenticAdmin.executeAbility('my-plugin/restore-data', {
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

### `wp.agenticAdmin.registerWorkflow(id, config)`

Registers a workflow with the chat system.

```javascript
wp.agenticAdmin.registerWorkflow('namespace/workflow-id', {
    label: 'Workflow Name',
    description: 'What it does',
    keywords: ['trigger', 'words'],
    steps: [/* step definitions */],
    requiresConfirmation: true,
});
```

### `wp.agenticAdmin.unregisterWorkflow(id)`

Removes a registered workflow.

```javascript
wp.agenticAdmin.unregisterWorkflow('my-plugin/my-workflow');
```

### `wp.agenticAdmin.getWorkflow(id)`

Returns a workflow definition by ID.

```javascript
const workflow = wp.agenticAdmin.getWorkflow('my-plugin/my-workflow');
console.log(workflow.steps.length); // Number of steps
```

### `wp.agenticAdmin.getWorkflows()`

Returns all registered workflows.

```javascript
const allWorkflows = wp.agenticAdmin.getWorkflows();
allWorkflows.forEach(w => console.log(w.label));
```

### `wp.agenticAdmin.hasWorkflow(id)`

Checks if a workflow is registered.

```javascript
if (wp.agenticAdmin.hasWorkflow('my-plugin/my-workflow')) {
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

WP-Agentic-Admin includes these workflows out of the box:

| ID | Label | Steps |
|----|-------|-------|
| `wp-agentic-admin/site-cleanup` | Full Site Cleanup | Cache flush → DB optimize → Site health |
| `wp-agentic-admin/performance-check` | Quick Performance Check | Site health → Error log |
| `wp-agentic-admin/plugin-audit` | Plugin Audit | Plugin list → Site health |
| `wp-agentic-admin/database-maintenance` | Database Maintenance | DB optimize → Cache flush |

## Workflow Types: Rigid vs Flexible

Not all workflows should be implemented the same way. The structure depends on the nature of the task and safety requirements.

### Rigid Workflows (Current Implementation)

**When to use:** Security-critical operations, well-established procedures, dangerous operations

**Characteristics:**
- Fixed sequence of steps
- Execute the same way every time
- Predictable and auditable
- Safe for automated execution

**Examples:**
```javascript
// Scheduled maintenance - always same steps
{
    id: 'site-cleanup',
    steps: [
        { abilityId: 'cache-flush' },
        { abilityId: 'db-optimize' },
        { abilityId: 'site-health' }
    ]
}

// Database search-replace - must backup first (strict protocol)
{
    id: 'search-replace',
    steps: [
        { abilityId: 'backup-database', label: 'Backup database' },
        { abilityId: 'search-replace-db', label: 'Replace URLs' },
        { abilityId: 'verify-changes', label: 'Verify changes' },
        { abilityId: 'cache-flush', label: 'Clear cache' }
    ]
}
```

### Semi-Flexible Workflows

**When to use:** Diagnostic workflows where findings determine next steps

**Characteristics:**
- ✅ Conditional branches based on context
- ✅ Function-based or LLM-based decision making
- ✅ Still follows safe protocols
- ✅ More efficient (skips unnecessary steps)
- ✅ Context variables auto-extracted from previous results

**Implementation:** Use `includeIf` property on steps to conditionally execute them.

---

#### Option 1: Function-Based (Fast, Deterministic) ✅ **Recommended for 1.5B Models**

```javascript
wp.agenticAdmin.registerWorkflow('my-plugin/performance-optimization', {
    label: 'Performance Optimization',
    description: 'Optimizes site performance based on findings.',
    keywords: ['optimize', 'performance', 'speed up'],
    steps: [
        { 
            abilityId: 'wp-agentic-admin/site-health', 
            label: 'Check site health'
        },
        { 
            abilityId: 'wp-agentic-admin/db-optimize',
            label: 'Optimize database',
            includeIf: (previousResults, params) => {
                // Access previous step results
                const healthResult = previousResults[0];
                
                // Check if step succeeded
                if (!healthResult?.success || !healthResult.result) {
                    return false; // Skip if health check failed
                }
                
                // Extract data from result
                const dbSize = healthResult.result.database_size || 0;
                const lastOptimized = healthResult.result.last_optimized;
                
                // Logic: Execute if database is large OR hasn't been optimized in 30+ days
                if (dbSize > 500 * 1024 * 1024) return true; // 500MB+
                if (!lastOptimized) return true; // Never optimized
                
                const daysSinceOptimized = (Date.now() - new Date(lastOptimized)) / (1000 * 60 * 60 * 24);
                return daysSinceOptimized > 30;
            }
        },
        {
            abilityId: 'wp-agentic-admin/cache-flush',
            label: 'Clear caches'
        }
    ],
    requiresConfirmation: false,
});
```

**Benefits:**
- ✅ Instant execution (no LLM call)
- ✅ Deterministic, predictable logic
- ✅ Works perfectly with 1.5B models
- ✅ Easy to debug and test
- ✅ Type-safe (IDE autocomplete)

---

#### Option 2: LLM-Based (Flexible, Semantic) ⚠️ **Requires 3B+ Models**

```javascript
wp.agenticAdmin.registerWorkflow('my-plugin/performance-optimization', {
    label: 'Performance Optimization',
    description: 'Optimizes site performance based on findings.',
    keywords: ['optimize', 'performance', 'speed up'],
    steps: [
        { 
            abilityId: 'wp-agentic-admin/site-health', 
            label: 'Check site health'
        },
        { 
            abilityId: 'wp-agentic-admin/db-optimize',
            label: 'Optimize database',
            includeIf: {
                prompt: `Should we optimize the database?
                
                Context:
                - User said: "{userMessage}"
                - Database size: {dbSize}MB
                - Last optimized: {lastOptimized}
                - Plugin count: {pluginCount}
                
                Return JSON: { "execute": true/false, "reason": "brief explanation" }
                
                Execute if:
                - Database is larger than 500MB
                - Database hasn't been optimized in 30+ days
                - User mentioned "database" or "slow queries"
                
                Skip if:
                - Database was optimized recently (< 7 days ago)
                - This is a quick check only
                - User wants to skip optimization`
            }
        },
        {
            abilityId: 'wp-agentic-admin/cache-flush',
            label: 'Clear caches'
        }
    ],
    requiresConfirmation: false,
});
```

**Variable Interpolation:**

The system auto-extracts common variables from previous step results:

| Variable | Source | Example |
|----------|--------|---------|
| `{userMessage}` | Initial user query | "optimize my slow site" |
| `{dbSize}` | `result.database_size` | "750" (MB) |
| `{lastOptimized}` | `result.last_optimized` | "2024-12-01" |
| `{pluginCount}` | `result.plugins.length` | "23" |
| `{cacheSize}` | `result.cache_size` | "120" (MB) |
| `{errorCount}` | `result.error_count` | "5" |
| `{step0Result}` | Raw result from step 0 | Full object |
| `{step1Result}` | Raw result from step 1 | Full object |
| `{ability-name}` | Result by ability short ID | `{site-health}` |

**Benefits:**
- ✅ Semantic understanding (can interpret context)
- ✅ Flexible reasoning beyond simple rules
- ✅ Handles natural language user intent

**Drawbacks:**
- ⚠️ Requires 3B+ model for accuracy (1.5B makes errors)
- ⚠️ Slower (3-second LLM call per condition)
- ⚠️ Less predictable (LLM may surprise you)

---

#### includeIf Signature

**Function-based:**
```typescript
includeIf: (previousResults: StepResult[], params: object) => boolean
```

**LLM-based:**
```typescript
includeIf: {
    prompt: string // Template with {variable} placeholders
}
```

**StepResult Structure:**
```typescript
{
    abilityId: string,      // e.g., "wp-agentic-admin/site-health"
    label: string,          // e.g., "Check site health"
    stepIndex: number,      // Position in workflow (0-based)
    success: boolean,       // Did the step succeed?
    result: object,         // The actual data returned by the ability
    duration: number,       // Milliseconds
    skipped?: boolean       // True if this step was skipped by includeIf
}
```

---

#### Best Practices

**1. Use function-based for production reliability:**
```javascript
// ✅ Good: Fast, deterministic, works with 1.5B model
includeIf: (prev, params) => prev[0]?.result?.database_size > 500 * 1024 * 1024
```

**2. Check success before accessing result:**
```javascript
// ✅ Good: Defensive check
includeIf: (prev) => {
    const step = prev[0];
    if (!step?.success || !step.result) return false;
    return step.result.needsOptimization === true;
}
```

**3. Provide clear criteria in LLM prompts:**
```javascript
// ✅ Good: Explicit rules
prompt: `Execute if database > 500MB OR last optimized > 30 days ago.
Skip if optimized within 7 days.`

// ❌ Bad: Vague
prompt: `Should we optimize? Decide based on context.`
```

**4. Use fail-safe defaults:**
- If `includeIf` throws an error, the step **executes by default** (fail-safe)
- If LLM times out, the step **executes by default** (fail-safe)
- This prevents workflows from silently skipping critical steps

**5. Log decisions for debugging:**
```javascript
includeIf: (prev, params) => {
    const shouldExecute = prev[0]?.result?.database_size > 500 * 1024 * 1024;
    console.log('[Workflow] DB optimize decision:', shouldExecute);
    return shouldExecute;
}
```

---

#### Testing includeIf Logic

**Option A: Test via chat**
```
You: test performance optimization workflow
[Workflow runs, check console for includeIf decisions]
```

**Option B: Test in browser console**
```javascript
// Simulate previous results
const mockResults = [{
    abilityId: 'wp-agentic-admin/site-health',
    success: true,
    result: { database_size: 600 * 1024 * 1024, last_optimized: '2024-01-01' }
}];

// Test function
const includeIf = (prev) => prev[0]?.result?.database_size > 500 * 1024 * 1024;
console.log('Should execute?', includeIf(mockResults)); // true
```

**Option C: Check workflow execution logs**
```
[WorkflowOrchestrator] Evaluating includeIf condition for step 2
[WorkflowOrchestrator] Function-based includeIf result: true
[WorkflowOrchestrator] Step 2 will execute (includeIf returned true)
```

### Template Workflows (Advanced Future)

**When to use:** Open-ended requests, "something is broken" scenarios, advanced users

**Characteristics:**
- LLM selects steps from available abilities
- Adapts to user context and site state
- Requires preview/confirmation
- Most flexible, but less predictable

**Example structure:**
```javascript
{
    id: 'site-recovery',
    template: true,
    availableSteps: [
        { abilityId: 'error-log-read', priority: 'high', keywords: ['error'] },
        { abilityId: 'site-health', priority: 'high', keywords: ['check'] },
        { abilityId: 'plugin-deactivate-all', priority: 'medium', keywords: ['plugin'] },
        { abilityId: 'rewrite-flush', priority: 'low', keywords: ['404'] }
    ],
    selectionPrompt: `Select diagnostic steps based on: {userMessage}...`
}
```

> **Note:** Template workflows are a future enhancement planned after building out more abilities.

### Decision Guide

| Scenario | Workflow Type | Why |
|----------|---------------|-----|
| Scheduled maintenance | **Rigid** | Always same safe steps |
| Security audit | **Rigid** | Standardized checklist |
| Search & replace | **Rigid** | Must follow protocol (backup first) |
| Performance check | **Semi-flexible** | Depends on findings |
| "Site is broken" | **Flexible** | Could be any of 20 causes |

For more details on architectural decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).

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
console.log(wp.agenticAdmin.getWorkflows());
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
wp.agenticAdmin.registerAbility('my-plugin/step-one', { /* ... */ });
wp.agenticAdmin.registerAbility('my-plugin/step-two', { /* ... */ });

// 2. Then, register workflow that uses them
wp.agenticAdmin.registerWorkflow('my-plugin/my-workflow', {
    steps: [
        { abilityId: 'my-plugin/step-one', label: 'Step 1' },
        { abilityId: 'my-plugin/step-two', label: 'Step 2' },
    ],
});
```

See [Third-Party Integration](./THIRD-PARTY-INTEGRATION.md) for details on creating abilities.

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
    //     abilityId: 'wp-agentic-admin/plugin-list',
    //     label: 'List all installed plugins',
    //     stepIndex: 0,
    //     success: true,
    //     result: { plugins: [...], total: 5, active: 3 },  // <-- The actual data!
    //     duration: 234
    //   },
    //   {
    //     abilityId: 'wp-agentic-admin/site-health',
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
    const pluginResult = results.find(r => r.abilityId === 'wp-agentic-admin/plugin-list');
    const healthResult = results.find(r => r.abilityId === 'wp-agentic-admin/site-health');
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
wp.agenticAdmin.registerWorkflow('my-plugin/plugin-audit', {
    label: 'Plugin Audit',
    description: 'Lists all plugins and checks for issues.',
    keywords: ['plugin audit', 'audit plugins', 'check plugins'],
    steps: [
        { abilityId: 'wp-agentic-admin/plugin-list', label: 'List plugins' },
        { abilityId: 'wp-agentic-admin/site-health', label: 'Check health' },
    ],
    requiresConfirmation: false,
    
    summarize: (results) => {
        const pluginResult = results.find(r => r.abilityId === 'wp-agentic-admin/plugin-list');
        const healthResult = results.find(r => r.abilityId === 'wp-agentic-admin/site-health');
        
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
