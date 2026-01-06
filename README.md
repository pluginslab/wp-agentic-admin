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
2. **Intent Detection**: Keyword-based routing determines which tool to use (reliable with small models)
3. **Execution**: The appropriate WordPress ability is called via REST API
4. **Summarization**: Results are formatted into human-readable summaries
5. **Conversation**: For non-tool queries, the local LLM provides conversational responses
6. **Confirmation**: Destructive actions always require explicit user approval

## Technology Stack

### Client-Side (The "Brain")
- **Runtime**: WebAssembly (WASM) & WebGPU
- **Library**: WebLLM
- **Model**: SmolLM2-360M-Instruct (quantized, ~360MB)
- **Framework**: React (integrated into WP-Admin)
- **Chat Framework**: Custom orchestrator with tool registry, keyword-based routing, and simulated streaming

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
4. Wait for the AI model to download (one-time, ~360MB)
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
├── wp-neural-admin.php          # Main plugin file
├── includes/
│   ├── class-abilities.php      # PHP: Abilities registration with WP Abilities API
│   ├── class-admin-page.php     # PHP: Admin page setup and asset loading
│   ├── class-settings.php       # PHP: Plugin settings
│   └── class-utils.php          # PHP: Utility functions
├── src/
│   └── extensions/
│       ├── index.js             # Entry point
│       ├── App.jsx              # Main React app with tabs and model loading
│       ├── components/
│       │   ├── ChatContainer.jsx    # Chat UI orchestration
│       │   ├── ChatInput.jsx        # Message input component
│       │   ├── MessageList.jsx      # Message list renderer
│       │   ├── MessageItem.jsx      # Individual message rendering
│       │   ├── ModelStatus.jsx      # Model loading status/controls
│       │   ├── AbilityBrowser.jsx   # Manual ability testing UI
│       │   └── WebGPUFallback.jsx   # Fallback for unsupported browsers
│       ├── services/
│       │   ├── index.js             # Central exports for all services
│       │   ├── chat-orchestrator.js # Main coordinator (LLM + Tools + Streaming)
│       │   ├── chat-session.js      # Message history + localStorage persistence
│       │   ├── tool-registry.js     # Central registry for tool definitions
│       │   ├── tool-router.js       # Keyword-based tool detection
│       │   ├── stream-simulator.js  # Typewriter effect for generated text
│       │   ├── wp-tools.js          # WordPress-specific tool configurations
│       │   ├── model-loader.js      # WebLLM model management
│       │   ├── abilities-api.js     # REST API client for WP Abilities
│       │   └── ai-service.js        # Legacy AI service (kept for reference)
│       └── styles/
│           └── main.scss            # Perplexity-style chat UI styles
├── build-extensions/            # Compiled JS/CSS (generated)
└── docs/
    └── PLAN.md                  # Development phases
```

### Building

```bash
cd wp-neural-admin
npm install
npm run build
```

---

## Chat Framework Architecture

The chat system uses a decoupled framework architecture designed to work reliably with small language models (SmolLM2-360M) that struggle with complex tool-calling instructions.

### Key Design Decisions

1. **Keyword-Based Tool Detection**: Small models are unreliable at following tool-calling prompts. Instead, we use keyword matching to detect user intent and select the appropriate tool.

2. **Simulated Streaming**: For tool responses (which are pre-generated), we simulate the streaming effect with a typewriter animation for consistent UX.

3. **Generated Summaries**: We don't show the model's output for tool calls (it hallucinates). Instead, we generate clean human-readable summaries from the structured tool results.

4. **Session Persistence**: Chat history is saved to localStorage, surviving page reloads.

### Service Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatContainer (React)                     │
│         UI State, Message Display, User Input                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ChatOrchestrator                          │
│         Main Coordinator - Routes to LLM or Tools            │
│    Callbacks: onStreamStart/Chunk/End, onToolStart/End       │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────────┐
│     ToolRouter      │            │      ModelLoader        │
│  Keyword Detection  │            │   WebLLM Management     │
│   Score-based Match │            │   Load/Unload Model     │
└─────────┬───────────┘            └─────────────────────────┘
          │
          ▼
┌─────────────────────┐            ┌─────────────────────────┐
│    ToolRegistry     │            │    StreamSimulator      │
│  Tool Definitions   │◄───────────│   Typewriter Effect     │
│  Keywords, Execute  │            │   Char/Word Streaming   │
└─────────┬───────────┘            └─────────────────────────┘
          │
          ▼
┌─────────────────────┐            ┌─────────────────────────┐
│      WPTools        │            │      ChatSession        │
│  WordPress Abilities│            │   Message History       │
│  Summaries, Execute │            │   localStorage Persist  │
└─────────────────────┘            └─────────────────────────┘
```

