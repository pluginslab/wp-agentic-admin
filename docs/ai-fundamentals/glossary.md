# Glossary

Quick reference for the terms used across the AI Fundamentals chapters. Entries link back to the chapter where each concept is explained in detail.

---

## A

**Ability**
A discrete operation the AI can execute on WordPress — for example, reading error logs or listing plugins. Each ability has an ID, description, input/output schema, execute callback, and permission check. See [Ch. 9](09-tools-and-abilities.md).

**Abilities API**
The WordPress registration system for tools. PHP abilities are registered with `wp_agentic_admin_register_ability()`, JS abilities with `registerAbility()`. See [Ch. 9](09-tools-and-abilities.md).

**Activation (Service Worker)**
The lifecycle phase where a newly installed Service Worker takes control and can start intercepting requests. See [Ch. 7](07-service-worker-persistence.md).

**Agent Pattern**
An AI architecture where the model alternates between reasoning and acting, using tools to gather real information rather than guessing. WP Agentic Admin uses the ReAct variant. See [Ch. 8](08-react-pattern.md).

## B

**Bit-Width**
The number of bits used to store each value in a quantized model. Lower bit-width = smaller model but less precision. Common formats: q4 (4-bit), q3 (3-bit). See [Ch. 5](05-quantization.md).

## C

**Chat Completions**
The OpenAI-compatible API format for conversational inference. WebLLM adopts this format, making it easy to swap between local and cloud models. See [Ch. 4](04-webllm.md).

**Chat Template**
A structured format that models use to encode conversations, system prompts, and function calls into a token sequence the model understands. See [Ch. 6](06-models-in-wp-agentic-admin.md).

**Cold Start**
The initial model load when no cached copy exists — includes downloading weights from the CDN (~1-5 minutes) and compiling shaders (~10-30 seconds). Subsequent loads use the cache. See [Ch. 10](10-performance-optimization.md).

**Compilation (Model)**
The TVM/MLC process that converts quantized model weights into optimized WebGPU shaders that can run on the user's GPU. Takes 10-30 seconds on first load, cached afterward. See [Ch. 4](04-webllm.md).

**Compute Shaders**
WebGPU programs that run general-purpose calculations on the GPU (not graphics rendering). Used for matrix multiplication in neural network inference. See [Ch. 3](03-webgpu.md).

**Confirmation Pattern**
A safety mechanism requiring explicit user approval before the AI executes destructive operations like plugin deactivation or revision cleanup. See [Ch. 9](09-tools-and-abilities.md).

**Context Window**
The maximum number of tokens a model can process in a single request — including system prompt, conversation history, and response. Qwen 3 1.7B: 4,096 tokens (plugin default), Qwen 2.5 7B: 32,768 tokens. See [Ch. 1](01-what-is-a-language-model.md), [Ch. 10](10-performance-optimization.md).

## D

**Destructive Ability**
An operation that may cause data loss or break site functionality (e.g., deactivating a plugin, deleting revisions). Always requires user confirmation before execution. See [Ch. 9](09-tools-and-abilities.md).

## E

**Embedding**
A vector (list of numbers) representing the semantic meaning of text. Used for similarity-based tool selection — similar meanings produce similar vectors. See [Ch. 11](11-tool-selection-at-scale.md).

**Engine (WebLLM)**
The WebLLM inference engine object that manages model lifecycle: loading, compilation, generation, and unloading. See [Ch. 4](04-webllm.md).

## F

**Float16 / Float32**
Floating-point number formats using 16 or 32 bits of precision. Float32 is standard training precision; float16 is a common inference optimization. In quantization names like `q4f16`, the `f16` refers to activation precision. See [Ch. 5](05-quantization.md).

**Function Calling**
An LLM capability where the model generates structured JSON tool invocations instead of plain text. Qwen models have native function calling support, making them well-suited for agentic tasks. See [Ch. 1](01-what-is-a-language-model.md), [Ch. 6](06-models-in-wp-agentic-admin.md).

## G

**GPU (Graphics Processing Unit)**
Hardware optimized for parallel computation. Neural network inference involves massive matrix multiplication that GPUs handle orders of magnitude faster than CPUs. See [Ch. 3](03-webgpu.md).

## I

**Idempotent**
An operation where calling it multiple times has the same effect as calling it once (e.g., flushing cache). Idempotent abilities can safely skip confirmation dialogs. See [Ch. 9](09-tools-and-abilities.md).

