# Claude Code — Project Rules

WordPress plugin: privacy-first AI SRE assistant running Qwen 3 1.7B locally via WebLLM + WebGPU. ReAct agent loop for tool selection against the WordPress Abilities API.

## Code Style

### PHP
- **Standard**: WPCS 3.x — lint: `composer lint` / `composer lint:fix`
- PHP 8.2+, WordPress 6.9+. Use typed properties, return types, union types.
- WordPress spacing: `! $var` not `!$var`, `array( 'key' => 'value' )` not `array('key'=>'value')`

### JavaScript
- **Standard**: `@wordpress/eslint-plugin/recommended` + Prettier
- Lint: `npm run lint:js` / `npm run lint:js:fix`
- WordPress spacing: `functionName( arg )` not `functionName(arg)`
- Tabs for indentation. Single quotes. ES modules in `src/`, CommonJS in `tests/`.
- **Always lint new/modified JS files before committing**: `npx wp-scripts lint-js <files>`

## Build & Test

```bash
npm run build                    # Production build → build-extensions/
npm run watch                    # Dev mode

npm test                         # Unit tests (43 tests, <1s)
npm run test:abilities -- --file tests/abilities/core-abilities.test.js  # Ability tests (18 tests, ~45s, Ollama)

composer lint                    # PHP lint
npm run lint:js                  # JS lint
```

- Unit tests: Jest, mock LLM. Files in `src/extensions/services/__tests__/`
- Ability tests: real Qwen 3 1.7B via Ollama. Abilities auto-loaded from `src/extensions/abilities/*.js`
- After modifying services → run unit tests. After modifying abilities → run ability tests.

## Adding a New Ability

Every ability needs BOTH PHP (backend) and JS (chat interface):

1. **PHP**: `includes/abilities/{kebab-case}.php` — use `register_agentic_ability()`. Must include `permission_callback` and `input_schema` with top-level `default` for optional-input abilities (GET requests fail without it). Return `{ success: bool, message: string, ... }`.
2. **JS**: `src/extensions/abilities/{kebab-case}.js` — use `registerAbility( 'agentic-admin/{id}', { label, description, keywords, execute, summarize, interpretResult, ... } )`. Keep `label` and `description` as **string literals** (test loader extracts via regex).
3. **Register**: import and call in `src/extensions/abilities/index.js`
4. **Tests**: ability auto-appears. Add test cases to `tests/abilities/core-abilities.test.js`

No router or ReAct agent changes needed — keywords auto-register.

**Core WordPress abilities** (e.g., `core/get-site-info`): JS file only, no PHP needed.

See [Abilities Guide](docs/ABILITIES-GUIDE.md) for `parseIntent()`, confirmation patterns, shared helpers, and annotations.

## Version Bumping

Update ALL of these:
1. `agentic-admin.php` — header `Version:`, `AGENTIC_ADMIN_VERSION` constant, `activate()` hook
2. `package.json` — `version` field
3. `readme.txt` — `Stable tag:` + changelog entry
4. `npm install --package-lock-only` to sync `package-lock.json`

## Constraints

- **Context window**: 8192 tokens (1.7B) / 32768 (7B), 8192 default. Source of truth is `MODEL_CONTEXT_SIZES` in `model-loader.js`; override per model via the `agentic_admin_context_size` localStorage key. Tool descriptions sent every request — keep them concise.
- **Tool results truncated** to `maxToolResultLength` (3000 chars) before sending to LLM. Abilities with `preferSummarize: true` bypass this entirely.
- **Max 10 ReAct iterations**. Repeated tool call detection stops oscillation.
- **Service Worker** (`sw.js`) must be self-contained — no code splitting, no dynamic imports.

## Things to Avoid

- Don't import `@wordpress/*` in test files — webpack externals, unavailable in Node
- Don't use `import`/`export` in `tests/` — Node runs CommonJS
- Don't use variables/templates for ability `label`/`description` — test loader uses regex
- Don't skip `input_schema.default` in PHP abilities with optional input
- Don't modify `sw.js` without testing in a real browser
- Don't skip linting — WPCS and eslint catch real issues

## Further Reading

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — ReAct loop, routing, thinking mode, workflows
- [Abilities Guide](docs/ABILITIES-GUIDE.md) — full registration API, parseIntent, shared helpers
- [Workflows Guide](docs/WORKFLOWS-GUIDE.md) — workflow steps, includeIf, mapParams, summarize
- [Testing Guide](tests/TESTING.md) — unit, ability, and E2E test details
