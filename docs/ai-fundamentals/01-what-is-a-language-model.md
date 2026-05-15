# What is a Language Model?

A language model is a type of artificial intelligence designed to understand and generate human language. Think of it as a sophisticated autocomplete system that can predict what words should come next in a sentence.

## How Language Models Work

At their core, language models are trained on massive amounts of text data — books, websites, articles, code, and more. During training, they learn patterns in how language is structured:

- Which words typically follow other words
- How sentences are constructed
- Common phrases and expressions
- Grammar and syntax rules
- Context and meaning relationships

When you give a language model some text (called a "prompt"), it analyzes the input and predicts what should come next, one word (or "token") at a time.

### Example

**Input:** "The capital of France is"  
**Model predicts:** "Paris"

**Input:** "List all my WordPress plugins"  
**Model predicts:** "I'll check your installed plugins using the plugin-list tool..."

## Model Size: The Parameter Count

Language models are measured by their number of **parameters** — the internal values that store learned patterns. More parameters generally mean:

✅ Better understanding of complex questions  
✅ More accurate responses  
✅ Better reasoning capabilities

But also:

❌ Larger file size  
❌ More memory required  
❌ Slower processing

### Common Model Sizes

| Size | Parameters | Use Case | Example |
|------|-----------|----------|---------|
| **Tiny** | 0.5B - 1.7B | Fast, lightweight tasks | Qwen 3 1.7B |
| **Small** | 3B - 7B | General purpose, good balance | Qwen 2.5 7B |
| **Medium** | 13B - 30B | Advanced reasoning | Llama 3.1 30B |
| **Large** | 70B+ | Complex tasks, server-only | GPT-4, Claude |

> **Note:** "B" stands for billion. A 7B model has 7 billion parameters.

## Why Smaller Models Work for WordPress

Agentic Admin for WordPress uses relatively small models (1.7B - 7B parameters) because:

1. **Specific Domain** — WordPress administration is a well-defined problem space. The model doesn't need to know everything about the world, just how to work with WordPress.

2. **Structured Tasks** — Instead of open-ended creative writing, the AI performs specific operations: read logs, flush cache, list plugins. These tasks don't require massive reasoning capacity.

3. **Tool Assistance** — The model doesn't need to memorize WordPress documentation. It uses tools (abilities) to retrieve real data from your site.

4. **Browser Constraints** — Running AI in the browser requires models that fit in available GPU memory (typically 4-8GB).

### Example: Error Diagnosis

A large model like GPT-4 might use its vast knowledge to guess what's wrong.

A small model in Agentic Admin for WordPress:
1. Uses the `error-log-read` tool to get actual error messages
2. Analyzes the concrete data
3. Uses the `plugin-deactivate` tool to fix the issue

The tools compensate for the smaller model's limited knowledge.

## Temperature

**Temperature** controls how random a model's output is. Low values (0.0-0.3) make output deterministic and focused; high values (0.7-1.0+) make it creative and varied. Agentic Admin for WordPress uses **0.6** — reliable enough for structured tool calls, natural enough for human-readable explanations.

## Token Limits

Language models process text in chunks called **tokens** (roughly one token = 0.75 words). Every model has a maximum **context window** — how much text it can consider at once.

| Model | Context Window | Equivalent |
|-------|---------------|------------|
| Qwen 3 1.7B | 32,768 tokens | ~24,000 words |
| Qwen 2.5 7B | 131,072 tokens | ~98,000 words |

### What Fits in Context?

The context window includes:
- System prompt (instructions + available tools)
- Conversation history
- Current user message
- Model's response

When the conversation gets too long, older messages are removed to make room.

## Foundation vs Fine-Tuned Models

- **Foundation Models** — Trained on general text, no specific task focus
- **Instruct Models** — Fine-tuned to follow instructions (what Agentic Admin for WordPress uses)
- **Chat Models** — Optimized for back-and-forth conversations

Agentic Admin for WordPress uses **Qwen 3 1.7B Instruct** and **Qwen 2.5 7B Instruct** — models specifically trained to understand and execute instructions.

## What Language Models Can't Do

Despite their capabilities, language models have limitations:

❌ **No Real-Time Knowledge** — They're trained on data up to a specific date  
❌ **Can't Execute Code** — They generate text, not run programs (tools bridge this gap)  
❌ **No Memory Between Sessions** — Each conversation starts fresh  
❌ **Can't Access External Data** — Unless given tools to retrieve it

This is why Agentic Admin for WordPress pairs the language model with **abilities** — PHP functions that actually interact with WordPress.

## Summary

A language model is a text prediction engine that learns patterns from training data. Agentic Admin for WordPress uses small, instruction-tuned models (1.7B - 7B parameters) that are optimized for structured tasks. The models work best when paired with tools that provide real-time data and execution capabilities.

**Next:** [Running AI in the Browser](02-running-ai-in-browser.md)
