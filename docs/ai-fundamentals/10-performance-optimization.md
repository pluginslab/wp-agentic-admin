# Performance & Optimization

Running AI models in the browser requires careful attention to performance. This guide covers how Agentic Admin for WordPress optimizes for speed, memory usage, and user experience.

## Performance Metrics

### Key Measurements

**Cold Start** — First time loading the model
- Download: 1-10 minutes (model size dependent)
- Compilation: 10-30 seconds (TVM → WebGPU shaders)
- VRAM allocation: 5-10 seconds
- **Total:** 2-15 minutes (one-time, cached after)

**Warm Start** — Loading from cache
- Model already downloaded
- Load into VRAM: 10-30 seconds
- **Total:** 10-30 seconds

**Inference Speed** — Generating text
- Qwen 3 1.7B: 25-60 tokens/sec (hardware dependent)
- Qwen 2.5 7B: 15-45 tokens/sec
- **Typical response:** 50-200 tokens = 2-10 seconds

**Tool Execution** — Running abilities
- REST API overhead: 50-200ms
- PHP execution: 10-500ms (ability dependent)
- **Total per tool:** 100-700ms

### Realistic User Experience

**First-time user:**
```
1. Open Agentic Admin page         → 2 seconds (page load)
2. Model download starts            → 5-10 minutes (progress bar)
3. Model loads into GPU             → 30 seconds
4. Send message: "list plugins"     → 5 seconds (inference + tool)
5. Response appears                 → Done
```

**Returning user (model cached):**
```
1. Open Agentic Admin page         → 2 seconds
2. Model loads from cache          → 20 seconds
3. Send message: "list plugins"    → 5 seconds
4. Response appears                → Done
```

**With Service Worker persistence:**
```
1. Open Agentic Admin page         → 2 seconds
2. Model already loaded            → Instant (0 seconds)
3. Send message: "list plugins"    → 5 seconds
4. Response appears                → Done
```

## Bottlenecks & Solutions

### 1. Model Download (Cold Start)

**Problem:** 4.5GB download takes 5-10 minutes on slow connections

**Solutions:**

**A. Chunked Streaming**
- WebLLM downloads models in ~100MB chunks
- Allows partial loading + progress feedback
- Browser resumes interrupted downloads automatically

**B. CDN Distribution**
- Models hosted on HuggingFace CDN (global distribution)
- Uses browser's HTTP caching
- No custom download logic needed

**C. Smaller Models**
- Default to Qwen 3 1.7B (~1.2GB) for faster first load
- Offer Qwen 2.5 7B (~4.5GB) as opt-in upgrade
- Future: Qwen 0.5B (~600MB) for ultra-fast setup

