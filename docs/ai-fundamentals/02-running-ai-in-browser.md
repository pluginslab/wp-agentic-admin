# Running AI in the Browser

Most AI tools today send your data to cloud servers for processing. Agentic Admin for WordPress takes a different approach: the AI runs entirely in your web browser.

## Traditional Approach: Cloud APIs

When you use ChatGPT, Claude, or similar tools, here's what happens:

```
Your Computer → Internet → Company's Servers → AI Model → Response → Internet → Your Computer
```

**Pros:**
- ✅ Access to massive models (100B+ parameters)
- ✅ Fast processing on powerful server GPUs
- ✅ No hardware requirements on your device

**Cons:**
- ❌ Your data leaves your device
- ❌ Requires internet connection
- ❌ API costs per request
- ❌ Privacy concerns for sensitive data
- ❌ Subject to rate limits and outages

For WordPress admin tasks, this means your site's error logs, plugin lists, database information, and configuration details are sent to third-party servers.

## Browser-Based AI: Local Processing

Agentic Admin for WordPress downloads the AI model once to your browser and runs it locally:

```
Your Computer (Browser → GPU → AI Model → Response)
```

**Pros:**
- ✅ Complete privacy — data never leaves your device
- ✅ No API costs
- ✅ Works offline (after initial model download)
- ✅ No rate limits
- ✅ GDPR compliant by design

**Cons:**
- ❌ Requires modern hardware (GPU with 4-8GB VRAM)
- ❌ Limited to smaller models (1.7B - 7B parameters)
- ❌ One-time download (~1.2GB - 4.5GB)
- ❌ Browser compatibility required (Chrome 113+, Edge 113+)

## Why Browser-Based AI Makes Sense for WordPress

### 1. Privacy-First

WordPress sites often contain sensitive information:
- Debug logs with server paths and configuration details
- Database structure and table names
- Plugin and theme code
- User data (emails, IP addresses)
- Server environment details

With browser-based AI, this information never leaves your device. You're not trusting a third-party AI provider with your site's internals.

### 2. Zero Ongoing Costs

Cloud API pricing adds up:

| Service | Pricing (approximate) |
|---------|----------------------|
| OpenAI GPT-4 | $0.03 per 1K tokens input, $0.06 output |
| Anthropic Claude | $0.015 per 1K tokens input, $0.075 output |
| Google Gemini | $0.001 per 1K tokens |

With 100 diagnostic sessions per month, you could easily spend $50-200/month.

**Agentic Admin for WordPress:** $0/month after the initial model download.

### 3. No Rate Limits

Cloud APIs impose usage limits:
- Requests per minute (RPM)
- Tokens per minute (TPM)
- Daily/monthly caps

During a critical outage, you might hit rate limits when you need AI assistance most. Browser-based AI has no such restrictions.

### 4. Offline Capability

Once the model is downloaded, Agentic Admin for WordPress works without internet:
- Diagnose issues on local development sites
- Work from locations with unreliable connectivity
- No dependency on external service uptime

## The Trade-Off: Hardware Requirements

Running AI in the browser requires a WebGPU-capable GPU and enough VRAM to hold the model. For detailed hardware specs, GPU compatibility, and VRAM requirements, see [Ch. 3 — WebGPU](03-webgpu.md#gpu-requirements).

**Quick summary:** Most modern devices work — Apple M1+, NVIDIA GTX 1000+, Intel Iris Xe, or AMD RDNA. Chrome 113+ or Edge 113+ required.

If your device doesn't support WebGPU, fallback options include WASM CPU mode (slower), external AI providers, or smaller models.

## Download Once, Use Forever

The model download happens once and is cached permanently:

```
First load:  Download 1.2GB → Load into GPU → Ready (5-10 minutes)
Next visit:  Load from cache → Ready (10-30 seconds)
```

The model is stored in your browser's cache (IndexedDB), not re-downloaded on every visit.

### Cache Storage

| Model | Download Size | Cache Location |
|-------|--------------|----------------|
| Qwen 3 1.7B | ~1.2GB | Browser IndexedDB |
| Qwen 2.5 7B | ~4.5GB | Browser IndexedDB |

**Note:** Clearing browser cache will delete the model, requiring a re-download.

## Multi-Tab Support via Service Worker

Browser-based AI has a challenge: when you navigate to a different WordPress admin page, the model is typically unloaded from memory. Agentic Admin for WordPress solves this with [Service Worker persistence](07-service-worker-persistence.md) — the model stays loaded even when you switch pages.

## Security Considerations

Running AI in the browser is safe:

✅ **Sandboxed Environment** — Browser security prevents the model from accessing your file system or other apps  
✅ **No External Communication** — Model doesn't "phone home" or send telemetry  
✅ **WordPress Permissions** — Abilities respect WordPress user capabilities  
✅ **Confirmation Required** — Destructive actions require explicit approval

The AI model is just code running in your browser, no different from any other JavaScript. It has no special privileges beyond what WordPress grants your user account.

## When Cloud APIs Make Sense

Browser-based AI isn't always the best choice:

**Use cloud APIs when:**
- You need massive models (100B+ parameters)
- Your device lacks WebGPU support
- You're on a shared/managed hosting where browser restrictions apply
- You want cutting-edge models (GPT-4, Claude Opus)

**Use browser-based AI when:**
- Privacy is critical
- You want zero ongoing costs
- You have compatible hardware
- You work offline frequently
- You want no rate limits

Agentic Admin for WordPress's Hackathon Goal #3 is to support both modes, giving users choice.

## Summary

Browser-based AI runs the model locally on your GPU, eliminating API costs and privacy concerns. It requires compatible hardware (WebGPU-capable GPU with 4-8GB VRAM) and a one-time model download, but provides complete control over your data. For WordPress administration tasks, this approach offers a compelling balance of privacy, cost, and capability.

**Next:** [WebGPU: The Graphics Card for AI](03-webgpu.md)
