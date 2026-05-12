# Service Worker Persistence

Service Worker persistence keeps the AI model loaded in memory even when you navigate between WordPress admin pages. This provides instant access without reloading the model every time.

## The Problem: Model Reloading

Without Service Worker persistence, here's what happens:

```
1. Visit Agentic Admin page → Load model (30 seconds)
2. Navigate to Plugins page → Model unloaded
3. Return to Agentic Admin → Load model again (30 seconds)
4. Navigate to Settings → Model unloaded
5. Return to Agentic Admin → Load model again (30 seconds)
```

Every page navigation triggers a full reload cycle. This is frustrating and wastes GPU resources.

## The Solution: Service Workers

A **Service Worker** is a background script that runs independently of web pages. It can:

- Run even when no pages are open
- Persist across page navigations
- Communicate with multiple tabs
- Cache resources
- Handle background tasks

For Agentic Admin for WordPress, the Service Worker loads the model **once** and keeps it in memory, serving inference requests from any WordPress admin page.

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────┐
│           WordPress Admin Pages                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Agentic  │  │ Plugins  │  │ Settings │      │
│  │  Admin   │  │   Page   │  │   Page   │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │              │             │
│       └─────────────┼──────────────┘             │
│                     │                            │
│              postMessage()                       │
│                     ↓                            │
│  ┌──────────────────────────────────────────┐   │
│  │         Service Worker                   │   │
│  │  ┌────────────────────────────────────┐  │   │
│  │  │   WebLLM Engine (in VRAM)          │  │   │
│  │  │   - Model loaded once              │  │   │
│  │  │   - Stays in memory                │  │   │
│  │  │   - Serves all tabs                │  │   │
│  │  └────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                     ↓
              Your GPU (VRAM)
```

### Lifecycle

**1. Service Worker Registration**

When you first visit Agentic Admin, the page registers the Service Worker:

```javascript
// In main page (App.jsx or index.js)
if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered');
}
```

**2. Model Loading in Service Worker**

The Service Worker loads the model into VRAM:

```javascript
// In Service Worker (sw.js)
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

self.addEventListener('message', (event) => {
    handler.onmessage(event);
});
```

**3. Page Communication**

Pages communicate with the Service Worker via `postMessage()`:

```javascript
// In page
const engine = await MLCEngineWorkerProxy.Create(
    serviceWorkerRegistration.active,
    'Qwen2.5-7B-Instruct-q4f16_1-MLC'
);

// Send inference request
const response = await engine.chat.completions.create({
    messages: [...],
});
```

**4. Persistence Across Navigation**

When you navigate to a different WordPress page:
- The page unloads
- The Service Worker stays active
- The model stays in VRAM
- Other pages can reconnect instantly

## Benefits

### 1. Instant Access

After the initial load, the model is immediately available:

```
First load:        Download + Load (5-10 minutes)
Navigate away:     Model stays in memory
Navigate back:     Instant (< 1 second)
```

No more waiting for model initialization on every page visit.

### 2. Multi-Tab Support

Multiple WordPress admin tabs can share the same model instance:

```
Tab 1: "List my plugins" → Service Worker → Response
Tab 2: "Check for errors" → Same Service Worker → Response
Tab 3: "Flush cache" → Same Service Worker → Response
```

One model in VRAM serves all tabs. This saves memory and GPU resources.

### 3. Reduced Memory Usage

Without Service Worker:
```
Tab 1: Model in VRAM (5GB)
Tab 2: Model in VRAM (5GB)
Tab 3: Model in VRAM (5GB)
Total: 15GB VRAM needed
```

With Service Worker:
```
Service Worker: Model in VRAM (5GB)
Tab 1, 2, 3: Share the same instance
Total: 5GB VRAM needed
```

### 4. Better Performance

The Service Worker model stays "warm" — no cold start penalty:

```
Without SW:  Load model (30s) → Inference (5s) → Unload → Repeat
With SW:     Load model once (30s) → Inference (5s) → Inference (5s) → ...
```

## Browser Compatibility

Service Worker persistence requires:
1. Service Worker API support
2. WebGPU access from Service Worker context

| Browser | Service Worker | WebGPU in SW | Status |
|---------|---------------|--------------|--------|
| **Chrome 113+** | ✅ | ✅ | Fully supported |
| **Edge 113+** | ✅ | ✅ | Fully supported |
| **Firefox 120+** | ✅ | ⚠️ | Experimental (flag required) |
| **Safari 17+** | ✅ | ❌ | **Not supported** |

### Safari Limitation

Safari supports Service Workers but **does not allow WebGPU access from Service Worker contexts**. This means the model cannot be loaded in the Service Worker on Safari.

**Fallback behavior:**

On Safari, Agentic Admin for WordPress automatically falls back to **page mode**:
- Model loads in the page context (not Service Worker)
- Model unloads when navigating away
- Must reload on each visit to Agentic Admin page

The plugin detects Safari and uses page mode transparently — no configuration needed.

## UI Indicator

Agentic Admin for WordPress shows a **"Persistent"** badge in the model status area when Service Worker mode is active:

```
┌─────────────────────────────────────┐
│ Model: Qwen 2.5 7B                  │
│ Status: Ready                       │
│ Mode: Persistent ✓                  │
└─────────────────────────────────────┘
```

If Service Worker persistence is unavailable (Safari, unsupported browser), the badge shows:

```
┌─────────────────────────────────────┐
│ Model: Qwen 2.5 7B                  │
│ Status: Ready                       │
│ Mode: Page (reloads on navigation)  │
└─────────────────────────────────────┘
```

## How to Tell If It's Working

### Method 1: Navigation Test

1. Load Agentic Admin page
2. Wait for model to load (first time: 5-10 min, cached: 30s)
3. Ask a question: "list my plugins"
4. Navigate to WordPress Plugins page
5. Navigate back to Agentic Admin
6. Ask another question: "check site health"

**If Service Worker is working:**
- Model loads **instantly** after navigation
- No loading spinner on return

**If Service Worker is NOT working:**
- Model reloads after navigation (30s+ delay)
- Loading spinner appears

### Method 2: DevTools Inspection

**Chrome DevTools:**
1. Open DevTools (F12)
2. Application → Service Workers
3. Check for `/sw.js` registration
4. Status should be "Activated and running"

**Console check:**
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
    console.log('Service Worker:', reg ? 'Active' : 'Not registered');
});
```