### Adding a New Tool

To add a new WordPress ability/tool:

1. **Register the ability in PHP** (`includes/class-abilities.php`):
```php
wp_register_ability('wp-neural-admin/my-new-tool', [
    'label' => __('My New Tool', 'wp-neural-admin'),
    'description' => __('Does something useful.', 'wp-neural-admin'),
    'category' => 'sre-tools',
    'callback' => [$this, 'execute_my_new_tool'],
    'input_schema' => [...],
    'output_schema' => [...],
]);
```

2. **Add the tool configuration in JavaScript** (`src/extensions/services/wp-tools.js`):
```javascript
{
    id: 'wp-neural-admin/my-new-tool',
    keywords: ['keyword1', 'keyword2', 'trigger phrase'],
    initialMessage: "Working on your request...",
    summarize: (result) => {
        // Generate human-readable summary from result
        return `Completed! Found ${result.count} items.`;
    },
    execute: async (params) => {
        return abilitiesApi.executeAbilityById('wp-neural-admin/my-new-tool', params);
    },
    requiresConfirmation: false, // Set true for destructive actions
},
```

3. **Rebuild**: `npm run build`

### Message Flow

```
User types: "what plugins are installed?"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. ChatOrchestrator.processMessage()                        │
│    - Adds user message to ChatSession                       │
│    - Calls ToolRouter.detectTool()                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ToolRouter.detectTool()                                  │
│    - Scans message for keywords                             │
│    - "plugins" matches wp-neural-admin/plugin-list          │
│    - Returns tool with highest keyword score                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ChatOrchestrator.processWithTool()                       │
│    a. Stream initial message ("I'll check your plugins...") │
│    b. Execute tool.execute() via AbilitiesAPI               │
│    c. Add tool result to session                            │
│    d. Generate & stream summary from tool.summarize()       │
└─────────────────────────────────────────────────────────────┘
```

### Service Reference

| Service | File | Purpose |
|---------|------|---------|
| `ChatOrchestrator` | `chat-orchestrator.js` | Main coordinator - handles message processing, routes to tools or LLM |
| `ChatSession` | `chat-session.js` | Manages message history, provides localStorage persistence |
| `ToolRegistry` | `tool-registry.js` | Central registry for all available tools |
| `ToolRouter` | `tool-router.js` | Detects which tool to use based on keyword matching |
| `StreamSimulator` | `stream-simulator.js` | Creates typewriter effect for pre-generated text |
| `WPTools` | `wp-tools.js` | WordPress-specific tool definitions (keywords, execute, summarize) |
| `ModelLoader` | `model-loader.js` | Manages WebLLM model lifecycle (load, unload, status) |
| `AbilitiesAPI` | `abilities-api.js` | REST client for WordPress Abilities API |

### Why Keyword Detection Instead of LLM Tool Calling?

Small language models (under 1B parameters) are unreliable at:
- Following complex system prompts
- Outputting structured tool calls in specific formats
- Not hallucinating tool names or parameters

Our solution:
- **Keyword detection** handles tool selection (fast, reliable, deterministic)
- **LLM** handles conversational responses when no tool is needed
- **Generated summaries** replace unreliable model output for tool results

This hybrid approach gives users a smooth experience while working within the constraints of browser-based small models.

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs to the `develop` branch.

## License

GPL-2.0-or-later

## Credits

- WordPress AI Team for the [Abilities API](https://github.com/WordPress/abilities-api)
- [WebLLM](https://github.com/mlc-ai/web-llm) for browser-based LLM inference
