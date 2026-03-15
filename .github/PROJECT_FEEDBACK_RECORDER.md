# Feedback Recorder — Agent-Native User Feedback Tool

## Overview

A browser-based feedback recorder that agents can inject into any website to capture synchronized audio transcripts, user interactions, and browser state. Designed for local agents (Claude Code, OpenClaw) to gather rich, actionable feedback via Chrome DevTools MCP.

**The Problem:**
Traditional bug reports are vague: *"The submit button doesn't work."*

**The Solution:**
User records feedback while interacting with the site. Agent receives:
- What the user **said** (speech transcript with timestamps)
- What they **did** (clicks, scrolls, selections with timestamps)
- What **broke** (console errors, network failures with timestamps)
- What they **saw** (viewport state, element visibility)

All synchronized to a single timeline.

---

## Architecture

### Injection Flow

**1. Agent Tool Call (Claude Code / OpenClaw):**
```
Tool: chrome-devtools-mcp.execute_javascript
Context: User is on example.com/checkout
Agent: "I'll inject a feedback recorder so you can show me the issue"
```

**2. MCP → Chrome DevTools Protocol:**
```js
// CDP Runtime.evaluate() executes in page context:
const swCode = `
  // Service Worker code (Whisper STT, event buffering)
  self.addEventListener('message', async (e) => {
    if (e.data.action === 'transcribe') {
      // Load Whisper tiny, process audio chunk
    }
  });
  // ... full recorder logic
`;

const blob = new Blob([swCode], {type: 'application/javascript'});
const swUrl = URL.createObjectURL(blob);
await navigator.serviceWorker.register(swUrl);

// Inject recorder UI
const recorderUI = document.createElement('div');
recorderUI.id = 'agent-feedback-recorder';
recorderUI.innerHTML = `
  <button id="start-recording">🔴 Record Feedback</button>
  <button id="stop-recording" disabled>⏹️ Stop</button>
  <div id="status"></div>
`;
document.body.appendChild(recorderUI);

// Attach event handlers
// ...
```

**3. User Records Feedback:**
- Clicks "🔴 Record Feedback"
- Navigates, clicks, scrolls, talks
- Describes issue: *"When I click this button, nothing happens"*
- Clicks "⏹️ Stop"

**4. Agent Receives Synchronized Event Stream:**
```json
{
  "sessionId": "uuid-123",
  "url": "https://example.com/checkout",
  "startTime": "2026-03-15T22:00:00Z",
  "duration": 45.3,
  "events": [
    {
      "t": 0.0,
      "type": "pageload",
      "url": "/checkout"
    },
    {
      "t": 1.2,
      "type": "speech",
      "text": "Okay, I'm trying to"
    },
    {
      "t": 2.1,
      "type": "click",
      "selector": "#submit-btn",
      "x": 450,
      "y": 200,
      "element": "<button id=\"submit-btn\">Submit Order</button>"
    },
    {
      "t": 2.3,
      "type": "speech",
      "text": "click this button but"
    },
    {
      "t": 2.8,
      "type": "console",
      "level": "error",
      "message": "Uncaught TypeError: Cannot read property 'submit' of null",
      "stack": "at handleClick (app.js:42)"
    },
    {
      "t": 3.5,
      "type": "network",
      "method": "POST",
      "url": "/api/submit",
      "status": 500,
      "timing": {"total": 1200}
    },
    {
      "t": 4.2,
      "type": "scroll",
      "y": 350
    },
    {
      "t": 5.1,
      "type": "speech",
      "text": "nothing happens. See?"
    }
  ],
  "finalState": {
    "url": "/checkout",
    "consoleErrors": 1,
    "networkErrors": 1,
    "viewport": {"width": 1920, "height": 1080, "scrollY": 350}
  }
}
```

---

## Components

### 1. Service Worker (Persistent Controller)

**Responsibilities:**
- Run Whisper tiny (~40MB) for speech-to-text
- Receive audio chunks from page via `postMessage`
- Buffer interaction events
- Write to IndexedDB incrementally
- Survive page navigation, tab close, browser restart

**Tech Stack:**
- `@huggingface/transformers` (transformers.js) for Whisper tiny
- IndexedDB for persistence
- Blob URL registration (injected by agent)

