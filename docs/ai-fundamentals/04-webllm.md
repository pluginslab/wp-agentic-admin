# WebLLM Library

WebLLM is an open-source JavaScript library that brings large language models to the browser. It's the engine that powers Agentic Admin for WordPress's local AI capabilities.

## What is WebLLM?

WebLLM is a browser runtime for running LLMs entirely client-side using WebGPU. Think of it as "Node.js for AI models in the browser."

**Official Project:**
- **Repository:** https://github.com/mlc-ai/web-llm
- **Maintainer:** MLC-AI (Machine Learning Compilation for AI)
- **License:** Apache 2.0 (open source)

### What WebLLM Provides

1. **Model Loader** — Download and cache models from CDN
2. **WebGPU Backend** — Compiles models to run on your GPU
3. **Inference Engine** — Generate text from prompts
4. **Chat API** — OpenAI-compatible interface for conversations
5. **Service Worker Support** — Keep models loaded across page navigation

## Architecture

WebLLM sits between your JavaScript code and the GPU:

```
Your App (Agentic Admin for WordPress)
        ↓
   WebLLM Library
        ↓
   TVM (Compiler)
        ↓
   WebGPU Shaders
        ↓
   Your GPU Hardware
```

### Key Components

**1. MLC (Machine Learning Compilation)**

WebLLM uses TVM (Tensor Virtual Machine) to compile AI models into optimized WebGPU shaders. This compilation happens once when the model is first loaded.

**2. Model Format**

WebLLM requires models in a specific format:
- **Format:** MLC-compiled weights + configuration
- **Structure:** Split into chunks (~100MB each) for streaming download
- **Storage:** Browser IndexedDB

**3. OpenAI-Compatible API**

WebLLM mimics OpenAI's chat completion API:

```javascript
const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
];

const response = await engine.chat.completions.create({
    messages,
    temperature: 0.6,
});
```

This makes it easy to swap between WebLLM and cloud APIs.

## How Agentic Admin for WordPress Uses WebLLM

### 1. Model Loading

When you first open Agentic Admin:

```javascript
import { CreateMLCEngine } from '@mlc-ai/web-llm';

const engine = await CreateMLCEngine('Qwen2.5-7B-Instruct-q4f16_1-MLC', {
    initProgressCallback: (progress) => {
        console.log(`Loading: ${progress.text}`);
    }
});
```

**What happens:**
1. WebLLM checks browser cache for the model
2. If not cached, downloads from CDN (~4.5GB in chunks)
3. Compiles model to WebGPU shaders
4. Loads weights into VRAM
5. Returns a ready-to-use engine

### 2. Service Worker Persistence

Agentic Admin for WordPress uses WebLLM's Service Worker mode to keep the model loaded:

```javascript
// In Service Worker (sw.js)
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.addEventListener('message', (event) => {
    handler.onmessage(event);
});
```

```javascript
// In main page
import { MLCEngineWorkerProxy } from '@mlc-ai/web-llm';

const engine = await MLCEngineWorkerProxy.Create(
    new Worker('/path/to/sw.js'),
    'Qwen2.5-7B-Instruct-q4f16_1-MLC'
);
```

This keeps the model in memory even when you navigate to different WordPress admin pages. See [Service Worker Persistence](07-service-worker-persistence.md) for details.

### 3. Chat Completions

The ReAct agent uses WebLLM to generate responses:

```javascript
const response = await engine.chat.completions.create({
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'List my plugins' }
    ],
    temperature: 0.6,
    max_tokens: 2048,
});

const text = response.choices[0].message.content;
```

### 4. Streaming Responses

For real-time updates as the model generates text:

```javascript
const stream = await engine.chat.completions.create({
    messages,
    stream: true,
});

for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    updateUI(text);
}
```

Agentic Admin for WordPress uses streaming to show the AI's response as it's generated, not all at once.

## WebLLM vs Alternatives

### WebLLM vs transformers.js

| Feature | WebLLM | transformers.js |
|---------|--------|-----------------|
| **Backend** | WebGPU (TVM shaders) | ONNX Runtime (WebGPU or WASM) |
| **Model Size Support** | Up to 7B+ (limited by VRAM) | Up to ~1.5B reliably |
| **Memory Efficiency** | Excellent (weights directly on GPU) | Limited (WASM heap bottleneck) |
| **Model Format** | MLC-compiled | ONNX |
| **Function Calling** | Via prompt templates | Native (Qwen chat template) |
| **Status in Agentic Admin for WordPress** | **Primary engine** | Experimental (parked) |

**Why WebLLM Won:**

Agentic Admin for WordPress initially explored transformers.js but found that models larger than 1.5B failed during loading due to ONNX Runtime's WASM heap limits. WebLLM bypasses this by compiling weights directly to GPU shaders, avoiding WASM entirely.

