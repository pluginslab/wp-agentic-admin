# WebGPU: The Graphics Card for AI

WebGPU is a modern browser API that gives JavaScript direct access to your computer's graphics card (GPU). While originally designed for 3D graphics and gaming, it's also perfect for running AI models.

## Why GPUs Are Fast for AI

### CPU vs GPU Architecture

**CPU (Central Processing Unit):**
- 4-16 powerful cores
- Optimized for sequential tasks
- Great for general-purpose computing
- One task at a time, very fast

**GPU (Graphics Processing Unit):**
- 100s or 1000s of smaller cores
- Optimized for parallel tasks
- Great for repetitive calculations
- Many tasks simultaneously, slightly slower per task

### AI Workload = Massive Parallelism

Language models process text through millions of matrix multiplications — the same operation repeated over and over with different data. This is exactly what GPUs excel at.

**Example:** Generating one word of output

```
CPU approach:  Calculate 7,000,000 operations one-by-one (slow)
GPU approach:  Calculate 1,000 operations simultaneously across 7,000 cores (fast)
```

**Result:** GPUs are 10-100x faster for AI inference.

## What is WebGPU?

WebGPU is the browser standard that exposes GPU capabilities to web applications. Think of it as a bridge:

```
JavaScript Code → WebGPU API → Your Graphics Card
```

### What WebGPU Provides

1. **Compute Shaders** — Programs that run on the GPU for calculations (not graphics)
2. **Memory Management** — Move data between CPU (RAM) and GPU (VRAM)
3. **Parallel Execution** — Run thousands of operations at once
4. **Cross-Platform** — Works on Windows, macOS, Linux with different GPU vendors

### WebGPU vs WebGL

**WebGL** (older standard):
- Designed for 3D graphics
- Limited compute capabilities
- Awkward for non-graphics tasks

**WebGPU** (modern standard):
- Built for both graphics AND compute
- Native compute shader support
- Better performance for AI workloads

WebGPU is to WebGL what a modern Ferrari is to a 1990s sedan — same purpose (getting you places), but vastly better design.

## Browser Support

WebGPU is a relatively new standard, so browser support is still rolling out:

| Browser | Status | Notes |
|---------|--------|-------|
| **Chrome 113+** | ✅ Fully Supported | Best support, recommended |
| **Edge 113+** | ✅ Fully Supported | Chromium-based, same as Chrome |
| **Firefox 120+** | ⚠️ Experimental | Enable via `dom.webgpu.enabled` flag |
| **Safari 17+** | ⚠️ Partial | No WebGPU in Service Workers |
| **Opera 99+** | ✅ Supported | Chromium-based |

**Recommendation:** Use Chrome or Edge for the best experience.

### Checking WebGPU Availability

You can test if your browser supports WebGPU:

1. Open Chrome/Edge
2. Navigate to `chrome://gpu` (or `edge://gpu`)
3. Look for **"WebGPU"** in the status list
4. Should say "Hardware accelerated"

Or run this in the browser console:

```javascript
if ('gpu' in navigator) {
    console.log('✅ WebGPU is available');
} else {
    console.log('❌ WebGPU is not supported');
}
```

Agentic Admin for WordPress automatically detects WebGPU availability when you load the settings page.

## GPU Requirements

Not all GPUs support WebGPU. Generally, you need:

### Minimum GPU Specs

| GPU Type | Requirement |
|----------|-------------|
| **Integrated** | Intel Iris Xe, AMD Radeon 600M+ |
| **Dedicated (NVIDIA)** | GTX 1000 series (Pascal) or newer |
| **Dedicated (AMD)** | RX 5000 series (RDNA) or newer |
| **Apple Silicon** | M1, M2, M3 (any variant) |

### How Much VRAM Do I Need?

VRAM (Video RAM) is the GPU's memory. AI models need to fit entirely in VRAM:

| Model | Minimum VRAM | Recommended VRAM |
|-------|-------------|------------------|
| Qwen 3 1.7B (q4) | 2GB | 4GB |
| Qwen 2.5 7B (q4f16) | 5GB | 8GB |

