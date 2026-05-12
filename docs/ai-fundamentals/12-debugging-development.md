# Debugging & Development

A comprehensive guide to debugging issues, monitoring performance, and developing new features for Agentic Admin for WordPress.

## Development Environment Setup

### Prerequisites

```bash
# Required
Node.js 18+
npm 8+
PHP 8.2+
WordPress 6.9+
Chrome 113+ or Edge 113+

# Optional but recommended
wp-cli (for WordPress management)
phpcs (for WordPress coding standards)
```

### Installation

```bash
# Clone the repository
git clone git@github.com:pluginslab/wp-agentic-admin.git
cd wp-agentic-admin

# Install dependencies
npm install

# Build assets
npm run build

# Watch for changes (development)
npm run dev
```

### WordPress Setup

```bash
# Link plugin to WordPress installation
ln -s $(pwd) /path/to/wordpress/wp-content/plugins/wp-agentic-admin

# Or use wp-cli
wp plugin install /path/to/wp-agentic-admin --activate
```

### Local Development Workflow

**1. Make changes to source files:**
```
src/extensions/abilities/my-new-ability.js
includes/abilities/my-new-ability.php
```

**2. Rebuild:**
```bash
npm run build
# Or watch mode for auto-rebuild
npm run dev
```

**3. Hard refresh browser:**
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (macOS)
```

Service Worker changes require unregistering:
```
DevTools → Application → Service Workers → Unregister
```

## Browser DevTools

### Console Debugging

**Enable verbose logging:**

```javascript
// In browser console
localStorage.setItem('wpAgenticDebug', 'true');
location.reload();
```

This enables detailed logging:
```
[WebLLM] Model loading: 67%
[ReAct] Iteration 1: Calling site-health
[Abilities] Executing wp-agentic-admin/site-health
[ReAct] Observation: {success: true, ...}
```

**Disable logging:**
```javascript
localStorage.removeItem('wpAgenticDebug');
location.reload();
```

### Network Tab

Monitor REST API calls:

1. Open DevTools → Network
2. Filter: "wp-json"
3. Send a message
4. Inspect requests:
   - `POST /wp-json/abilities/v1/execute/site-health`
   - Request payload
   - Response data
   - Timing

**Look for:**
- 400 errors → Invalid input
- 403 errors → Permission denied
- 500 errors → PHP errors (check server logs)
- Slow requests (> 1s) → Optimize ability execution

### Application Tab

**Service Worker inspection:**

1. Application → Service Workers
2. Check status: "Activated and running"
3. View console logs (click "source")
4. Unregister/restart if needed

**IndexedDB inspection:**

1. Application → Storage → IndexedDB
2. Check `web-llm-cache` database
3. See cached models (4-5GB per model)
4. Clear cache: Right-click → Delete database

**Cache Storage:**

1. Application → Cache Storage
2. WebLLM stores compiled shaders here
3. Useful for diagnosing model loading issues

### Performance Tab

**Profile model loading:**

1. Performance → Record
2. Load Agentic Admin page
3. Stop recording after model loads
4. Analyze timeline:
   - Network: Model download
   - JavaScript: Compilation
   - GPU: VRAM allocation

**Profile inference:**

1. Record
2. Send message to AI
3. Stop after response
4. Look for:
   - Long tasks (> 50ms yellow bars)
   - GPU activity
   - Network calls (tool execution)

### Memory Tab

**Track VRAM usage:**

1. Performance → Memory
2. Click "Heap snapshots"
3. Take snapshot before loading model
4. Load model
5. Take another snapshot
6. Compare difference (should show ~5GB increase)

**Detect memory leaks:**

1. Take snapshot
2. Use the AI for 5 minutes
3. Take another snapshot
4. Compare: Should be similar (no major growth)
5. If memory grows significantly → leak

## Test Hook API

Agentic Admin for WordPress exposes `window.__wpAgenticTestHook` for debugging:

### Available Methods

```javascript
// Get all messages in current conversation
const messages = window.__wpAgenticTestHook.getMessages();
console.log(messages);
// [
//   { role: 'user', content: 'list plugins' },
//   { role: 'assistant', content: 'You have 24 plugins...' }
// ]

// Get last ReAct execution details
const result = window.__wpAgenticTestHook.getLastReactResult();
console.log(result);
// {
//   toolsUsed: ['wp-agentic-admin/plugin-list'],
//   observations: [{tool: 'plugin-list', result: {...}}],
//   iterations: 1,
//   finalResponse: 'You have 24 plugins...'
// }