**IndexedDB**
A browser API for persistent key-value storage. WebLLM uses IndexedDB to cache downloaded model weights so they survive page reloads and browser restarts. See [Ch. 4](04-webllm.md), [Ch. 10](10-performance-optimization.md).

**Inference**
Using a trained model to generate predictions or responses from input. Distinct from training — inference is read-only and runs on the user's device. See [Ch. 1](01-what-is-a-language-model.md), [Ch. 3](03-webgpu.md).

**Input Schema**
A JSON Schema definition declaring what parameters an ability accepts. Used for validation and to tell the LLM what arguments a tool expects. See [Ch. 9](09-tools-and-abilities.md).

**Instruct Model**
A model fine-tuned to follow instructions rather than just predict text. Instruct models understand directives like "list all plugins" and produce structured responses. See [Ch. 1](01-what-is-a-language-model.md).

**Iteration (ReAct)**
One cycle of the Thought → Action → Observation loop. A simple question may need 1 iteration; complex diagnostics may need 3-5. Maximum is 10. See [Ch. 8](08-react-pattern.md).

## J

**JSON Parser**
The system that extracts structured tool calls from LLM text output. Includes a sanitizer that attempts to fix common formatting issues (missing quotes, trailing commas) before parsing. See [Ch. 8](08-react-pattern.md).

## K

**Keepalive Messages**
Periodic signals sent from the page to the Service Worker to prevent the browser from terminating it due to inactivity. Default interval: 10 seconds. See [Ch. 7](07-service-worker-persistence.md).

**Keyword Matching**
Phase 1 of tool selection: fast, deterministic matching of user message terms against ability keywords. Runs in under 1ms and narrows hundreds of tools to a handful. See [Ch. 11](11-tool-selection-at-scale.md).

## L

**LLM (Large Language Model)**
A neural network trained on massive text data that can generate human-like responses. WP Agentic Admin runs LLMs locally in the browser via WebLLM. See [Ch. 1](01-what-is-a-language-model.md).

## M

**Matrix Multiplication**
The core mathematical operation in neural networks — multiplying large matrices of numbers. GPUs can perform thousands of these operations in parallel, which is why they're essential for fast inference. See [Ch. 3](03-webgpu.md).

**MLC (Machine Learning Compilation)**
The framework used by WebLLM to compile quantized models into optimized WebGPU code. Maintained by the MLC-AI organization alongside TVM. See [Ch. 4](04-webllm.md).

**Mixed Precision**
Using different bit-widths for different parts of a model — for example, 4-bit weights with 16-bit activations (`q4f16`). Balances model size against inference quality. See [Ch. 5](05-quantization.md).

**Model Parameters**
The internal numerical values learned during training. Parameter count indicates model size: 1.7B means 1.7 billion parameters. More parameters generally means better reasoning but larger download and slower inference. See [Ch. 1](01-what-is-a-language-model.md).

## O

**Observation**
The third phase of a ReAct iteration — the tool's result is fed back to the model as context so it can decide what to do next (call another tool, or respond to the user). See [Ch. 8](08-react-pattern.md).

## P

**Page Mode**
Loading the model directly in the page context rather than a Service Worker. Used as a fallback when Service Workers are unavailable (e.g., Safari). The model unloads on page navigation. See [Ch. 7](07-service-worker-persistence.md).

**Permission Callback**
A PHP function that checks whether the current user has the WordPress capabilities required to execute an ability. Runs before the execute callback. See [Ch. 9](09-tools-and-abilities.md).

**Post-Training Quantization**
Applying quantization after a model has been fully trained, rather than during training. This is what WebLLM models use — the original model is trained at full precision, then compressed. See [Ch. 5](05-quantization.md).

## Q

**Quantization**
A compression technique that reduces model size by lowering the numerical precision of weights and activations. A 7B model at full precision (~14 GB) becomes ~4 GB at q4f16. See [Ch. 5](05-quantization.md).

**q4f16 / q4f32**
Quantization format notation: `q<weight-bits>f<activation-bits>`. q4f16 means 4-bit weights with 16-bit activations — the default format used by WP Agentic Admin. q4f32 uses 32-bit activations for higher quality at the cost of size. See [Ch. 5](05-quantization.md).

## R

**ReAct (Reasoning + Acting)**
The agent pattern where the LLM alternates between thinking about what to do and executing tools. Each cycle: Thought (reasoning) → Action (tool call) → Observation (result). See [Ch. 8](08-react-pattern.md).