**Code Structure:**
```js
// sw-recorder.js
import { pipeline } from '@huggingface/transformers';

let transcriber = null;
let activeSession = null;

self.addEventListener('message', async (event) => {
  const { action, data } = event.data;
  
  switch (action) {
    case 'init':
      // Load Whisper tiny model
      transcriber = await pipeline('automatic-speech-recognition', 
        'Xenova/whisper-tiny.en', {device: 'webgpu'});
      break;
      
    case 'start-session':
      activeSession = {
        id: crypto.randomUUID(),
        url: data.url,
        startTime: Date.now(),
        events: []
      };
      await saveToIndexedDB(activeSession);
      break;
      
    case 'audio-chunk':
      // Transcribe audio chunk
      const result = await transcriber(data.audioBlob);
      const timestamp = (Date.now() - activeSession.startTime) / 1000;
      activeSession.events.push({
        t: timestamp,
        type: 'speech',
        text: result.text
      });
      await updateIndexedDB(activeSession);
      break;
      
    case 'interaction':
      // Store click/scroll/selection
      const timestamp = (Date.now() - activeSession.startTime) / 1000;
      activeSession.events.push({
        t: timestamp,
        ...data
      });
      await updateIndexedDB(activeSession);
      break;
      
    case 'finalize':
      // Return complete session to agent
      const session = await finalizeSession(activeSession.id);
      event.ports[0].postMessage({ session });
      break;
  }
});
```

### 2. Page Script (Event Capture)

**Responsibilities:**
- MediaRecorder for audio capture
- Event listeners for clicks, scrolls, selections
- Console/network monitoring via CDP or proxy
- UI controls (record/stop buttons)
- Communication with Service Worker

**Code Structure:**
```js
// recorder-ui.js
class FeedbackRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.sw = null;
    this.sessionActive = false;
  }
  
  async init() {
    this.sw = await navigator.serviceWorker.ready;
    await this.sw.active.postMessage({ action: 'init' });
    this.injectUI();
    this.setupListeners();
  }
  
  injectUI() {
    const ui = document.createElement('div');
    ui.id = 'agent-feedback-recorder';
    ui.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 999999;
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    ui.innerHTML = `
      <button id="start-rec">🔴 Record Feedback</button>
      <button id="stop-rec" disabled>⏹️ Stop</button>
      <div id="status">Ready</div>
    `;
    document.body.appendChild(ui);
    
    document.getElementById('start-rec').onclick = () => this.start();
    document.getElementById('stop-rec').onclick = () => this.stop();
  }
  
  async start() {
    // Start audio recording
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    
    this.mediaRecorder.ondataavailable = (e) => {
      // Send audio chunk to Service Worker
      this.sw.active.postMessage({
        action: 'audio-chunk',
        data: { audioBlob: e.data }
      });
    };
    
    this.mediaRecorder.start(1000); // 1s chunks for real-time transcription
    
    // Start session
    await this.sw.active.postMessage({
      action: 'start-session',
      data: { url: window.location.href }
    });
    
    // Attach interaction listeners
    this.attachEventListeners();
    
    this.sessionActive = true;
    document.getElementById('start-rec').disabled = true;
    document.getElementById('stop-rec').disabled = false;
    document.getElementById('status').textContent = '🔴 Recording...';
  }
  
  attachEventListeners() {
    // Track clicks
    document.addEventListener('click', (e) => {
      if (!this.sessionActive) return;
      this.sw.active.postMessage({
        action: 'interaction',
        data: {
          type: 'click',
          selector: this.getSelector(e.target),
          x: e.clientX,
          y: e.clientY,
          element: e.target.outerHTML.slice(0, 200)
        }
      });
    }, true);
    
    // Track scrolls (debounced)
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      if (!this.sessionActive) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.sw.active.postMessage({
          action: 'interaction',
          data: {
            type: 'scroll',
            y: window.scrollY,
            x: window.scrollX
          }
        });
      }, 150);
    }, true);
    
    // Track text selections
    document.addEventListener('mouseup', () => {
      if (!this.sessionActive) return;
      const selection = window.getSelection().toString();
      if (selection) {
        this.sw.active.postMessage({
          action: 'interaction',
          data: {
            type: 'selection',
            text: selection
          }
        });
      }
    });
    
    // Monitor console (requires CDP or override)
    this.monitorConsole();
    
    // Monitor network (requires CDP or fetch/XHR override)
    this.monitorNetwork();
  }
  
  monitorConsole() {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args) => {
      if (this.sessionActive) {
        this.sw.active.postMessage({
          action: 'interaction',
          data: {
            type: 'console',
            level: 'error',
            message: args.join(' ')
          }
        });
      }
      originalError.apply(console, args);
    };
    
    // Similar for warn, etc.
  }
  
  monitorNetwork() {
    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        if (this.sessionActive) {
          this.sw.active.postMessage({
            action: 'interaction',
            data: {
              type: 'network',
              method: 'GET',
              url: args[0],
              status: response.status,
              timing: { total: Date.now() - startTime }
            }
          });
        }
        return response;
      } catch (error) {
        if (this.sessionActive) {
          this.sw.active.postMessage({
            action: 'interaction',
            data: {
              type: 'network',
              method: 'GET',
              url: args[0],
              error: error.message
            }
          });
        }
        throw error;
      }
    };
    
    // Similar for XMLHttpRequest
  }
  
  getSelector(element) {
    // Generate CSS selector for element
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }
  
  async stop() {
    this.sessionActive = false;
    this.mediaRecorder.stop();
    
    // Finalize and retrieve session
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => {
      const { session } = e.data;
      
      // Send to agent via postMessage or return URL
      this.deliverToAgent(session);
      
      // Cleanup UI
      document.getElementById('agent-feedback-recorder').remove();
    };
    
    this.sw.active.postMessage(
      { action: 'finalize' },
      [channel.port2]
    );
    
    document.getElementById('status').textContent = 'Processing...';
  }
  
  deliverToAgent(session) {
    // Option A: postMessage to parent (if in iframe)
    window.parent.postMessage({ type: 'feedback-session', session }, '*');
    
    // Option B: Store in localStorage with known key
    localStorage.setItem('agent-feedback-session', JSON.stringify(session));
    
    // Option C: Send to local endpoint (if agent is listening)
    fetch('http://localhost:9999/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  }
}

// Auto-init
new FeedbackRecorder().init();
```