// Get tools called in last execution
const tools = window.__wpAgenticTestHook.getToolsUsed();
console.log(tools);
// ['wp-agentic-admin/plugin-list']

// Get tool observations
const observations = window.__wpAgenticTestHook.getObservations();
console.log(observations);
// [{tool: 'plugin-list', result: {plugins: [...], total: 24}}]

// Check if AI is processing
const isProcessing = window.__wpAgenticTestHook.isProcessing();
console.log(isProcessing);  // true or false

// Send message programmatically
window.__wpAgenticTestHook.sendMessage('list my plugins');

// Clear chat history
window.__wpAgenticTestHook.clearChat();
```

### Usage Examples

**Verify tool selection:**
```javascript
window.__wpAgenticTestHook.clearChat();
window.__wpAgenticTestHook.sendMessage('list plugins');

// Wait for completion
setTimeout(() => {
    const tools = window.__wpAgenticTestHook.getToolsUsed();
    console.assert(
        tools.includes('wp-agentic-admin/plugin-list'),
        'Expected plugin-list to be called'
    );
}, 10000);
```

**Debug multi-step flows:**
```javascript
window.__wpAgenticTestHook.sendMessage('check for problems');

setTimeout(() => {
    const result = window.__wpAgenticTestHook.getLastReactResult();
    console.log(`Tools called: ${result.toolsUsed.join(' → ')}`);
    console.log(`Iterations: ${result.iterations}`);
    result.observations.forEach((obs, i) => {
        console.log(`[${i+1}] ${obs.tool}:`, obs.result);
    });
}, 15000);
```

## Common Issues & Solutions

### Issue: Model Won't Load

**Symptoms:**
- Stuck at "Loading model: 0%"
- Console error: "Failed to fetch"

**Causes:**
1. No internet connection (first load)
2. CDN issues (HuggingFace down)
3. Browser cache corruption
4. Insufficient VRAM

**Solutions:**

```javascript
// 1. Check internet connectivity
fetch('https://huggingface.co').then(() => console.log('Online'));

// 2. Check WebGPU availability
if ('gpu' in navigator) {
    console.log('WebGPU available');
} else {
    console.error('WebGPU not supported');
}

// 3. Clear cache and retry
// DevTools → Application → IndexedDB → web-llm-cache → Delete

// 4. Check VRAM availability
// Task Manager (Windows) → GPU memory
// Or try smaller model (Qwen 3 1.7B)
```

### Issue: Service Worker Not Active

**Symptoms:**
- "Persistent" badge missing
- Model reloads on every page navigation

**Causes:**
1. Safari (doesn't support WebGPU in SW)
2. Browser settings blocking Service Workers
3. HTTPS required (or localhost)

**Solutions:**

```javascript
// Check Service Worker registration
navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) {
        console.error('Service Worker not registered');
    } else if (reg.active) {
        console.log('Service Worker active');
    } else {
        console.warn('Service Worker not active:', reg);
    }
});

// Force re-registration
navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
    location.reload();
});

// Check for HTTPS
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.error('Service Workers require HTTPS or localhost');
}
```

### Issue: Slow Inference (< 10 tok/s)

**Symptoms:**
- Responses take 30+ seconds
- UI feels unresponsive

**Causes:**
1. Running on CPU (WASM) instead of GPU
2. Thermal throttling (laptop)
3. Other GPU applications
4. Wrong model loaded

**Solutions:**

```javascript
// Check if WebGPU is being used
console.log('Using WebGPU:', window.__wpAgenticModelStatus?.backend === 'webgpu');

// Check GPU memory usage
// Task Manager → GPU → Dedicated GPU Memory
// Should show ~5GB in use for Qwen 2.5 7B

// Reduce load
// - Close other tabs
// - Close GPU-heavy applications (games, video editors)
// - Ensure laptop is plugged in (not battery mode)

// Try smaller model
// Settings → Model → Qwen 3 1.7B
```

### Issue: Tools Not Executing

**Symptoms:**
- AI says "I'll check plugins" but nothing happens
- Console error: "Ability not found"

**Causes:**
1. Ability not registered (PHP side)
2. Permission denied
3. REST API disabled

**Solutions:**

```javascript
// Check registered abilities
fetch('/wp-json/abilities/v1/list')
    .then(r => r.json())
    .then(abilities => {
        console.log('Registered abilities:', abilities);
    });