**REST API**
WordPress's HTTP interface for reading and writing data. Abilities execute via REST API endpoints, allowing the browser-based LLM to interact with the WordPress backend. See [Ch. 9](09-tools-and-abilities.md).

**RLM (Retrieval, LLM, Meta-ability)**
A three-phase approach to tool selection at scale. Phase 1: fast keyword retrieval. Phase 2: LLM reasoning with filtered tools. Phase 3: dynamic meta-ability for discovering additional tools. See [Ch. 11](11-tool-selection-at-scale.md).

## S

**Service Worker**
A browser script that runs in the background, separate from the page. WP Agentic Admin uses a Service Worker to keep the model loaded across page navigations — without it, the model would unload every time you click a link. See [Ch. 7](07-service-worker-persistence.md).

**Shader (WebGPU)**
A program that runs on the GPU. WebLLM compiles model operations into WebGPU compute shaders for hardware-accelerated inference. See [Ch. 3](03-webgpu.md).

**Streaming**
Delivering model output token-by-token as it's generated, rather than waiting for the full response. Provides immediate visual feedback. See [Ch. 10](10-performance-optimization.md).

**System Prompt**
The initial instruction message that defines the AI's behavior, available tools, and response format. Sent at the start of every conversation. See [Ch. 1](01-what-is-a-language-model.md), [Ch. 8](08-react-pattern.md).

## T

**Temperature**
A parameter controlling randomness in model output. Lower values (0.1-0.3) produce more deterministic, focused responses; higher values (0.7-1.0) produce more creative, varied output. Tool-calling tasks use low temperature. See [Ch. 1](01-what-is-a-language-model.md).

**Token**
The basic unit of text that models process — roughly ¾ of a word in English. "WordPress" might be two tokens: "Word" + "Press". Context windows and generation speed are measured in tokens. See [Ch. 1](01-what-is-a-language-model.md).

**Tool**
A function the AI can call to interact with the real world — reading data, executing actions, or querying APIs. In WordPress context, tools are registered as abilities. See [Ch. 9](09-tools-and-abilities.md).

**Tool Description**
A concise text description sent to the LLM so it understands what each tool does and when to use it. Descriptions consume context window tokens, so brevity matters. See [Ch. 9](09-tools-and-abilities.md), [Ch. 11](11-tool-selection-at-scale.md).

**Top-P (Nucleus Sampling)**
A sampling strategy that considers only the most probable next tokens whose cumulative probability exceeds a threshold. `top_p: 0.9` means the model picks from the top 90% probability mass. See [Ch. 1](01-what-is-a-language-model.md).

**TVM (Apache TVM)**
An open-source compiler framework for machine learning. WebLLM uses TVM to compile models into optimized code for different hardware targets including WebGPU. See [Ch. 4](04-webllm.md).

## V

**VRAM (Video RAM)**
Dedicated memory on a graphics card. The entire model must fit in VRAM during inference — Qwen 3 1.7B needs ~1.5 GB, Qwen 2.5 7B needs ~5 GB. Integrated GPUs share system RAM instead. See [Ch. 3](03-webgpu.md).

## W

**Warm Start**
Loading a model that's already cached in IndexedDB or held in a Service Worker. Much faster than a cold start — seconds instead of minutes. See [Ch. 10](10-performance-optimization.md).

**WASM (WebAssembly)**
A binary instruction format that runs near-native speed in browsers. Used as a CPU fallback when WebGPU is unavailable, though 10-50x slower for AI inference. See [Ch. 2](02-running-ai-in-browser.md).

**WebGPU**
A modern browser API providing direct access to the GPU for general-purpose computation. Successor to WebGL, designed for AI/ML workloads. Supported in Chrome 113+ and Edge 113+. See [Ch. 3](03-webgpu.md).

**WebLLM**
An open-source JavaScript library (by MLC-AI) that runs large language models entirely in the browser using WebGPU. Provides an OpenAI-compatible chat API. See [Ch. 4](04-webllm.md).

**Weights**
The learned numerical values inside a neural network that determine its behavior. Downloaded as part of the model and stored in IndexedDB. Quantization compresses weights to reduce size. See [Ch. 1](01-what-is-a-language-model.md), [Ch. 5](05-quantization.md).

**Workflow**
A multi-step sequence of abilities chained together — for example, "Site Cleanup" runs cache flush → revision cleanup → transient flush in order. Supports rollback if a step fails. See [Ch. 9](09-tools-and-abilities.md).
