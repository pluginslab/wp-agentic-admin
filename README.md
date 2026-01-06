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

- **100% Local AI**: Uses WebLLM to run a Small Language Model (Phi-3.5-mini) directly in your browser via WebAssembly and WebGPU
- **Privacy-First**: No admin data ever leaves your device - GDPR compliant by design
- **Zero Server Costs**: No GPU infrastructure needed - computation happens on the client
- **WordPress Abilities API**: Natively integrates with WordPress's official Abilities API for standardized capability discovery and execution
- **Natural Language Interface**: Describe problems in plain English, get intelligent solutions

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Your Browser                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │              Local AI (WebLLM)                     │ │
│  │         Phi-3.5-mini via WebGPU/WASM              │ │
│  └───────────────────────────────────────────────────┘ │
│                         │                               │
│                   Tool Calls                            │
│                         ▼                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │           WordPress Abilities API                  │ │
│  │    Standardized capability discovery & execution   │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                    REST API                    
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 WordPress Server                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │            Registered SRE Abilities                │ │
│  │  - Error log reading                               │ │
│  │  - Cache management                                │ │
│  │  - Database optimization                           │ │
│  │  - Plugin management                               │ │
│  │  - Site health diagnostics                         │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### The Agent Loop

1. **User Input**: You describe a problem in natural language
2. **AI Reasoning**: The local AI model analyzes your request and determines which WordPress abilities to use
3. **Discovery**: AI queries available abilities via the Abilities API
4. **Execution**: AI calls the appropriate ability endpoints
5. **Analysis**: AI interprets the results and either responds or takes further action
6. **Resolution**: AI proposes and (with your approval) executes fixes

## Technology Stack

### Client-Side (The "Brain")
- **Runtime**: WebAssembly (WASM) & WebGPU
- **Library**: WebLLM
- **Model**: Phi-3.5-mini-instruct (quantized)
- **Framework**: React (integrated into WP-Admin)

### Server-Side (The "Body")
- **Plugin**: PHP WordPress plugin
- **Protocol**: WordPress Abilities API
- **Tools**: Native PHP implementations of SRE functions

## Requirements

- WordPress 6.7+
- PHP 8.2+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+, or Firefox with flags)
- [Abilities API plugin](https://github.com/WordPress/abilities-api) installed

## Installation

1. Install and activate the [Abilities API plugin](https://github.com/WordPress/abilities-api/releases/latest)
2. Download and install WP-Neural-Admin
3. Navigate to "Neural Admin" in your WordPress admin menu
4. Wait for the AI model to download (one-time, ~2.7GB)
5. Start chatting!

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
    
    Would you like me to help with any of these?
```

## Privacy & Security

- **No External API Calls**: The AI model runs entirely in your browser
- **No Data Collection**: Your site data never leaves your device
- **Permission-Based**: All abilities respect WordPress capabilities (requires `manage_options`)
- **Confirmation Required**: Destructive actions always require explicit user approval

## Development

This project was created for the CloudFest Hackathon 2026.

### Project Structure
```
wp-neural-admin/
├── wp-neural-admin.php      # Main plugin file
├── includes/
│   ├── class-abilities.php  # Abilities registration
│   ├── class-settings.php   # Admin settings
│   └── api/                  # REST API extensions
├── src/
│   └── extensions/          # React chat UI
├── build-extensions/        # Compiled JS/CSS
└── docs/
    └── PLAN.md              # Development phases
```

### Building

```bash
cd wp-neural-admin
npm install
npm run build
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs to the `develop` branch.

## License

GPL-2.0-or-later

## Credits

- WordPress AI Team for the [Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm) for browser-based LLM inference
- CloudFest Hackathon 2026 organizers