// Check specific ability
fetch('/wp-json/abilities/v1/describe/wp-agentic-admin/plugin-list')
    .then(r => r.json())
    .then(schema => console.log('Ability schema:', schema))
    .catch(e => console.error('Ability not found:', e));

// Test execution manually
fetch('/wp-json/abilities/v1/execute/wp-agentic-admin/plugin-list', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': wpApiSettings.nonce,
    },
    body: JSON.stringify({}),
})
.then(r => r.json())
.then(result => console.log('Result:', result))
.catch(e => console.error('Execution failed:', e));
```

### Issue: JSON Parsing Errors

**Symptoms:**
- Console error: "Unexpected token in JSON"
- AI response is garbled

**Causes:**
1. Model generating malformed JSON
2. JSON sanitizer failing
3. Small model struggling with structured output

**Solutions:**

```javascript
// Enable debug logging to see raw LLM output
localStorage.setItem('wpAgenticDebug', 'true');

// Check sanitizer
const malformed = "{tool: 'plugin-list'}";  // Missing quotes
const sanitized = sanitizeJson(malformed);
console.log(sanitized);  // Should fix it

// If sanitizer fails, the issue is logged:
// [ReactAgent] Failed to parse JSON: ...
// [ReactAgent] Raw output: ...

// Solution: Use larger model (Qwen 2.5 7B)
// Or report the specific failure case for sanitizer improvement
```

### Issue: Confirmation Dialog Not Showing

**Symptoms:**
- Destructive action executes without confirmation
- No dialog appears

**Causes:**
1. `requiresConfirmation` not set
2. JavaScript error preventing dialog
3. Dialog blocked by browser

**Solutions:**

```javascript
// Check ability configuration
const tools = window.__wpAgenticTools;
const tool = tools['wp-agentic-admin/plugin-deactivate'];
console.log('Requires confirmation:', tool.requiresConfirmation);
console.log('Confirmation message:', tool.confirmationMessage);

// Test dialog manually
if (confirm('Test confirmation')) {
    console.log('User confirmed');
} else {
    console.log('User cancelled');
}

// Check for popup blocker
// Browser may block confirm() dialogs in certain contexts
```

## Testing

### Running Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- react-agent

# Watch mode (auto-run on changes)
npm run test:watch

# Coverage report
npm test -- --coverage
```

### Writing Tests

**Test structure:**
```javascript
import { ReactAgent } from '../react-agent';

describe('ReactAgent', () => {
    let agent;

    beforeEach(() => {
        agent = new ReactAgent({
            systemPrompt: 'Test prompt',
            tools: [],
        });
    });

    it('should parse valid tool call', () => {
        const json = '{"tool": "plugin-list", "arguments": {}}';
        const parsed = agent.parseToolCall(json);
        
        expect(parsed.tool).toBe('plugin-list');
        expect(parsed.arguments).toEqual({});
    });

    it('should handle malformed JSON', () => {
        const json = "{tool: 'plugin-list'}";  // Single quotes
        const parsed = agent.parseToolCall(json);
        
        expect(parsed.tool).toBe('plugin-list');
    });
});
```

### E2E Testing

See [TESTING.md](../../tests/TESTING.md) for complete E2E testing guide.

**Quick reference:**
```javascript
// E2E tests run via Claude Code + Chrome DevTools MCP
// Test suites in tests/e2e/suites/

// Example test
{
    name: 'List plugins',
    input: 'list all installed plugins',
    assertions: {
        toolsCalled: ['wp-agentic-admin/plugin-list'],
        responseNotEmpty: true,
    },
}
```

## Logging Utilities

### JavaScript Logging

Agentic Admin for WordPress uses a centralized logger:

```javascript
import { log } from '../utils/logger';

// Log levels
log.info('Model loaded successfully');
log.warn('Service Worker not available');
log.error('Failed to parse JSON', { error });
log.debug('Tool execution', { tool: 'plugin-list', params: {} });

// Group logs
log.group('ReAct Iteration 1');
log.info('Calling site-health');
log.info('Observation:', result);
log.groupEnd();
```

**Output format:**
```
[WP-Agentic] INFO: Model loaded successfully
[WP-Agentic] WARN: Service Worker not available
[WP-Agentic] ERROR: Failed to parse JSON {error: ...}
```

