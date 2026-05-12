# Models in Agentic Admin for WordPress

Agentic Admin for WordPress currently supports two language models, with plans to expand model selection during the CloudFest Hackathon.

## Current Models

### Qwen 3 1.7B Instruct (Default)

**Technical specs:**
- Parameters: 1.7 billion
- Quantization: q4f16
- Download size: ~1.2 GB
- VRAM requirement: ~2 GB
- Context window: 32,768 tokens (~24,000 words)

**Performance:**
- Speed: 60+ tokens/sec on M2 MacBook Pro
- Accuracy: Good for structured tasks
- Hardware: Works on integrated GPUs

**Best for:**
- Integrated graphics (Intel Iris Xe, AMD Radeon 680M)
- Laptops with limited VRAM
- Quick responses over maximum accuracy
- Testing and development

**Limitations:**
- Less nuanced reasoning than 7B model
- Occasionally misinterprets complex instructions
- More prone to repetition in long conversations

### Qwen 2.5 7B Instruct (Recommended)

**Technical specs:**
- Parameters: 7 billion
- Quantization: q4f16_1
- Download size: ~4.5 GB
- VRAM requirement: ~5 GB
- Context window: 131,072 tokens (~98,000 words)

**Performance:**
- Speed: 45+ tokens/sec on M2 MacBook Pro
- Accuracy: Excellent for WordPress admin tasks
- Hardware: Requires dedicated GPU or high-end integrated

**Best for:**
- Dedicated GPUs (NVIDIA, AMD)
- High-end laptops (gaming laptops, MacBook Pro M1+)
- Production use
- Complex diagnostic workflows

**Advantages:**
- Better instruction following
- More accurate tool selection
- Longer context window (4x larger)
- Less repetition
- Better error message interpretation

## Why Qwen Models?

