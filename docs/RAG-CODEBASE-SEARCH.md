# Local In-Browser RAG: Codebase Search

Privacy-first codebase search using local embeddings and vector search — no external APIs, everything runs in the browser.

## Overview

The RAG (Retrieval-Augmented Generation) system lets the LLM answer questions about your site's code by:

1. **Extracting** code from your active theme and plugins (PHP backend)
2. **Embedding** code chunks into vectors using Transformers.js (CPU/WASM)
3. **Storing** vectors in a Voy search index, persisted in IndexedDB
4. **Searching** with semantic similarity when users ask about code

All processing happens locally — no code leaves the browser.

## Architecture

```
User: "find the login function"
  ↓
[code-search ability] → vectorStore.search("login function", topK=3)
  ↓
[Transformers.js] → embed query on CPU/WASM
  ↓
[Voy index] → nearest neighbor search across 1000+ code chunks
  ↓
[Results] → top 3 matching code snippets with file paths + line numbers
  ↓
[LLM] → summarizes results for the user
```

### Components

| Component | Location | Role |
|-----------|----------|------|
| `codebase-extract` | `includes/abilities/codebase-extract.php` | PHP backend: scans files, chunks by function/class boundaries |
| `vector-store` | `src/extensions/services/vector-store.js` | Embedding + indexing + search service (singleton) |
| `codebase-index` | `src/extensions/abilities/codebase-index.js` | Chat ability: triggers extraction + indexing |
| `code-search` | `src/extensions/abilities/code-search.js` | Chat ability: semantic code search |

### Dependencies

| Dependency | How loaded | Size | Purpose |
|------------|-----------|------|---------|
| [Transformers.js v3](https://huggingface.co/docs/transformers.js) | CDN (lazy, on first use) | ~100MB + 23MB model | Text embeddings |
| [voy-search](https://github.com/tantaraio/voy) | Bundled via npm | ~168KB WASM | Vector nearest-neighbor search |
| IndexedDB | Browser native | — | Persist index across sessions |

**Why CDN for Transformers.js?** At ~100MB it would 17x the current 5.8MB bundle. Lazy-loading from CDN means zero cost until RAG is actually used, and the model is cached by the browser after first download.

**Why CPU for embeddings?** The LLM already uses ~1.5GB VRAM via WebGPU. Running embeddings on GPU too would risk OOM. WASM/CPU is slower but avoids contention entirely.

## Usage

### First time: Index your codebase

```
User: "index codebase"
→ Confirms (takes 1-3 minutes)
→ Extracts code from active theme + plugins
→ Downloads embedding model (~23MB, cached after first run)
→ Embeds all code chunks on CPU
→ Saves index to IndexedDB
→ "Indexed 1222 chunks from 45 files"
```

### Search your code

```
User: "search code for authentication"
→ Embeds query, searches Voy index
→ Returns top 3 matching code snippets
→ LLM summarizes the results
```

### The index persists

After indexing once, the Voy index is restored from IndexedDB on page reload. No need to re-index unless your code changes.

To rebuild: say **"reindex the codebase"**.

## PHP Backend: codebase-extract

### What gets scanned

- Active theme (`get_stylesheet_directory()`)
- All active plugins (except wp-agentic-admin itself)

### What gets skipped

- `node_modules`, `vendor`, `build`, `dist`, `.git`, `tests`
- `.min.js`, `.min.css`, `.map`, `.lock` files
- Files larger than 100KB

### Chunking strategy

- **Small files** (< 50 lines): single chunk
- **PHP files**: split by `function`, `class`, `interface`, `trait` boundaries
- **JS files**: split by `function`, `class`, `const`/`let`/`var` + export boundaries
- **Fallback**: 40-line blocks for files with no detectable boundaries

### Pagination

Returns 50 files per page. The JS ability paginates automatically until `has_more` is false.

## Vector Store Service

### Embedding model

- **Model**: `Xenova/all-MiniLM-L6-v2` (~23MB quantized)
- **Device**: `wasm` (CPU-only, avoids GPU contention)
- **Dimensions**: 384-dimensional embeddings
- **Text limit**: 2000 characters per chunk (model context ~512 tokens)

### Indexing

- Processes chunks in batches of 10
- Each chunk embedded as: `{path}:{start_line}-{end_line}\n{content}`
- Progress logged to console: `[VectorStore] Embedded 50/1222 chunks...`

### Persistence

- Serialized Voy index stored in IndexedDB (`wp-agentic-rag-db`)
- Chunk metadata (path, lines, content, type) stored alongside
- Restored automatically on `vectorStore.init()`

## Context Window Budget

With 4096 tokens, RAG results must be concise:

- `interpretResult()`: max 2 snippets, ~400 chars each, total under 800 chars
- `summarize()`: full code previews (up to 500 chars per snippet) for the user UI
- `topK=3`: only 3 results returned per search

## Troubleshooting

### "Codebase not indexed yet"
Run "index codebase" first. The index persists in IndexedDB across sessions.

### Indexing takes forever
First run downloads ~23MB embedding model. Subsequent runs use cached model. Embedding hundreds of chunks on CPU takes 1-3 minutes.

### WASM MIME type warning
```
WebAssembly.instantiateStreaming failed because your server does not serve wasm
with application/wasm MIME type. Falling back to WebAssembly.instantiate.
```
This is harmless — the fallback works fine, just slightly slower. To fix, configure your server to serve `.wasm` files with `application/wasm` MIME type.

### Results aren't relevant
The embedding model works best with natural language queries. Try:
- "find the function that handles payments" (good)
- "where is authentication implemented" (good)
- "wp_insert_post" (less effective — try "find code that creates posts" instead)
