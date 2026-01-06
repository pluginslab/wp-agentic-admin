# Chat Framework Architecture

The chat system uses a decoupled framework architecture designed to work reliably with small language models (SmolLM2-360M) that struggle with complex tool-calling instructions.

## Design Philosophy

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

## Architecture Overview

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
│   AbilitiesAPI      │            │      ChatSession        │
│  REST API Client    │            │   Message History       │
│  Execute Abilities  │            │   localStorage Persist  │
└─────────────────────┘            └─────────────────────────┘
```

## Message Flow

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

## Service Reference

| Service | File | Purpose |
|---------|------|---------|
| `ChatOrchestrator` | `chat-orchestrator.js` | Main coordinator - handles message processing, routes to tools or LLM |
| `ChatSession` | `chat-session.js` | Manages message history, provides localStorage persistence |
| `NeuralAbilitiesAPI` | `neural-abilities-api.js` | Public API for registering abilities |
| `ToolRegistry` | `tool-registry.js` | Central registry for all available tools |
| `ToolRouter` | `tool-router.js` | Detects which tool to use based on keyword matching |
| `StreamSimulator` | `stream-simulator.js` | Creates typewriter effect for pre-generated text |
| `ModelLoader` | `model-loader.js` | Manages WebLLM model lifecycle |
| `AbilitiesAPI` | `abilities-api.js` | REST client for WordPress Abilities API |

## Key Components

### ChatOrchestrator

The main coordinator that ties everything together:

```javascript
// Initialize
const orchestrator = new ChatOrchestrator({
    systemPrompt: 'You are a helpful WordPress assistant.',
    llmOptions: { temperature: 0.2, maxTokens: 256 },
    streamOptions: { charDelay: 15 },
});

// Set callbacks for UI integration
orchestrator.setCallbacks({
    onStreamStart: () => { /* show typing indicator */ },
    onStreamChunk: (char, fullText) => { /* update display */ },
    onStreamEnd: (fullText) => { /* finalize message */ },
    onToolStart: (toolId) => { /* show loading state */ },
    onToolEnd: (toolId, result) => { /* update UI */ },
});

// Process user message
await orchestrator.processMessage('What plugins are installed?');
```

### ToolRegistry

Central registry for tool definitions:

```javascript
toolRegistry.register({
    id: 'wp-neural-admin/plugin-list',
    keywords: ['plugin', 'plugins', 'extensions'],
    initialMessage: "I'll check your plugins...",
    execute: async (params) => { /* call API */ },
    summarize: (result) => { /* format response */ },
});

// Get a tool
const tool = toolRegistry.get('wp-neural-admin/plugin-list');

// Get all tools
const allTools = toolRegistry.getAll();
```

### ToolRouter

Keyword-based tool detection with scoring:

```javascript
// Detect which tool to use
const tool = toolRouter.detectTool('show me all plugins');
// Returns: { id: 'wp-neural-admin/plugin-list', ... }

// Scoring: longer keyword matches score higher
// "optimize database" (2 words) beats "database" (1 word)
```

### StreamSimulator

Creates typewriter effect for pre-generated text:

```javascript
await streamSimulator.stream('Processing your request...', {
    charDelay: 15,  // ms between characters
    onChunk: (char, fullText) => {
        displayElement.textContent = fullText;
    },
});
```

### ChatSession

Manages message history with persistence:

```javascript
const session = new ChatSession('unique-session-id');

// Add messages
session.addUserMessage('Hello');
session.addAssistantMessage('Hi there!');
session.addToolResult('plugin-list', { plugins: [...] }, true);

// Get history for LLM context
const history = session.getConversationHistory();

// Persistence
session.save();   // Save to localStorage
session.load();   // Load from localStorage
session.clear();  // Clear history
```

### AbilitiesAPI

REST client for WordPress Abilities API:

```javascript
// List all abilities
const abilities = await abilitiesApi.listAbilities();

// Execute an ability
const result = await abilitiesApi.executeAbilityById(
    'wp-neural-admin/plugin-list',
    { status: 'active' }
);

// The client handles:
// - HTTP method selection based on annotations (GET/POST/DELETE)
// - Input serialization (query params for GET, JSON body for POST)
// - Nonce authentication
```

## React Integration

### ChatContainer Component

```jsx
function ChatContainer() {
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState('');
    
    useEffect(() => {
        orchestrator.setCallbacks({
            onStreamChunk: (char, text) => setStreamingText(text),
            onStreamEnd: (text) => {
                setStreamingText('');
                // Message added to session automatically
            },
            onMessageAdd: (messages) => setMessages([...messages]),
        });
    }, []);
    
    const handleSend = async (message) => {
        await orchestrator.processMessage(message);
    };
    
    return (
        <div>
            <MessageList messages={messages} streamingText={streamingText} />
            <ChatInput onSend={handleSend} />
        </div>
    );
}
```

## Extending the Framework

### Adding Custom Tools

See [Abilities Guide](./abilities-guide.md) for complete instructions.

### Custom Keyword Scoring

The default scoring gives 1 point per word matched. For custom scoring:

```javascript
// In tool-router.js
calculateScore(message, keywords) {
    let score = 0;
    const lowerMessage = message.toLowerCase();
    
    for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
            // Custom: weight by keyword length
            score += keyword.split(' ').length * 2;
        }
    }
    
    return score;
}
```

### Custom Stream Effects

```javascript
// Word-by-word instead of character-by-character
await streamSimulator.stream(text, {
    mode: 'word',
    wordDelay: 50,
    onChunk: (word, fullText) => { /* update */ },
});
```
