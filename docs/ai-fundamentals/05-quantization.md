# Quantization: Making Models Smaller

Quantization is a compression technique that makes AI models smaller and faster by reducing the precision of their numbers. It's the key to fitting large language models into browser memory.

## The Problem: Models Are Huge

Language models store billions of parameters (weights) — the numbers that define how the model works. Each parameter is typically stored as a **32-bit floating-point number** (float32):

| Model | Parameters | Full Precision (float32) | Storage Size |
|-------|-----------|-------------------------|--------------|
| Qwen 3 1.7B | 1.7 billion | 32 bits × 1.7B | ~6.8 GB |
| Qwen 2.5 7B | 7 billion | 32 bits × 7B | ~28 GB |

28GB won't fit in most GPUs (consumer GPUs have 4-12GB VRAM). Even downloading 28GB to your browser is impractical.

**Solution:** Use fewer bits per parameter.

## How Quantization Works

Quantization reduces numerical precision. Instead of storing each weight as a high-precision float32 (32 bits), store it with fewer bits.

### Precision Levels

| Format | Bits per Parameter | Range | Use Case |
|--------|-------------------|-------|----------|
| **float32 (f32)** | 32 bits | Full precision | Training, research |
| **float16 (f16)** | 16 bits | Half precision | Inference on powerful GPUs |
| **int8** | 8 bits | Integer only | Mobile devices |
| **int4 (q4)** | 4 bits | Very limited | Browser, edge devices |

**Example:**

```
Original weight:     3.14159265359  (float32, 32 bits)
Quantized (float16): 3.14159        (16 bits)
Quantized (int8):    3              (8 bits)
Quantized (int4):    3              (4 bits)
```

The quantized versions are less precise but take up dramatically less space.

## Size Reduction

Going from float32 to 4-bit quantization:

| Model | float32 (Full) | q4f16 (Quantized) | Reduction |
|-------|----------------|-------------------|-----------|
| Qwen 3 1.7B | ~6.8 GB | ~1.2 GB | 82% smaller |
| Qwen 2.5 7B | ~28 GB | ~4.5 GB | 84% smaller |

This is how Agentic Admin for WordPress fits a 7-billion parameter model into 4.5GB.

## Quantization Formats in WebLLM

WebLLM uses hybrid quantization schemes that mix different precisions:

### Common Formats

**q4f16_1** — 4-bit weights, 16-bit activations, variant 1
- Most weights: 4 bits
- Activations (intermediate calculations): 16 bits
- Best balance for browser usage
- **Used by:** Qwen 2.5 7B in Agentic Admin for WordPress

**q4f32_1** — 4-bit weights, 32-bit activations
- Weights: 4 bits (smaller)
- Activations: 32 bits (more accurate)
- Slightly larger than q4f16 but more precise

**q0f16** — No quantization, 16-bit everywhere
- Less compression but higher quality
- Rare in WebLLM (too large for most browsers)

**q0f32** — Full precision
- No compression at all
- Only for research/training

### Format Naming Convention

WebLLM format names follow this pattern:

```
q<weight_bits>f<activation_bits>_<variant>
```

Examples:
- `q4f16_1` → 4-bit weights, 16-bit activations, variant 1
- `q4f32_1` → 4-bit weights, 32-bit activations, variant 1
- `q0f16` → 16-bit weights, 16-bit activations

The `_1` suffix indicates a specific quantization strategy variant (different models may have multiple q4f16 versions optimized differently).

## Trade-Offs

Quantization is not free — you trade accuracy for size:

| Quantization | Model Size | Accuracy | Speed | Memory |
|-------------|-----------|----------|-------|--------|
| **float32** | Huge | 100% | Slow | Very high |
| **float16** | Large | ~99% | Fast | High |
| **q4f16** | Small | ~95% | Very fast | Low |
| **q4f32** | Medium | ~96% | Fast | Medium |

### What "95% Accuracy" Means

The model is slightly less precise:
- May occasionally choose a suboptimal word
- Slightly more prone to repetition
- Less nuanced understanding of complex instructions