### PHP Logging

Use WordPress debug logging:

```php
// Enable debug logging in wp-config.php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );

// Log from PHP
error_log( '[WP-Agentic] Executing ability: plugin-list' );
error_log( print_r( $result, true ) );

// Logs go to: wp-content/debug.log
```

## Performance Profiling

### Measure Inference Speed

```javascript
console.time('Inference');

const response = await engine.chat.completions.create({
    messages: [...],
});

console.timeEnd('Inference');
// Inference: 4235ms

// Calculate tokens per second
const tokens = response.usage?.completion_tokens || 0;
const timeMs = 4235;
const tokensPerSec = (tokens / timeMs) * 1000;
console.log(`${tokensPerSec.toFixed(1)} tokens/sec`);
```

### Measure Tool Execution

```javascript
console.time('Tool: plugin-list');

const result = await executeAbility('wp-agentic-admin/plugin-list', {});

console.timeEnd('Tool: plugin-list');
// Tool: plugin-list: 142ms
```

### Measure Full ReAct Loop

```javascript
const startTime = performance.now();

await processMessage('list my plugins');

const endTime = performance.now();
console.log(`Total time: ${(endTime - startTime) / 1000}s`);
```

## Contributing Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-new-ability
```

### 2. Develop & Test

```bash
# Make changes
# Build
npm run build

# Test
npm test

# Lint
npcs --standard=WordPress includes/abilities/my-new-ability.php
```

### 3. Commit

```bash
git add .
git commit -m "Add my-new-ability for X"
```

**Commit message format:**
```
<type>: <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

### 4. Open Pull Request

```bash
git push origin feature/my-new-ability
```

Then open PR on GitHub:
- Describe what the PR does
- Link to related issues
- Add screenshots if UI changes
- Mention if you used AI assistance

See [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) for detailed guidelines.

## Debugging Checklist

When something isn't working, check:

**Model Issues:**
- [ ] WebGPU available? (`'gpu' in navigator`)
- [ ] Model cached? (DevTools → Application → IndexedDB)
- [ ] Sufficient VRAM? (Task Manager → GPU memory)
- [ ] Console errors during load?

**Service Worker Issues:**
- [ ] Service Worker registered? (`navigator.serviceWorker.controller`)
- [ ] Active and running? (DevTools → Application → Service Workers)
- [ ] HTTPS or localhost?
- [ ] Using Chrome/Edge (not Safari)?

**Ability Issues:**
- [ ] Ability registered? (`/wp-json/abilities/v1/list`)
- [ ] Permissions granted? (`current_user_can('manage_options')`)
- [ ] Input schema valid?
- [ ] REST API enabled?

**ReAct Issues:**
- [ ] System prompt includes tools?
- [ ] Tool schemas correct?
- [ ] JSON parsing working? (enable debug logs)
- [ ] Max iterations not exceeded?

**Performance Issues:**
- [ ] Using GPU (not WASM)?
- [ ] Thermal throttling? (laptop plugged in?)
- [ ] Other GPU apps closed?
- [ ] Model size appropriate for hardware?

## Additional Resources

### Documentation

- [Architecture Overview](../ARCHITECTURE.md)
- [Abilities Guide](../ABILITIES-GUIDE.md)
- [Workflows Guide](../WORKFLOWS-GUIDE.md)
- [Testing Guide](../../tests/TESTING.md)
- [Contributing Guide](../../.github/CONTRIBUTING.md)

### External Links

- [WebLLM Documentation](https://github.com/mlc-ai/web-llm)
- [WordPress Abilities API](https://github.com/WordPress/abilities-api)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)

### Community

- [GitHub Discussions](https://github.com/pluginslab/wp-agentic-admin/discussions)
- [Issue Tracker](https://github.com/pluginslab/wp-agentic-admin/issues)

## Summary

Debugging Agentic Admin for WordPress requires familiarity with browser DevTools (Console, Network, Application, Performance tabs), the test hook API for inspecting ReAct execution, and common troubleshooting patterns (model loading, Service Worker state, ability execution). Development workflow involves building assets, testing with unit tests and E2E suites, and following WordPress coding standards. The centralized logging system and performance profiling utilities help diagnose issues and optimize performance.

**End of AI Fundamentals Guide**

---

← [Previous: Tool Selection at Scale](11-tool-selection-at-scale.md) | [Index](INDEX.md)
