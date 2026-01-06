# WP-Neural-Admin

**The Local-First AI Site Reliability Engineer for WordPress**

A privacy-first AI assistant that runs entirely in your browser, helping you diagnose and fix WordPress issues through natural language commands.

## What is WP-Neural-Admin?

WP-Neural-Admin transforms your WordPress admin panel into an intelligent command center. Instead of navigating through multiple screens to diagnose issues, you simply describe your problem in plain English:

> "My site is throwing 500 errors"

The AI assistant will:
1. Read your error logs
2. Identify the problematic plugin or theme
3. Propose a fix
4. Execute it with your approval

All of this happens **locally in your browser** - no data is sent to external servers, no API costs, complete privacy.

## Key Features

- **100% Local AI**: Uses WebLLM to run a Small Language Model (SmolLM2-360M) directly in your browser via WebGPU
- **Privacy-First**: No admin data ever leaves your device - GDPR compliant by design
- **Zero Server Costs**: No GPU infrastructure needed - computation happens on the client
- **WordPress Abilities API**: Natively integrates with WordPress's official Abilities API
- **Extensible**: Third-party plugins can register custom abilities
- **Natural Language Interface**: Describe problems in plain English, get intelligent solutions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Your Browser                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Local AI (WebLLM)                         │  │
│  │         SmolLM2-360M via WebGPU/WASM                   │  │
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

## Requirements

- WordPress 6.9+ (includes the Abilities API)
- PHP 8.2+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+)

## Installation

1. Download and install WP-Neural-Admin
2. Navigate to "Neural Admin" in your WordPress admin menu
3. Wait for the AI model to download (one-time, ~360MB)
4. Start chatting!

## Available Abilities

| Ability | Description | Destructive |
|---------|-------------|-------------|
| `error-log-read` | Read recent entries from debug.log | No |
| `cache-flush` | Flush WordPress object cache | No |
| `db-optimize` | Optimize database tables | No |
| `plugin-list` | List all installed plugins with status | No |
| `plugin-deactivate` | Deactivate a specific plugin | Yes |
| `site-health` | Get comprehensive site health information | No |

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

## Documentation

| Document | Description |
|----------|-------------|
| [Abilities Guide](docs/abilities-guide.md) | How to create new abilities |
| [Chat Framework](docs/chat-framework.md) | Architecture of the chat system |
| [Third-Party Integration](docs/third-party-integration.md) | Extending with custom plugins |

## Project Structure

```
wp-neural-admin/
├── wp-neural-admin.php              # Main plugin file
├── includes/
│   ├── functions-abilities.php      # Public API: register_neural_ability()
│   ├── class-abilities.php          # Ability registration orchestrator
│   ├── class-admin-page.php         # Admin page & assets
│   └── abilities/                   # Individual PHP ability files
├── src/extensions/
│   ├── App.jsx                      # Main React app
│   ├── abilities/                   # Individual JS ability files
│   ├── components/                  # React UI components
│   └── services/                    # Core services (orchestrator, registry, etc.)
├── build-extensions/                # Compiled assets
└── docs/                            # Documentation
```

## Development

### Building

```bash
cd wp-neural-admin
npm install
npm run build
```

### Technology Stack

**Client-Side:**
- Runtime: WebAssembly & WebGPU
- AI: WebLLM with SmolLM2-360M
- UI: React
- Chat: Custom orchestrator with keyword-based tool routing

**Server-Side:**
- Plugin: PHP 8.2+
- Protocol: WordPress Abilities API

## Privacy & Security

- **No External API Calls**: The AI model runs entirely in your browser
- **No Data Collection**: Your site data never leaves your device
- **Permission-Based**: All abilities respect WordPress capabilities
- **Confirmation Required**: Destructive actions require explicit approval

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs.

## License

GPL-2.0-or-later

## Credits

- WordPress AI Team for the [Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm) for browser-based LLM inference
- Created for CloudFest Hackathon 2026
