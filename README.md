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

All of this happens **locally in your browser** - no data is sent to third-party AI services, no API costs, complete privacy.

## Key Features

- **100% Local AI**: Uses WebLLM to run a 7B language model (Qwen2.5-7B, Hermes-2-Pro-7B, or Llama-3.1-8B) directly in your browser via WebGPU
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
│  │    Qwen2.5-7B / Hermes-2-Pro-7B / Llama-3.1-8B         │  │
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
│  │            Registered SRE Abilities (14 total)          │  │
│  │  - Error log reading    - Plugin management            │  │
│  │  - Cache management     - Site health diagnostics      │  │
│  │  - Database optimization - Cron/rewrite/transient mgmt │  │
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

- "full cleanup" / "site cleanup" / "maintenance" → cache-flush → db-optimize (conditional) → site-health
- "performance check" / "health check" / "check site" → site-health → error-log-read (conditional)
- "audit plugins" / "check my plugins" → plugin-list → site-health
- "database maintenance" / "optimize database" → db-optimize → cache-flush

Otherwise, the ReAct loop handles everything dynamically.

## Requirements

- WordPress 6.9+ (includes the Abilities API)
- PHP 8.2+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+)
- Pretty permalinks enabled (required for REST API)

## Installation

1. Download and install WP-Agentic-Admin
2. Navigate to "Agentic Admin" in your WordPress admin menu
3. Wait for the AI model to download (one-time, ~4.5GB for Qwen2.5-7B)
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
1. The model downloads to browser cache (~4.5GB, one-time)
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

**Current Status:** 14 abilities, 4 workflows

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
| `core/get-site-info` | Get WordPress site name, URL, version, and language | Read-only |
| `core/get-environment-info` | Get PHP version, database server, environment type | Read-only |

### Workflows

| Workflow | Steps | Purpose |
|----------|-------|---------|
| `site-cleanup` | Cache flush → DB optimize (conditional) → Site health | Full maintenance routine |
| `performance-check` | Site health → Error log (conditional) | Quick diagnostic |
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
| [Testing Guide](tests/TESTING.md) | Unit tests and E2E browser test suite |

### Key Concepts

**Abilities** - Atomic operations (list plugins, flush cache, etc.)
**Workflows** - Pre-defined multi-step sequences triggered by keywords
**ReAct Loop** - AI-driven tool selection based on observations and reasoning

## Project Structure

```
wp-agentic-admin/
├── wp-agentic-admin.php              # Main plugin file
├── uninstall.php                     # Clean uninstall (multisite-aware)
├── includes/
│   ├── functions-abilities.php      # Public API: register_agentic_ability()
│   ├── class-abilities.php          # Ability registration orchestrator
│   ├── class-admin-page.php         # Admin page & assets
│   ├── class-settings.php           # Plugin settings (model selection, etc.)
│   ├── class-utils.php              # Utility helpers (cache invalidation, etc.)
│   └── abilities/                   # Individual PHP ability files
│       └── shared/                  # Shared helpers (plugin-helpers.php)
├── src/extensions/
│   ├── App.jsx                      # Main React app (Chat + Abilities tabs)
│   ├── sw.js                        # Service Worker for model persistence
│   ├── index.js                     # Entry point
│   ├── abilities/                   # Individual JS ability files
│   ├── workflows/                   # Workflow definitions (site-cleanup, etc.)
│   ├── components/                  # React UI components
│   ├── services/                    # Core services (ReAct agent, orchestrator, etc.)
│   │   └── __tests__/              # Automated tests
│   └── utils/                       # Logging utilities
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
npm test                    # Run unit tests (43 tests)
npm test -- react-agent     # Run specific test file
npm run test:watch          # Watch mode
```

The project also includes an E2E browser test suite that validates the full pipeline (user message → LLM reasoning → tool selection → tool execution → response) using Chrome DevTools MCP. See [tests/TESTING.md](tests/TESTING.md) for details.

### Technology Stack

**Client-Side:**
- Runtime: WebAssembly & WebGPU
- AI: WebLLM with Qwen2.5-7B (default), Hermes-2-Pro-7B, Llama-3.1-8B
- UI: React
- Chat: ReAct loop with adaptive tool selection
- Persistence: Service Worker mode keeps model loaded across navigation

**Server-Side:**
- Plugin: PHP 8.2+
- Protocol: WordPress Abilities API

## Privacy & Security

- **No Third-Party AI Services**: The AI model runs entirely in your browser - no data is sent to external AI providers
- **No Data Collection**: Your site data stays between your browser and your WordPress server
- **Permission-Based**: All abilities respect WordPress capabilities
- **Confirmation Required**: Destructive actions require explicit approval

## Project Vision

WP Agentic Admin aims to make WordPress site management accessible through natural language while maintaining privacy and security. We're building:

1. **Privacy-First AI** - No external APIs, no data collection, fully local execution
2. **Extensible Architecture** - Third-party plugins can add custom abilities via the WordPress Abilities API
3. **Smart Reasoning** - ReAct loop to bridge natural language with technical operations
4. **Community-Driven** - Open development with transparent roadmap and contributor recognition

See [IDEAS.md](IDEAS.md) for our feature roadmap and future plans.

## Community & Support

- **GitHub Discussions**: Ask questions, share ideas, and connect with other users
- **WordPress Slack**: Join the `#agentic-admin` channel for real-time discussion
- **Issue Tracker**: Report bugs or request features on [GitHub Issues](https://github.com/pluginslab/wordpress-agentic-admin/issues)

## Contributing

We welcome contributions from developers, designers, testers, and documentation writers! Here's how to get involved:

### Ways to Contribute

1. 🔧 **Code**: Implement new abilities, improve the ReAct agent, or fix bugs
2. 📝 **Documentation**: Write guides, tutorials, or improve existing docs
3. 🧪 **Testing**: Test with real WordPress sites and report issues
4. 💡 **Ideas**: Propose new abilities or workflows in [GitHub Discussions](https://github.com/pluginslab/wordpress-agentic-admin/discussions)
5. 🌍 **Translation**: Help translate the plugin into other languages

### Getting Started

1. Read our [Contributing Guide](.github/CONTRIBUTING.md) for detailed guidelines
2. Check our [Code of Conduct](.github/CODE_OF_CONDUCT.md)
3. Review the architecture documentation:
   - [ARCHITECTURE.md](docs/ARCHITECTURE.md) - ReAct loop design
   - [Abilities Guide](docs/ABILITIES-GUIDE.md) - Implementing abilities
   - [Workflows Guide](docs/WORKFLOWS-GUIDE.md) - Creating workflows
4. Pick an issue labeled `good-first-issue` or propose your own contribution

### Quick Contribution Guidelines

- **Branch from `main`** - All PRs should target the `main` branch
- **Follow WordPress Coding Standards** - We use WordPress PHP and JavaScript standards
- **Write tests** - New abilities should include tests when applicable
- **Document your changes** - Update relevant documentation
- **Disclose AI assistance** - If you used AI tools, mention it in your PR description
- **Keep PRs focused** - One feature or fix per PR for easier review

For detailed guidelines, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## Contributors

Thank you to all our contributors! See the [GitHub Contributors page](https://github.com/pluginslab/wordpress-agentic-admin/graphs/contributors) for the full list.

Want to see your name here? Check out our [Contributing Guide](.github/CONTRIBUTING.md)!

## License

GPL-2.0-or-later

## Acknowledgments

- WordPress AI Team for the [Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm) for browser-based LLM inference
- CloudFest Hackathon 2026 for the initial development sprint
