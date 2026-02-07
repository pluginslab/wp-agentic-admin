# WP-Agentic-Admin

**The Local-First AI Site Reliability Engineer for WordPress**

A privacy-first AI assistant that runs entirely in your browser, helping you diagnose and fix WordPress issues through natural language commands.

## What is WP-Agentic-Admin?

WP-Agentic-Admin transforms your WordPress admin panel into an intelligent command center. Instead of navigating through multiple screens to diagnose issues, you simply describe your problem in plain English:

> "My site is throwing 500 errors"

The AI assistant will:
1. Read your error logs
2. Identify the problematic plugin or theme
3. Propose a fix
4. Execute it with your approval

All of this happens **locally in your browser** - no data is sent to external servers, no API costs, complete privacy.

## Key Features

- **100% Local AI**: Uses WebLLM to run a Small Language Model (Qwen2.5-1.5B to 3B) directly in your browser via WebGPU
- **Privacy-First**: No admin data ever leaves your device - GDPR compliant by design
- **Zero Server Costs**: No GPU infrastructure needed - computation happens on the client
- **Persistent AI**: Model stays loaded across page navigations using Service Worker technology
- **WordPress Abilities API**: Natively integrates with WordPress's official Abilities API
- **Extensible**: Third-party plugins can register custom abilities
- **Natural Language Interface**: Describe problems in plain English, get intelligent solutions
- **ReAct Loop**: LLM decides which tools to use based on observations, adapting in real-time

## Architecture

WP-Agentic-Admin uses a **ReAct (Reasoning + Acting) pattern** where the AI decides tool selection one action at a time:

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                   Your Browser                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Local AI (WebLLM)                         │  │
│  │      Qwen2.5 (1.5B-3B) via WebGPU/WASM                │  │
│  │                                                         │  │
│  │  ReAct Loop: LLM decides tools based on observations  │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                   Tool Calls                                 │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           WordPress Abilities API                      │  │
│  │    Standardized capability discovery & execution       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                    REST API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 WordPress Server                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Registered SRE Abilities                    │  │
│  │  - Error log reading    - Plugin management            │  │
│  │  - Cache management     - Site health diagnostics      │  │
│  │  - Database optimization                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### How the ReAct Loop Works

```
User: "My site is slow"
  ↓
AI: "I should check site health first"
  ↓
Tool: site-health → Returns database is 2.5GB
  ↓
AI: "Database is large, I should optimize it"
  ↓
Tool: db-optimize → Optimizes 15 tables
  ↓
AI: "Your database was causing slowness. I optimized it and saved 125MB."
```

The AI decides **one action at a time**, observing results and adapting its strategy.

### Workflow Detection

For complex multi-step operations, pre-defined workflows can be triggered via keywords:

- "full site cleanup" → Executes: cache-flush → db-optimize → site-health
- "check site performance" → Executes: site-health → error-log-read

Otherwise, the ReAct loop handles everything dynamically.

## Requirements

- WordPress 6.9+ (includes the Abilities API)
- PHP 8.2+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+)

## Installation

1. Download and install WP-Agentic-Admin
2. Navigate to "Agentic Admin" in your WordPress admin menu
3. Wait for the AI model to download (one-time, ~1.6GB for Qwen2.5-1.5B)
4. Start chatting!

## Persistent AI Mode

WP-Agentic-Admin uses **Service Worker technology** to keep the AI model loaded in memory, even when navigating between WordPress admin pages. This provides several benefits:

### Benefits

- **Instant Access**: Once loaded, the model is immediately available - no waiting
- **Faster Navigation**: Switch between admin pages without reloading the model
- **Multi-Tab Support**: Multiple browser tabs share the same model instance
- **Better Performance**: Reduced memory usage compared to loading separate instances

### How It Works

When you first load Agentic Admin in Chrome or Edge:
1. The model downloads to browser cache (~1.6GB, one-time)
2. A Service Worker registers and loads the model into GPU memory
3. The model stays loaded as long as you have a Agentic Admin tab open
4. Navigate away and back - the model is still there!

### Browser Compatibility

| Browser | Service Worker Mode | Fallback Mode |
|---------|---------------------|---------------|
| Chrome 113+ | ✅ Fully Supported | ✅ Available |
| Edge 113+ | ✅ Fully Supported | ✅ Available |
| Safari | ❌ Not Supported* | ✅ Auto-fallback |
| Firefox 120+ | ⚠️ Experimental | ✅ Available |

*Safari's Service Workers cannot access WebGPU. The plugin automatically falls back to page mode, where the model loads in the page context.

### UI Indicator

When Service Worker mode is active, you'll see a **"Persistent"** badge in the model status area, indicating that your model will survive page navigations.

## Available Abilities

**Current Status:** 12 abilities, 4 workflows

| Ability | Description | Type |
|---------|-------------|------|
| `cache-flush` | Flush WordPress object cache | Write |
| `db-optimize` | Optimize database tables | Write |
| `transient-flush` | Clear expired transients | Write |
| `revision-cleanup` | Remove old post revisions | Write (destructive) |
| `rewrite-flush` | Flush WordPress rewrite rules | Write |
| `rewrite-list` | List all registered rewrite rules | Read-only |
| `site-health` | Get comprehensive site health information | Read-only |
| `error-log-read` | Read recent entries from debug.log | Read-only |
| `cron-list` | List scheduled WordPress cron events | Read-only |
| `plugin-list` | List all installed plugins with status | Read-only |
| `plugin-activate` | Activate a specific plugin | Write |
| `plugin-deactivate` | Deactivate a specific plugin | Write (destructive) |