Agentic Admin for WordPress uses Qwen (Alibaba's open-source models) for several reasons:

### 1. Function Calling Support

Qwen models natively support function/tool calling through their chat template. This means they can reliably generate structured JSON for tool calls:

```json
{
    "name": "wp-agentic-admin/plugin-list",
    "arguments": {}
}
```

Many other small models struggle with structured output, often producing malformed JSON or missing required fields.

### 2. Instruction Following

Qwen models are fine-tuned specifically for instruction-following tasks. They excel at:
- Following system prompts reliably
- Understanding task constraints
- Staying within defined capabilities
- Declining out-of-scope requests

This is critical for an AI assistant that should only perform WordPress admin tasks, not attempt general conversation.

### 3. Multilingual Capability

While Agentic Admin for WordPress is English-first, Qwen models support:
- English (primary)
- Spanish, French, German, Portuguese
- Chinese, Japanese, Korean
- And many others

This allows future internationalization without changing models.

### 4. Open License

Qwen models use the **Apache 2.0 license** — commercially usable, modification allowed, no restrictions. This means:
- ✅ Free to use in commercial plugins
- ✅ Can be bundled with proprietary software
- ✅ No per-user licensing fees
- ✅ Can modify and redistribute

### 5. Small Model Performance

Qwen's smaller models (1.7B, 3B, 7B) punch above their weight. Qwen 3 1.7B performs comparably to other models at 3B parameters, and Qwen 2.5 7B rivals some 13B models.

## Model Comparison

| Feature | Qwen 3 1.7B | Qwen 2.5 7B |
|---------|-------------|-------------|
| **Download** | ~1.2 GB | ~4.5 GB |
| **VRAM** | ~2 GB | ~5 GB |
| **Speed (M2 MBP)** | 60 tok/s | 45 tok/s |
| **Context Window** | 32K tokens | 131K tokens |
| **Accuracy** | Good | Excellent |
| **Hardware** | Integrated GPU OK | Dedicated GPU recommended |
| **Best For** | Quick tasks, testing | Production, complex workflows |

### Real-World Behavior Differences

**Qwen 3 1.7B:**
```
User: "check for errors and optimize if needed"
AI: [Calls error-log-read]
    [Returns response without checking if optimization is needed]
```

**Qwen 2.5 7B:**
```
User: "check for errors and optimize if needed"
AI: [Calls error-log-read]
    [Sees no critical errors]
    [Calls site-health to check if optimization is needed]
    [Calls db-optimize if tables are fragmented]
    [Provides comprehensive summary]
```

The 7B model better understands conditional logic and multi-step reasoning.

## How to Switch Models

### Current Method (Manual)

In `wp-agentic-admin` settings:

1. Navigate to **Agentic Admin** in WordPress admin
2. Click the **Settings** tab
3. Select model from dropdown:
   - `Qwen3-1.7B-Instruct` (default)
   - `Qwen2.5-7B-Instruct-q4f16_1-MLC` (recommended)
4. Save settings
5. Reload the page

The new model will download on first use (one-time, cached after).

### Upcoming: Model Discovery UI (Hackathon Goal)

The CloudFest Hackathon will add a **Model Discovery** feature:

**Planned capabilities:**
- Browse available WebLLM models
- Filter by VRAM requirements
- See model descriptions and capabilities
- One-click model switching
- Benchmark models against test prompts
- Compare performance metrics

This will make it easy to find the right model for your hardware and use case.

## Model Selection Guide

### Choose Qwen 3 1.7B if:

✅ You have integrated graphics (4GB or less VRAM)  
✅ You want fast responses over maximum accuracy  
✅ You're testing or developing with the plugin  
✅ You primarily use single-tool commands ("list plugins", "flush cache")

### Choose Qwen 2.5 7B if:

✅ You have a dedicated GPU (6GB+ VRAM)  
✅ You need reliable multi-step reasoning  
✅ You're using complex workflows or diagnostics  
✅ You want better accuracy and fewer retries

### Hardware Decision Tree

```
Do you have 6GB+ VRAM?
├─ Yes → Qwen 2.5 7B
└─ No
   └─ Do you have 4GB VRAM?
      ├─ Yes → Qwen 3 1.7B
      └─ No → Use external AI provider (Hackathon Goal #3)
```

## What's Next: Expanded Model Library

The hackathon roadmap includes support for:

**Smaller models:**
- Qwen 2.5 0.5B — Ultra-lightweight (~600MB)
- Qwen 2.5 1.5B — Balance between 0.5B and 1.7B

**Larger models:**
- Qwen 2.5 14B — For high-end GPUs (12GB+ VRAM)
- Qwen 2.5 32B — For workstation-class GPUs (24GB+ VRAM)

**Alternative families:**
- Llama 3.2 3B Instruct
- Llama 3.1 8B Instruct
- Phi-3 Mini (3.8B)

## Model Updates

WebLLM regularly updates their model catalog with:
- Newer model versions (Qwen 4, Llama 4, etc.)
- Better quantization (q3, q2)
- Optimized compilation

Agentic Admin for WordPress will track upstream WebLLM releases and update the model list accordingly. Users can always use the latest compatible models.

## Switching Costs

When you switch models, here's what happens:

**First time using a new model:**
1. Model downloads (~1-5 minutes depending on size)
2. Browser caches the model (IndexedDB)
3. Model loads into VRAM (~10-30 seconds)
4. Ready to use

**Switching back to a previously-used model:**
1. Model already cached
2. Load into VRAM (~10-30 seconds)
3. Ready to use

There's no penalty for trying different models — the downloads are cached permanently.

## Model Storage

Models are stored in your browser's IndexedDB:

**Location:**
- Chrome: `~/.config/google-chrome/Default/IndexedDB/`
- Edge: `~/.config/microsoft-edge/Default/IndexedDB/`
- Safari: `~/Library/Safari/Databases/`

**How to clear:**
1. Open DevTools (F12)
2. Application → Storage → IndexedDB
3. Right-click → "Clear"

Or:
1. Browser Settings → Privacy → Clear browsing data
2. Check "Cached images and files"
3. Clear data

**Note:** Clearing cache will force re-download of models on next use.

## External AI Providers (Coming Soon)

Hackathon Goal #3 will add support for cloud AI providers as an alternative to local models:

**Planned integrations:**
- Google Gemini API
- OpenAI API (GPT-4, GPT-3.5)
- Anthropic Claude API
- WordPress AI Client (official WordPress 7.0+ API)

This gives users choice:
- Local models (privacy, no cost) vs.
- Cloud APIs (no hardware requirements, largest models)

See [CLOUDFEST_HACKATHON.md](../../CLOUDFEST_HACKATHON.md) for details.

## Summary

Agentic Admin for WordPress currently uses Qwen 3 1.7B (default, lightweight) or Qwen 2.5 7B (recommended, better accuracy). Qwen models are chosen for their function calling support, instruction following, open license, and strong performance at small sizes. The CloudFest Hackathon will add a Model Discovery UI and external AI provider support, expanding options for users.

**Next:** [Service Worker Persistence](07-service-worker-persistence.md)