### 3. Agent Integration (MCP Tool)

**Tool Definition:**
```json
{
  "name": "inject-feedback-recorder",
  "description": "Inject a feedback recorder into the current browser tab. User can record speech + interactions, agent receives synchronized event stream.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "Message to show user (e.g., 'Show me the problem by clicking around')"
      }
    }
  }
}
```

**Tool Implementation (Node.js MCP Server):**
```js
// tools/inject-feedback-recorder.js
import { readFileSync } from 'fs';
import { join } from 'path';

export async function injectFeedbackRecorder(cdp, params) {
  // Read bundled recorder scripts
  const swCode = readFileSync(join(__dirname, '../recorder/sw-recorder.js'), 'utf8');
  const uiCode = readFileSync(join(__dirname, '../recorder/recorder-ui.js'), 'utf8');
  
  // Inject via Chrome DevTools Protocol
  await cdp.Runtime.evaluate({
    expression: `
      (async () => {
        // Register Service Worker via blob
        const swBlob = new Blob([\`${swCode}\`], {type: 'application/javascript'});
        const swUrl = URL.createObjectURL(swBlob);
        await navigator.serviceWorker.register(swUrl);
        
        // Inject recorder UI
        ${uiCode}
        
        // Show user message
        const status = document.getElementById('status');
        if (status) {
          status.textContent = '${params.message || 'Ready to record'}';
        }
      })();
    `,
    awaitPromise: true
  });
  
  return {
    content: [{
      type: "text",
      text: `Feedback recorder injected. User can now record their session. When they click stop, the session will be delivered to you automatically.`
    }]
  };
}
```

**Agent Workflow:**
```
User: "The checkout page isn't working"
Agent: [calls inject-feedback-recorder via chrome-devtools-mcp]
Agent: "I've injected a recorder. Please click the red button, then show me what happens when you try to checkout."
User: [clicks 🔴, navigates, clicks broken button, talks: "see, nothing happens"]
User: [clicks ⏹️]
Agent: [receives session via localhost endpoint or polls localStorage]
Agent: [analyzes session]
Agent: "I see the issue: when you clicked #submit-btn at 00:02.1, the page threw a TypeError because the payment handler wasn't loaded. The network request to /api/payment-config returned 404. I can help fix this."
```

---

## Data Flow

```
User clicks 🔴
  ↓
MediaRecorder starts → audio chunks every 1s
  ↓
Service Worker: Whisper tiny transcribes → events.push({t, type: 'speech', text})
  ↓ (simultaneously)
Page listeners capture clicks/scrolls/selections → postMessage to SW
  ↓
Service Worker: events.push({t, type: 'click', selector, x, y})
  ↓
Console/network monitoring → events.push({t, type: 'console'/'network', ...})
  ↓
All events stored in IndexedDB with timestamps
  ↓ (user navigates to new page)
Service Worker persists, new page reconnects
  ↓
Events continue accumulating in same session
  ↓
User clicks ⏹️
  ↓
Service Worker finalizes session → sorts events by timestamp
  ↓
Returns complete session to page
  ↓
Page delivers to agent (postMessage / localStorage / HTTP)
  ↓
Agent receives synchronized event stream
```

---

## Use Cases

### 1. Bug Reporting (Primary)
**User:** "The submit button doesn't work"
**Agent:** Injects recorder, user shows the problem
**Result:** Agent receives click location, console error, network failure — can diagnose without guessing

### 2. Feature Requests
**User:** "I wish there was a way to bulk edit posts"
**Agent:** Injects recorder, user shows their current workflow
**Result:** Agent sees the tedious multi-step process, can suggest automation or file feature request with context

### 3. Onboarding / Training
**User:** "How do I configure this plugin?"
**Agent:** Injects recorder, user explores the UI while talking
**Result:** Agent generates step-by-step documentation from the recording

### 4. UX Testing
**User:** "This form is confusing"
**Agent:** Injects recorder, user navigates and describes confusion
**Result:** Agent analyzes hesitation points (long pauses, backtracking) and suggests UI improvements

### 5. Performance Diagnostics
**User:** "This page is slow"
**Agent:** Injects recorder, user navigates to slow page
**Result:** Agent receives network timing, identifies slow API calls, correlates with user's perception of slowness

---

## Technical Considerations

### Cross-Navigation Persistence
**Challenge:** User navigates mid-recording, page script is destroyed
**Solution:** Service Worker survives navigation, new page reconnects to same session
```js
// On page load:
const sw = await navigator.serviceWorker.ready;
const activeSession = await sw.active.postMessage({ action: 'get-active-session' });
if (activeSession) {
  // Resume recording UI
}
```

### Privacy & Security
- **All local:** Audio never leaves the device, transcription via local Whisper model
- **User consent:** Explicit record button, clear visual indicator (🔴)
- **Sensitive data:** Option to exclude password fields, credit card inputs from event capture
- **Scope:** Recorder only active while user is interacting, stops when tab closes

### Model Size & Performance
- **Whisper tiny:** ~40MB, runs on WebGPU/WASM
- **Real-time transcription:** Process 1s chunks as they come in (no wait at end)
- **IndexedDB:** Incremental writes, no memory bloat
- **Event throttling:** Debounce scrolls, limit event granularity

### Browser Compatibility
- **Service Workers:** Chrome, Firefox, Safari
- **MediaRecorder:** Chrome, Firefox, Safari (with polyfill)
- **WebGPU (for Whisper):** Chrome 113+, graceful fallback to WASM
- **transformers.js:** Runs in Service Worker context (tested)

### Limitations
- **Console monitoring:** Overriding console.error/warn works but doesn't catch uncaught errors. Full console access requires CDP (Chrome extension or DevTools MCP).
- **Network monitoring:** Fetch/XHR override works for app code but misses preload/img requests. Full network log requires CDP.
- **For best results:** Agent should inject via Chrome DevTools MCP (has CDP access) rather than page-level script injection.

---

## Deployment Options

### Option A: Standalone MCP Server
Package as npm module, agent registers it as MCP tool:
```bash
npm install -g feedback-recorder-mcp
```
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "feedback-recorder": {
      "command": "feedback-recorder-mcp"
    }
  }
}
```

### Option B: Chrome Extension
Pre-installed extension, agent sends message to activate:
```js
chrome.runtime.sendMessage('feedback-recorder-ext', {
  action: 'inject',
  tabId: currentTab.id
});
```

### Option C: Integrated with Chrome DevTools MCP
Add as tool to existing chrome-devtools-mcp server (cleanest for agents already using CDP).

---

## Roadmap

### MVP (Hackathon-Ready)
- Service Worker with Whisper tiny (speech-to-text)
- Click/scroll/selection capture
- IndexedDB persistence
- Basic UI (🔴 record, ⏹️ stop)
- Output: JSON event stream
- Delivery: localStorage or HTTP POST

### V2 (Production-Ready)
- Chrome extension for easier deployment
- Full console/network monitoring via CDP
- Visual playback (timeline view of events)
- Export formats: JSON, Markdown report, video (screencast)
- Privacy controls: exclude sensitive fields

### V3 (Advanced)
- Multi-modal: screenshot on console error, screen recording
- Sentiment analysis: detect user frustration from tone
- Anomaly detection: flag unusual interaction patterns
- Integration: auto-create GitHub issues, Jira tickets

---

## Comparison with Existing Tools

| Feature | Feedback Recorder | Loom | Jam.dev | LogRocket |
|---------|-------------------|------|---------|-----------|
| **Local-first** | ✅ (Whisper local) | ❌ (cloud) | ❌ (cloud) | ❌ (cloud) |
| **Agent-native** | ✅ (MCP tool) | ❌ (human UI) | ❌ (human UI) | ❌ (human UI) |
| **Synchronized events** | ✅ | ❌ (video only) | ✅ | ✅ |
| **Speech transcript** | ✅ | ✅ | ❌ | ❌ |
| **Console/network** | ✅ | ❌ | ✅ | ✅ |
| **Open source** | ✅ | ❌ | ❌ | ❌ |
| **Cost** | Free | $$ | $$ | $$$ |

**Unique value:** The only tool designed for **agent consumption** rather than human review. Output is structured JSON for LLM reasoning, not a video for humans to watch.

---

## Success Metrics

### MVP Success
- Agent can inject recorder via MCP tool
- User records 30s session with 5+ interactions
- Agent receives synchronized event stream with speech + clicks + console errors
- Agent correctly diagnoses issue from session data

### Production Success
- Used by 100+ agent developers
- 1000+ feedback sessions captured
- 80%+ of sessions lead to actionable bug reports or fixes
- Average time from "report bug" to "agent proposes fix": <2 minutes

---

## Next Steps

1. **Prototype Service Worker with Whisper** (transformers.js)
2. **Build minimal UI** (record/stop buttons)
3. **Test injection via Chrome DevTools MCP**
4. **Validate event synchronization** (audio timestamps match interaction timestamps)
5. **Agent integration test** (Claude Code receives session, analyzes, responds)
6. **Package as MCP tool** (npm module or extension)
7. **Demo at hackathon** (live feedback recording → agent diagnosis)

---

## License

MIT (or Apache 2.0 to match wp-agentic-admin)

---

## Repository Structure

```
feedback-recorder/
├── README.md
├── package.json
├── src/
│   ├── sw-recorder.js          # Service Worker (Whisper STT)
│   ├── recorder-ui.js          # Page script (event capture)
│   ├── mcp-server.js           # MCP tool implementation
│   └── utils/
│       ├── indexeddb.js        # Session persistence
│       ├── whisper-loader.js   # Model loading
│       └── event-serializer.js # Event formatting
├── extension/                  # Chrome extension (optional)
│   ├── manifest.json
│   ├── background.js
│   └── content.js
└── examples/
    ├── claude-code-usage.md
    └── sample-session.json
```

---

**Status:** Proposal / Concept
**Estimated effort:** 2-3 days for MVP, 1-2 weeks for production-ready
**Hackathon fit:** Perfect demo piece — shows novel use of local AI + MCP + browser automation