### Workflows

| Workflow | Steps | Purpose |
|----------|-------|---------|
| `site-cleanup` | Cache flush → DB optimize → Site health | Full maintenance routine |
| `performance-check` | Site health → Error log | Quick diagnostic |
| `plugin-audit` | Plugin list → Site health | Review installed plugins |
| `database-maintenance` | DB optimize → Cache flush | Database optimization |

## Example Conversations

**Diagnosing Errors:**
```
You: My site is showing a white screen
AI: I'll check your error logs for recent issues.
    [Executing: error-log-read]

    I found the problem. There's a fatal error in the "broken-plugin" plugin:
    "Fatal error: Call to undefined function xyz() in /plugins/broken-plugin/main.php"

    Would you like me to deactivate this plugin?
```

**Performance Issues:**
```
You: The site feels slow lately
AI: Let me check a few things.
    [Executing: site-health]
    [Executing: db-optimize]

    I found some issues:
    - Your database has 15 tables that need optimization (now fixed)
    - Object cache is not configured
    - You have 3 inactive plugins that could be removed
```

**Adaptive Tool Chains:**
```
You: something is broken
AI: [Executing: site-health]
    [Executing: error-log-read]

    I found several PHP errors in your error log related to the "broken-plugin" plugin.
    The most recent error is: "Fatal error: Call to undefined function..."

    Would you like me to deactivate this plugin?
```

## Documentation

### Core Documentation

| Document | Description |
|----------|-------------|
| [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | Design principles and ReAct loop architecture |
| [**IDEAS.md**](IDEAS.md) | Feature ideas and future possibilities |
| [Abilities Guide](docs/ABILITIES-GUIDE.md) | How to create new abilities |
| [Workflows Guide](docs/WORKFLOWS-GUIDE.md) | How to create multi-step workflows |
| [Third-Party Integration](docs/THIRD-PARTY-INTEGRATION.md) | Extending with custom plugins |

### Key Concepts

**Abilities** - Atomic operations (list plugins, flush cache, etc.)
**Workflows** - Pre-defined multi-step sequences triggered by keywords
**ReAct Loop** - AI-driven tool selection based on observations and reasoning

## Project Structure

```
wp-agentic-admin/
├── wp-agentic-admin.php              # Main plugin file
├── includes/
│   ├── functions-abilities.php      # Public API: register_agentic_ability()
│   ├── class-abilities.php          # Ability registration orchestrator
│   ├── class-admin-page.php         # Admin page & assets
│   └── abilities/                   # Individual PHP ability files
├── src/extensions/
│   ├── App.jsx                      # Main React app
│   ├── abilities/                   # Individual JS ability files
│   ├── components/                  # React UI components
│   ├── services/                    # Core services (ReAct agent, orchestrator, etc.)
│   └── __tests__/                   # Automated tests
├── build-extensions/                # Compiled assets
└── docs/                            # Documentation
```

## Development

### Building

```bash
cd wp-agentic-admin
npm install
npm run build
```

### Testing

```bash
npm test                    # Run all tests
npm test -- react-agent     # Run specific test file
npm run test:watch          # Watch mode
```

### Technology Stack

**Client-Side:**
- Runtime: WebAssembly & WebGPU
- AI: WebLLM with Qwen2.5 (1.5B-3B models)
- UI: React
- Chat: ReAct loop with adaptive tool selection
- Persistence: Service Worker mode keeps model loaded across navigation

**Server-Side:**
- Plugin: PHP 8.2+
- Protocol: WordPress Abilities API

## Privacy & Security

- **No External API Calls**: The AI model runs entirely in your browser
- **No Data Collection**: Your site data never leaves your device
- **Permission-Based**: All abilities respect WordPress capabilities
- **Confirmation Required**: Destructive actions require explicit approval

## Contributing

Contributions are welcome! Here's how to get started:

### Priority Areas

1. **Implement new abilities** - Expand SRE capabilities
2. **Create workflows** - Build multi-step workflows for common admin tasks
3. **Documentation** - Add examples, use cases, and guides
4. **Testing** - Help test with real WordPress sites and hosting environments

### Understanding the Architecture

Before contributing, please review:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Understand the ReAct loop design
- [Abilities Guide](docs/ABILITIES-GUIDE.md) - Learn how to implement abilities
- [Workflows Guide](docs/WORKFLOWS-GUIDE.md) - Learn how to create workflows

### Guidelines

- Each ability should do **one thing** (WordPress Abilities API principle)
- Workflows should be as **rigid as safety requires**
- Always **preview before execution** for user trust
- Target **1.5B-3B local models** (Qwen, Phi-3, Gemma, Llama 3.2)
- Use **shared helpers** to avoid code duplication across related abilities

Submit PRs with:
- PHP + JavaScript implementation
- Documentation
- Examples of natural language queries that trigger it
- Tests (when applicable)

## License

GPL-2.0-or-later

## Credits

- WordPress AI Team for the [Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm) for browser-based LLM inference
- Created for CloudFest Hackathon 2026