See [CLOUDFEST_HACKATHON.md § transformers.js investigation](../../CLOUDFEST_HACKATHON.md#transformersjs--onnx-runtime-as-alternative-engine) for technical details.

## Supported Models

WebLLM maintains a catalog of pre-compiled models:

**Small Models (< 3B):**
- `Qwen2.5-0.5B-Instruct` — Tiny, fast, limited capability
- `Qwen2.5-1.5B-Instruct` — Lightweight, decent for simple tasks
- `Qwen3-1.7B-Instruct` — **Default for Agentic Admin for WordPress** (balanced)

**Medium Models (3B - 7B):**
- `Qwen2.5-3B-Instruct` — Good balance
- `Qwen2.5-7B-Instruct` — **Recommended for Agentic Admin for WordPress** (best accuracy)
- `Llama-3.2-3B-Instruct` — Alternative option

**Large Models (> 7B):**
- `Qwen2.5-14B-Instruct` — Requires 16GB+ VRAM
- `Llama-3.1-8B-Instruct` — Requires 10GB+ VRAM

**Note:** Model availability changes. Check WebLLM's official model list: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts

### Why Qwen Models?

Agentic Admin for WordPress uses Qwen (Alibaba's open-source models) because:

1. **Function Calling Support** — Qwen models natively support tool/function calling via their chat template
2. **Multilingual** — Strong English + other languages
3. **Instruction Following** — Excellent at following system prompts
4. **Open License** — Apache 2.0, commercially usable
5. **Size Options** — Available from 0.5B to 72B parameters

## Performance Characteristics

Inference speed varies by model size and hardware:

| Model | VRAM | M2 MacBook Pro | RTX 3060 | Iris Xe (Integrated) |
|-------|------|----------------|----------|----------------------|
| Qwen 3 1.7B (q4) | ~2GB | 60 tok/s | 80 tok/s | 25 tok/s |
| Qwen 2.5 3B (q4f16) | ~3GB | 50 tok/s | 65 tok/s | 18 tok/s |
| Qwen 2.5 7B (q4f16) | ~5GB | 45 tok/s | 55 tok/s | Not recommended |

**tok/s** = tokens per second (higher is faster)

## Configuration Options

WebLLM exposes several tuning parameters:

### Temperature

```javascript
temperature: 0.6  // 0.0 = deterministic, 1.0+ = creative
```

Agentic Admin for WordPress uses 0.6 for a balance between consistency and natural responses.

### Max Tokens

```javascript
max_tokens: 2048  // Maximum response length
```

Controls how long the model's response can be. Agentic Admin for WordPress uses 2048 tokens (~1500 words).

### Top-P (Nucleus Sampling)

```javascript
top_p: 0.9  // Consider only top 90% probable tokens
```

Another way to control randomness. Agentic Admin for WordPress uses the default (0.9).

### Repetition Penalty

```javascript
repetition_penalty: 1.1  // Discourage repeating tokens
```

Prevents the model from repeating itself. Higher values = stronger penalty.

## Debugging WebLLM

### Enable Verbose Logging

```javascript
const engine = await CreateMLCEngine(modelId, {
    logLevel: 'INFO',  // or 'DEBUG' for more detail
});
```

Logs will appear in the browser console.

### Check Model Loading Progress

```javascript
initProgressCallback: (progress) => {
    console.log(`[${progress.progress}%] ${progress.text}`);
}
```

Shows download and compilation progress.

### Inspect GPU Memory

WebLLM doesn't expose VRAM usage directly, but you can monitor via:
- Chrome DevTools → Performance → Memory
- Task Manager (Windows) → GPU memory
- Activity Monitor (macOS) → GPU History

## Limitations

WebLLM has some constraints:

1. **Model Format** — Only supports pre-compiled MLC models, not arbitrary HuggingFace models
2. **Browser Dependency** — Requires WebGPU-capable browser
3. **VRAM Limits** — Model must fit in available VRAM
4. **Cold Start** — First load takes 5-10 minutes for download + compilation
5. **No GPU Sharing** — One WebLLM instance per Service Worker

## Roadmap

WebLLM is actively developed. Upcoming features:

- **Multi-GPU Support** — Distribute model across multiple GPUs
- **Quantization Formats** — New compression techniques (Q3, Q2)
- **Faster Compilation** — Reduce cold start time
- **Browser Extensions** — Persistent models across browser tabs
- **Model Hot-Swapping** — Switch models without reloading

## Summary

WebLLM is the JavaScript library that enables browser-based LLM inference. It compiles models to WebGPU shaders via TVM, supports OpenAI-compatible APIs, and handles model downloading, caching, and Service Worker persistence. Agentic Admin for WordPress uses WebLLM as its primary engine for running Qwen models locally on the GPU.

**Next:** [Quantization: Making Models Smaller](05-quantization.md)