### Method 3: GPU Memory Monitoring

**Windows Task Manager:**
1. Performance → GPU → Dedicated GPU Memory
2. Load model in Agentic Admin → Memory increases (~5GB)
3. Navigate to Plugins page → Memory stays high (model still in VRAM)
4. Close all tabs → Memory decreases (model unloaded)

**macOS Activity Monitor:**
1. Window → GPU History
2. Load model → GPU memory usage increases
3. Navigate away → GPU memory stays elevated

## Service Worker Lifecycle

### Registration

Happens automatically on first page load:

```javascript
// Automatic registration
if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register('/sw.js');
}
```

### Activation

After registration, the Service Worker activates:

```
Registered → Installing → Installed → Activating → Activated
```

The model can only be loaded once the Service Worker is **activated**.

### Updates

When the plugin is updated and `sw.js` changes:

1. Browser detects new Service Worker version
2. New Service Worker installs alongside old one
3. User refreshes the page → new Service Worker activates
4. Old Service Worker terminates
5. Model reloads in new Service Worker

**Note:** This means model reload is required after plugin updates.

### Termination

Service Workers can be terminated by the browser:

- After 30 seconds of inactivity (Chrome's default)
- When memory pressure is high
- When user clears browsing data
- When browser restarts

**However**, WebLLM's Service Worker implementation uses techniques to keep it alive:

- Periodic keepalive messages
- Event listeners that prevent termination
- VRAM allocation (browser avoids killing SW with active GPU resources)

In practice, the Service Worker stays alive as long as:
- At least one WordPress admin tab is open
- The browser process is running
- Memory/GPU resources are available

## Debugging Service Worker Issues

### Problem: Service Worker Not Registering

**Check:**
1. HTTPS required (or `localhost`) — Service Workers don't work on plain HTTP
2. Browser compatibility (Chrome 113+ recommended)
3. No browser extensions blocking Service Workers

**Solution:**
- Visit `chrome://serviceworker-internals/` and check for errors
- Unregister old Service Workers: `chrome://serviceworker-internals/` → Unregister
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (macOS)

### Problem: Model Not Staying Loaded

**Check:**
1. Multiple tabs competing for VRAM
2. Other GPU applications (games, video editing) using VRAM
3. Low memory conditions

**Solution:**
- Close unused tabs/applications
- Use smaller model (Qwen 3 1.7B instead of 7B)
- Check GPU memory: Task Manager → GPU

### Problem: Service Worker Crash

**Symptoms:**
- Model stops responding mid-conversation
- Console shows "Service Worker terminated"

**Causes:**
- Out of memory (VRAM exhausted)
- Browser memory limits exceeded
- GPU driver crash

**Solution:**
- Refresh the page (model will reload)
- Check GPU drivers are up-to-date
- Reduce VRAM usage (close other tabs, switch to smaller model)

## Performance Considerations

### VRAM Usage

Service Worker keeps the model in VRAM permanently (while active):

```
Model loaded:     5GB VRAM used
Idle for 1 hour:  5GB VRAM still used
No requests:      5GB VRAM still used
```

**Implication:** You sacrifice 5GB of VRAM for instant access. This is acceptable for most users, but high-end GPU users running multiple intensive applications may prefer page mode (reload on each use) to free VRAM when not actively using Agentic Admin.

### CPU Usage

Service Worker itself uses minimal CPU when idle:

```
Idle:       < 1% CPU
Inference:  10-30% CPU (varies by model size)
```

The GPU does the heavy lifting — the Service Worker just orchestrates.

## Manual Control (Advanced)

For users who want control over Service Worker behavior:

### Disable Persistence (Use Page Mode)

Add to plugin settings (future enhancement):

```javascript
// Force page mode (no Service Worker)
wpAgenticAdmin.config.serviceWorkerEnabled = false;
```

This loads the model in page context instead of Service Worker, unloading on navigation.

### Unregister Service Worker

To manually remove the Service Worker:

```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
        if (registration.active.scriptURL.includes('sw.js')) {
            registration.unregister();
        }
    }
});
```

Or via DevTools:
1. Application → Service Workers
2. Click "Unregister"

## Summary

Service Worker persistence keeps the AI model loaded in VRAM across WordPress admin page navigations, providing instant access without reloading. It's supported in Chrome 113+ and Edge 113+, but not Safari (which falls back to page mode). The Service Worker enables multi-tab support and reduces memory usage by sharing one model instance across all tabs.

**Next:** [The ReAct Pattern](08-react-pattern.md)