**D. Progressive Enhancement**
- Show chat UI immediately (don't block on model)
- Display download progress prominently
- Allow browsing docs/settings while downloading

### 2. VRAM Allocation

**Problem:** Loading 7B model requires ~5GB VRAM, which may not be available

**Solutions:**

**A. Automatic Model Selection**
```javascript
const availableVRAM = await detectVRAM();

if (availableVRAM < 4000) {
    model = 'Qwen3-1.7B-Instruct';  // ~2GB VRAM
} else if (availableVRAM < 8000) {
    model = 'Qwen2.5-7B-Instruct';  // ~5GB VRAM
} else {
    model = 'Qwen2.5-14B-Instruct'; // ~10GB VRAM
}
```

**B. VRAM Monitoring**
- Detect available VRAM before loading
- Show warning if insufficient memory
- Offer fallback options (smaller model, external API)

**C. Memory Pressure Handling**
- Listen for GPU memory errors
- Graceful degradation to WASM CPU mode
- Clear cache and retry with smaller model

### 3. Inference Latency

**Problem:** Small models (1.7B) generate 60 tok/s, but still feel slow for long responses

**Solutions:**

**A. Streaming Responses**
```javascript
const stream = await engine.chat.completions.create({
    messages,
    stream: true,
});

for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    updateUI(text);  // Show text as it generates
}
```

Users see responses immediately, not after full generation.

**B. Response Length Limits**
- Cap `max_tokens` at 2048 (prevents runaway generation)
- Use system prompt to encourage concise responses
- Break long outputs into sections

**C. Temperature Tuning**
- Default: 0.6 (balanced)
- Lower temp (0.3) for faster, more deterministic responses
- Higher temp (0.8) for creative responses (slower, more varied)

### 4. Tool Execution Overhead

**Problem:** Each tool call adds 100-700ms latency (REST API + PHP)

**Solutions:**

**A. Batch Tool Calls (Future)**
- Execute multiple tools in parallel when independent
- Reduce round-trips to server

**B. Client-Side Caching**
- Cache tool results (e.g., plugin-list changes rarely)
- Invalidate on relevant actions (plugin-activate invalidates plugin-list)

**C. Optimize PHP Execution**
- Use WordPress transients for expensive queries
- Avoid redundant database calls
- Lazy-load data (don't fetch everything upfront)

### 5. ReAct Iteration Overhead

**Problem:** Multi-iteration flows take 10-30 seconds (2-5 sec per iteration × 3-5 iterations)

**Solutions:**

**A. Keyword-Based Routing**
```javascript
// User: "list plugins"
// Skip ReAct, go straight to plugin-list tool
if (matchesKeywords(message, ['list', 'plugin'])) {
    return executeAbility('wp-agentic-admin/plugin-list');
}
```

Bypass AI reasoning for simple, unambiguous commands.

**B. Workflows (Pre-Defined Sequences)**
```javascript
// User: "site cleanup"
// Execute: cache-flush → db-optimize → site-health (no AI reasoning)
if (matchesWorkflow(message, 'site-cleanup')) {
    return executeWorkflow('site-cleanup');
}
```

Multi-step tasks with no LLM overhead.

**C. Max Iteration Limits**
- Default: 5 iterations (prevents infinite loops)
- Force response after limit (even if incomplete)
- Users can re-try for additional iterations

**D. Better System Prompts**
- Teach the model to be decisive (not over-think)
- Examples of 1-2 iteration successful flows
- Penalty for unnecessary tool calls

## Browser Optimizations

### 1. WebGPU Shader Compilation Caching

WebGPU compiles models to GPU shaders on first load. These shaders can be cached:

```javascript
// Browser caches compiled shaders automatically
// Subsequent loads skip compilation (10-30s faster)
```

**Current status:** Automatic (no developer action needed)

### 2. IndexedDB Quota Management

Models stored in IndexedDB compete with other website data:

**Default quota:** ~50% of available disk space (browser dependent)

**If quota exceeded:**
- Browser shows permission prompt
- User can grant more space
- Or clear other site data

**Agentic Admin for WordPress strategy:**
- Request persistent storage on first load
- Prevents automatic eviction of model cache

```javascript
if (navigator.storage && navigator.storage.persist) {
    const persisted = await navigator.storage.persist();
    console.log(`Persistent storage ${persisted ? 'granted' : 'denied'}`);
}
```

### 3. Service Worker Lifecycle

Service Workers can be terminated by the browser to save resources:

**Default termination:** 30 seconds of inactivity

**Agentic Admin for WordPress prevention:**
- Periodic keepalive messages from page to SW
- VRAM allocation keeps SW "busy" (browser avoids killing it)
- Event listeners prevent idle termination

**Result:** Service Worker stays active as long as:
- At least one WordPress tab is open
- GPU resources are allocated

### 4. Tab Memory Management

**Problem:** Multiple tabs each loading models = VRAM exhausted

**Solution:** Service Worker shares one model instance across all tabs

```
Without SW:  Tab 1 (5GB) + Tab 2 (5GB) = 10GB VRAM
With SW:     Tab 1, 2, 3 share one instance = 5GB VRAM
```

## Model Optimizations

### 1. Quantization Selection

Choose the right quantization for your hardware:

| Hardware | Model | Quantization | VRAM | Speed |
|----------|-------|--------------|------|-------|
| Integrated GPU (4GB) | Qwen 3 1.7B | q4f16 | ~2GB | 25 tok/s |
| Laptop GPU (6GB) | Qwen 2.5 7B | q4f16_1 | ~5GB | 45 tok/s |
| Desktop GPU (8GB+) | Qwen 2.5 7B | q4f32_1 | ~7GB | 50 tok/s |

Lower quantization = faster, smaller, less accurate
Higher quantization = slower, larger, more accurate

### 2. Context Window Management

Long conversations consume tokens:

```
System prompt:      500 tokens
User message:       50 tokens
AI response:        200 tokens
Observation:        300 tokens
...repeat 5x...     ~3,000 tokens total
```

**Optimization strategies:**

**A. Sliding Window**
- Keep only last N messages in context
- Discard old conversation history
- Preserve system prompt + recent exchanges

**B. Summarization**
- Summarize old messages into condensed form
- Replace 10 messages with 1 summary
- Maintain continuity without full history

**C. Context Pruning**
- Remove redundant observations (duplicate tool results)
- Compress verbose tool outputs
- Keep only essential information

### 3. Temperature & Sampling

Control generation speed vs quality:

| Temperature | Tokens/Sec | Quality | Use Case |
|-------------|-----------|---------|----------|
| 0.0 | Fastest | Deterministic | Structured tasks (tool calls) |
| 0.6 | Fast | Balanced | **Default for Agentic Admin for WordPress** |
| 1.0+ | Slower | Creative | Open-ended responses |

Lower temperature = faster inference (fewer candidate tokens evaluated)

## Network Optimizations

### 1. REST API Response Compression

WordPress REST API supports gzip compression:

```php
add_filter( 'rest_pre_serve_request', function( $served, $result, $request ) {
    header( 'Content-Encoding: gzip' );
    return $served;
}, 10, 3 );
```

**Benefit:** 60-80% reduction in tool response payload size

### 2. Ability Response Trimming

Return only necessary data:

**Bad:**
```php
return array(
    'plugins' => $all_plugins,  // Full plugin data (5KB per plugin)
    'total'   => count( $all_plugins ),
);
```

**Good:**
```php
return array(
    'plugins' => array_map( function( $plugin ) {
        return array(
            'name'    => $plugin['Name'],
            'active'  => $plugin['active'],
        );
    }, $all_plugins ),
    'total' => count( $all_plugins ),
);
```

Only return fields the AI needs.

### 3. Caching Tool Results

Cache expensive operations:

```php
function wp_agentic_admin_execute_site_health( $input ) {
    $cache_key = 'agentic_site_health';
    $cached    = get_transient( $cache_key );
    
    if ( false !== $cached ) {
        return $cached;
    }
    
    $result = perform_expensive_health_check();
    set_transient( $cache_key, $result, 5 * MINUTE_IN_SECONDS );
    
    return $result;
}
```

**Benefit:** 100-500ms saved on repeated calls

## UI/UX Optimizations

### 1. Progressive Loading

Don't block the UI:

```javascript
// Bad: Wait for everything
await loadModel();
await loadAbilities();
showChatUI();

// Good: Show UI immediately
showChatUI();
loadModel().then(ready => updateModelStatus('Ready'));
loadAbilities();
```

### 2. Optimistic UI Updates

Show user actions immediately:

```javascript
// User sends message
addMessageToUI(userMessage);  // Show immediately
showTypingIndicator();

const response = await processMessage(userMessage);
hideTypingIndicator();
addMessageToUI(response);
```

Don't wait for server response to update UI.

### 3. Skeleton Screens

Show placeholders during loading:

```
┌──────────────────────────────┐
│ ▮▮▮▮▮▮▮▮ Loading model...    │
│ ████████████░░░░░░░░░ 67%    │
│                              │
│ Model: Qwen 2.5 7B           │
│ Downloaded: 3.1 / 4.5 GB     │
└──────────────────────────────┘
```

Better than blank screen or spinner alone.

### 4. Debounced Actions

Prevent rapid-fire requests:

```javascript
let debounceTimer;
function sendMessage(message) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        actualSendMessage(message);
    }, 300);  // Wait 300ms after last keystroke
}
```

Useful for auto-suggest, not chat (users expect immediate send).

## Monitoring & Debugging

### 1. Performance Metrics

Expose key metrics for debugging:

```javascript
window.__wpAgenticPerf = {
    modelLoadTime: 28000,        // ms
    averageInferenceTime: 4200,  // ms
    toolExecutionTime: 150,      // ms
    totalIterations: 3,
};
```

### 2. Chrome DevTools Performance

Use built-in profiling:

1. Open DevTools → Performance
2. Click Record
3. Perform action (send message)
4. Stop recording
5. Analyze timeline:
   - Yellow: JavaScript execution
   - Purple: Rendering
   - Green: Painting

Identify bottlenecks visually.

### 3. GPU Memory Profiling

**Chrome DevTools → Performance → Memory:**
- Track VRAM allocation over time
- Identify memory leaks
- See when model loads/unloads

**Task Manager (Windows):**
- Performance → GPU → Dedicated GPU Memory
- Real-time VRAM usage

**Activity Monitor (macOS):**
- Window → GPU History
- Memory pressure graph

## Common Performance Issues

### Issue: Model Takes Forever to Download

**Causes:**
- Slow internet connection
- CDN issues (rare)
- Browser cache corruption

**Solutions:**
- Wait for download to complete (one-time)
- Use smaller model (Qwen 3 1.7B)
- Clear browser cache and retry
- Check HuggingFace CDN status

### Issue: Inference is Very Slow (< 10 tok/s)

**Causes:**
- Model running on CPU (WASM) instead of GPU
- Other GPU applications competing for resources
- Thermal throttling (laptop overheating)

**Solutions:**
- Verify WebGPU is active (check model status)
- Close other GPU applications (games, video editing)
- Ensure laptop is plugged in (not on battery saver)
- Check GPU drivers are up-to-date

### Issue: Browser Crashes or Freezes

**Causes:**
- Out of VRAM (model too large for GPU)
- Out of system RAM
- GPU driver crash

**Solutions:**
- Use smaller model (Qwen 3 1.7B)
- Close other tabs and applications
- Update GPU drivers
- Restart browser

### Issue: Service Worker Doesn't Stay Active

**Causes:**
- Safari (doesn't support WebGPU in SW)
- Browser settings (aggressive power saving)
- Memory pressure (browser kills SW)

**Solutions:**
- Use Chrome or Edge (best support)
- Disable browser power-saving features
- Close unused tabs to free memory
- Check DevTools → Application → Service Workers for errors

## Future Optimizations (Hackathon Goals)

### 1. Tool Selection at Scale (RLM)

Pre-filter tools before sending to AI:

```
50 total tools → Keyword matching → 5 relevant tools → ReAct agent
```

**Benefit:** Reduce context size by 90%, faster reasoning

### 2. Parallel Tool Execution

Run independent tools simultaneously:

```
Sequential:  site-health (1s) → error-log-read (0.5s) = 1.5s
Parallel:    site-health + error-log-read in parallel = 1s
```

**Benefit:** 30-50% faster multi-tool flows

### 3. Model Hot-Swapping

Switch models without reloading page:

```
Currently:  Unload model → Load new model → 30s delay
Future:     Swap in background → Instant switch
```

**Benefit:** Try different models without waiting

### 4. Edge Caching

Cache compiled models on edge CDN:

```
Currently:  Download weights → Compile shaders (30s)
Future:     Download pre-compiled shaders → Skip compilation
```

**Benefit:** 30s faster warm start

## Summary

Performance optimization in Agentic Admin for WordPress focuses on minimizing cold start time (progressive loading, smaller default model), reducing inference latency (streaming responses, temperature tuning), and managing VRAM efficiently (Service Worker persistence, model sharing). Key bottlenecks are model download (5-10 min first time), VRAM allocation (requires 2-5GB), and ReAct iteration overhead (2-5s per iteration). Future optimizations include tool pre-filtering (RLM), parallel execution, and model hot-swapping.

**Next:** [Tool Selection at Scale (RLM Approach)](11-tool-selection-at-scale.md)