**Tip:** Check your VRAM:
- **Windows:** Task Manager → Performance → GPU → Dedicated GPU Memory
- **macOS:** About This Mac → System Report → Graphics/Displays
- **Linux:** `nvidia-smi` (NVIDIA) or `radeontop` (AMD)

### Integrated vs Dedicated GPUs

**Integrated GPUs** (built into CPU):
- ✅ Work with smaller models (1.7B)
- ✅ No extra hardware needed
- ⚠️ Slower inference
- ⚠️ Share system RAM (unified memory)

**Dedicated GPUs** (separate card):
- ✅ Much faster inference
- ✅ More VRAM available
- ✅ Can run larger models (7B+)
- ❌ More expensive hardware

**Apple Silicon** (M1/M2/M3):
- ✅ Unified memory (RAM = VRAM)
- ✅ Excellent performance
- ✅ Energy efficient
- ⚠️ Total memory shared with system

## Memory Management

When you load a model, here's what happens:

```
1. Model downloaded from CDN → Browser cache (IndexedDB)
2. Model loaded from cache → CPU RAM
3. Model transferred → GPU VRAM
4. Inference happens on GPU
```

**Critical:** The model must fit entirely in VRAM. If you run out:
- Browser may crash
- Model fails to load
- Fallback to CPU (much slower)

### Monitoring VRAM Usage

**Chrome DevTools:**
1. Open DevTools (F12)
2. Performance → Memory
3. Check "GPU Memory" while loading model

**System Tools:**
- **Windows:** Task Manager → Performance → GPU
- **macOS:** Activity Monitor → Window → GPU History
- **Linux:** `nvidia-smi` (refresh with `watch`)

## Fallback: CPU Mode (WASM)

If WebGPU isn't available, Agentic Admin for WordPress can fall back to **WASM** (WebAssembly) — running the model on CPU instead of GPU.

**WASM Mode:**
- ✅ Works on any device
- ✅ No GPU required
- ⚠️ 10-50x slower than GPU
- ⚠️ High CPU usage

This mode is useful for:
- Testing on unsupported browsers
- Devices without compatible GPUs
- Fallback during GPU memory pressure

## Performance Comparison

Real-world inference speed (tokens per second):

| Hardware | Model | WebGPU | WASM (CPU) |
|----------|-------|--------|------------|
| M2 MacBook Pro | Qwen 3 1.7B | 60 tok/s | 8 tok/s |
| RTX 3060 (12GB) | Qwen 2.5 7B | 45 tok/s | 3 tok/s |
| Integrated Intel Iris Xe | Qwen 3 1.7B | 25 tok/s | 6 tok/s |

**Takeaway:** WebGPU is dramatically faster. WASM is usable for short interactions but painful for complex conversations.

## WebGPU Security

WebGPU is sandboxed like all browser APIs:

✅ **No File System Access** — Can't read/write your files  
✅ **Same-Origin Policy** — Limited to the current website  
✅ **No Network Access** — Can't make HTTP requests independently  
✅ **Browser Controlled** — User can revoke permissions

The GPU is just used for calculations. It doesn't have special privileges beyond what the browser allows.

## Limitations

WebGPU has some constraints:

**Memory Limits:**
- Browser may limit VRAM allocation (typically 80% of total VRAM)
- Large models may not fit alongside other GPU applications

**Browser Tabs:**
- Multiple tabs using WebGPU compete for VRAM
- Running multiple AI instances can cause out-of-memory errors

**Operating System:**
- Some older GPU drivers don't support WebGPU
- Update your graphics drivers if WebGPU detection fails

**Power/Thermal:**
- GPU inference generates heat and uses power
- Laptops may throttle under sustained load

## Future of WebGPU

WebGPU is actively developed:

**Upcoming improvements:**
- Better VRAM management
- Faster shader compilation
- Broader browser support (Firefox stable, Safari full support)
- More GPU vendors supported

As the standard matures, browser-based AI will become faster and more accessible.

## Summary

WebGPU is a modern browser API that provides GPU access for AI inference. It's dramatically faster than CPU processing (10-100x) but requires compatible hardware (4-8GB VRAM, Chrome 113+). Agentic Admin for WordPress uses WebGPU to run language models locally, with WASM CPU fallback for unsupported devices.

**Next:** [WebLLM Library](04-webllm.md)