For WordPress administration tasks (structured, tool-based), this loss is acceptable. The model still:
- ✅ Correctly identifies which tool to use
- ✅ Parses error messages accurately
- ✅ Follows system prompts reliably

You're trading poetic language quality for browser compatibility — a good trade for SRE tasks.

## Which Quantization Should You Use?

### For Agentic Admin for WordPress

**Qwen 3 1.7B (q4f16)** — Default
- Download: ~1.2 GB
- VRAM: ~2 GB
- Speed: Very fast
- Best for: Integrated GPUs, quick responses

**Qwen 2.5 7B (q4f16_1)** — Recommended
- Download: ~4.5 GB
- VRAM: ~5 GB
- Speed: Fast
- Best for: Dedicated GPUs, better accuracy

**Qwen 2.5 7B (q4f32_1)** — High Quality
- Download: ~6 GB
- VRAM: ~7 GB
- Speed: Medium
- Best for: High-end GPUs, maximum accuracy

### Decision Matrix

| Your Hardware | Recommended Model |
|---------------|-------------------|
| Integrated GPU (4GB VRAM) | Qwen 3 1.7B (q4f16) |
| Laptop GPU (6GB VRAM) | Qwen 2.5 7B (q4f16_1) |
| Desktop GPU (8GB+ VRAM) | Qwen 2.5 7B (q4f32_1) |
| High-end GPU (12GB+ VRAM) | Qwen 2.5 14B (q4f16_1) |

## How Quantization Happens

Quantization is done **before** the model is deployed. WebLLM downloads pre-quantized models — your browser doesn't do the quantization.

### The Process

1. **Training** — Model trained at full float32 precision
2. **Post-Training Quantization** — Model converted to q4f16 using calibration data
3. **Compilation** — Quantized model compiled to MLC format for WebGPU
4. **Distribution** — Pre-quantized model hosted on CDN
5. **Your Browser** — Downloads the already-quantized model

This means:
- No quality loss during your usage (it's pre-baked)
- No additional processing needed on your device
- Consistent behavior across all users

## Quantization vs Pruning

These are different compression techniques:

**Quantization:**
- Reduces precision of numbers
- All parameters retained
- Model structure unchanged

**Pruning:**
- Removes unimportant parameters entirely
- Fewer total parameters
- Model structure simplified

WebLLM uses quantization, not pruning. Pruning is less common in browser-based AI because it requires model retraining.

## Dynamic Quantization

Some frameworks support **dynamic quantization** — quantizing on-the-fly during inference. WebLLM does **static quantization** — the model is quantized once, before distribution.

**Why static?**
- Faster inference (no runtime conversion)
- Predictable memory usage
- Simpler implementation

## Checking Your Model's Quantization

You can see which quantization format your model uses:

1. Check the model name: `Qwen2.5-7B-Instruct-q4f16_1-MLC`
   - `q4f16_1` → quantization format
2. Check download size: ~4.5GB for q4f16_1 7B models
3. Check VRAM usage: 4-bit models use ~0.65 bytes per parameter

**Formula:**
```
VRAM (GB) ≈ (Parameters in billions × 0.65) + 0.5GB overhead
```

Example:
```
Qwen 2.5 7B (q4f16_1):
7B × 0.65 = 4.55GB + 0.5GB = ~5GB VRAM
```

## Advanced: Mixed Precision

Some quantization schemes use **mixed precision** — different layers use different bit widths:

- Attention layers: 16-bit (precision-critical)
- Feed-forward layers: 4-bit (less sensitive)
- Embeddings: 8-bit (moderate precision)

This optimizes the accuracy-to-size ratio by preserving precision where it matters most.

WebLLM's q4f16 variants use mixed precision strategies, though the exact distribution is internal to the compiled model.

## Summary

Quantization reduces model size by lowering numerical precision. Agentic Admin for WordPress uses q4f16 quantization to fit 7-billion parameter models into ~4.5GB, making browser-based AI practical. The trade-off is slight accuracy loss (~5%), which is acceptable for structured WordPress tasks. Models are pre-quantized and distributed via CDN — your browser downloads the compressed version directly.

**Next:** [Models in Agentic Admin for WordPress](06-models-in-wp-agentic-admin.md)
