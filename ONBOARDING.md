# Welcome to WP Agentic Admin

Hey, nice to see you here. Before we start building, let me walk you through the project — what it does, how it works, and where you'll be spending your time today.

This guide is split into two parts:
1. **The tour** — everyone reads this together (~15 minutes)
2. **Your role** — find your section, dive in

---

## Part 1: The Tour

### What are we building?

WP Agentic Admin is an AI assistant that lives inside the WordPress admin. You type plain English — "why is my site slow?", "list my plugins", "flush the cache" — and the AI figures out what to do, calls the right WordPress functions, and gives you an answer.

The twist: **everything runs locally in the browser**. No cloud APIs, no API keys, no data leaving the device. The AI model (Qwen 3 1.7B, about 1.2 GB) runs directly on the user's GPU via WebGPU. It's privacy-first by design.

### How it works (the 30-second version)

```
User types a message
       ↓
Message Router picks the right tools (keyword matching)
       ↓
ReAct Agent reasons about the problem (Thought → Action → Observation loop)
       ↓
Abilities execute real WordPress operations via REST API
       ↓
AI summarizes the results and responds
```

The AI doesn't guess — it calls real WordPress functions and works with real data. If it needs more information, it calls another tool and keeps going. This loop is called **ReAct** (Reasoning + Acting).

> Want to see this in detail? Read the [end-to-end walkthrough in Chapter 8](docs/ai-fundamentals/08-react-pattern.md#end-to-end-walkthrough).

### What's an Ability?

An ability is one thing the AI can do — like "read error logs" or "list plugins." Each ability has two halves:

- **PHP backend** (`includes/abilities/`) — registers a REST endpoint that does the actual WordPress work
- **JS frontend** (`src/extensions/abilities/`) — tells the AI when and how to use it (keywords, description, how to summarize results)

We have 14 abilities today. By the end of the hackathon, we want 25+.

> Full details: [Abilities Guide](docs/ABILITIES-GUIDE.md)

### What's a Workflow?

A workflow chains multiple abilities together. "Site Cleanup" runs cache flush → revision cleanup → transient flush in sequence. Workflows can roll back if a step fails.

We have 4 workflows today. We'd love more.

> Full details: [Workflows Guide](docs/WORKFLOWS-GUIDE.md)

### The codebase at a glance

```
wp-agentic-admin/
├── includes/                    ← PHP: plugin core + abilities
│   ├── abilities/               ← One PHP file per ability
│   ├── class-abilities.php      ← Ability registration system
│   └── class-settings.php       ← Settings page
├── src/extensions/              ← JavaScript: chat UI + AI services
│   ├── abilities/               ← One JS file per ability
│   ├── components/              ← React components (ChatContainer, etc.)
│   ├── services/                ← AI engine: ReAct agent, model loader, router
│   ├── workflows/               ← Workflow definitions
│   └── styles/                  ← SCSS styles
├── tests/
│   ├── abilities/               ← Ability tests (run against real LLM via Ollama)
│   └── src/.../services/__tests__/ ← Unit tests (Jest, mocked LLM)
├── docs/                        ← Architecture, guides, AI fundamentals
├── CLOUDFEST_HACKATHON.md       ← Hackathon goals and research notes
└── .claude/                     ← Claude Code skills and project config
```

### The key services (for the curious)

| File | What it does |
|------|-------------|
| `services/react-agent.js` | The ReAct loop — reasons, picks tools, observes results, repeats |
| `services/message-router.js` | Keyword matching to pre-filter abilities |
| `services/model-loader.js` | Loads the AI model (WebLLM + WebGPU) |
| `services/chat-orchestrator.js` | Orchestrates chat sessions, confirmation dialogs, streaming |
| `services/agentic-abilities-api.js` | Registry for abilities and workflows |

### Tech stack

| Layer | Technology |
|-------|-----------|
| AI runtime | [WebLLM](https://github.com/mlc-ai/web-llm) + WebGPU |
| Model | Qwen 3 1.7B (default) or Qwen 2.5 7B |
| Frontend | React via `@wordpress/element` + `@wordpress/scripts` |
| Backend | PHP 8.2+, WordPress 6.9+ REST API |
| Tests | Jest (unit), Ollama (ability tests) |
| Code style | WPCS 3.x (PHP), `@wordpress/eslint-plugin` (JS) |

### Setup

```bash
git clone https://github.com/pluginslab/wp-agentic-admin.git
cd wp-agentic-admin
npm install
npm run build        # or: npm run watch (dev mode)
```

Then copy or symlink the plugin folder into `wp-content/plugins/` and activate it. You need WordPress 6.9+, PHP 8.2+, and Chrome/Edge for WebGPU.

> For ability tests, you'll also need [Ollama](https://ollama.com) with Qwen 3 1.7B: `ollama pull qwen3:1.7b`

### Running tests

```bash
npm test                          # Unit tests (43 tests, <1 second)
npm run test:abilities            # Ability tests (18 tests, ~45s, needs Ollama)
npm run lint:js                   # JS lint
composer lint                     # PHP lint
```

> Full testing guide: [tests/TESTING.md](tests/TESTING.md)

### Hackathon goals

We have two must-haves and three stretch goals:

| # | Goal | Status |
|---|------|--------|
| 1 | **Sidebar UI** — move chat into a persistent sidebar on every wp-admin page | Must-have |
| 2 | **25+ Abilities** — expand from 14 to 25+ covering themes, users, content, security, updates | Must-have |
| 3 | **External AI Providers** — fallback for browsers without WebGPU (Gemini, Chrome AI) | Stretch |
| 4 | **LAN AI Consultation** — connect to a local Ollama/llama.cpp on the network | Stretch |
| 5 | **Advanced Abilities** — file reading, database queries, web search | Stretch |

> Full details with acceptance criteria: [CLOUDFEST_HACKATHON.md](CLOUDFEST_HACKATHON.md)

### How we work together

No one works alone here. Every feature flows through multiple roles in a pipeline:

```
Writer → PHP Dev → JS Dev → LLM Tester → Ship
```

Here's what that looks like in practice:

1. **Writer** defines the use case — what the user would say, what the AI should do, whether it's destructive. This is the spec.
2. **PHP Developer** builds the backend — a REST endpoint in `includes/abilities/` that does the actual WordPress work.
3. **JS Developer** builds the frontend — a file in `src/extensions/abilities/` that tells the AI when and how to use this ability (keywords, description, summarize function).
4. **LLM Tester** writes test cases — natural language prompts that verify the AI picks the right tool.
5. **Build & verify** — `npm run build` and `npm run test:abilities` to confirm everything works end-to-end.

Steps 2 and 3 happen in parallel — PHP and JS devs can work from the same spec simultaneously. The tester can start writing test cases as soon as they know the ability's ID and keywords.

**UX/Design** feeds into steps 1-3 — designing confirmation dialogs, response formatting, and the sidebar layout that JS devs implement.

**AI Enthusiasts** work on the infrastructure that makes the whole pipeline possible — the ReAct agent, the message router, the model loader.

**DevOps** works on the platform — CI/CD, test infrastructure, LAN AI connectivity, and flagging SRE use cases that Writers should spec.

### Where to learn more

| Topic | Document |
|-------|----------|
| How the AI works (from zero) | [AI Fundamentals](docs/ai-fundamentals/INDEX.md) |
| Architecture decisions | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Building abilities | [Abilities Guide](docs/ABILITIES-GUIDE.md) |
| Building workflows | [Workflows Guide](docs/WORKFLOWS-GUIDE.md) |
| Third-party integration | [Third-Party Integration](docs/THIRD-PARTY-INTEGRATION.md) |
| Testing | [Testing Guide](tests/TESTING.md) |
| Designing abilities (for non-coders) | [Ch. 13 — Designing Abilities](docs/ai-fundamentals/13-designing-abilities.md) |
| Terms and definitions | [Glossary](docs/ai-fundamentals/glossary.md) |
| Code of conduct | [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) |

---

## Part 2: Your Role

Find your role below. Each section tells you what you'll build, where the code lives, and how to get started.

---

### PHP Developers

**Your mission:** Build ability backends — the PHP half that does the real WordPress work.

**What you'll do:**
1. Pick an ability from the [must-have list](CLOUDFEST_HACKATHON.md#goal-2-expanded-abilities-must-have) or grab an issue labeled `ability` + `php`
2. Create a PHP file in `includes/abilities/` using `wp_agentic_admin_register_ability()`
3. Coordinate with a JS developer who builds the chat-side counterpart

**Your workspace:**
```
includes/abilities/          ← Your new file goes here
includes/class-abilities.php ← Registration system (you won't edit this)
```

**Start here:** Look at an existing ability to understand the pattern:
- Simple read-only: [`includes/abilities/plugin-list.php`](includes/abilities/plugin-list.php)
- Destructive with confirmation: [`includes/abilities/plugin-deactivate.php`](includes/abilities/plugin-deactivate.php)

**Key things to know:**
- Every ability needs a `permission_callback` (WordPress capabilities check)
- Every ability needs an `input_schema` with a top-level `default` for optional-input abilities
- Read-only abilities use GET, destructive abilities use POST/DELETE
- Return `{ success: bool, message: string, ... }` always
- Test with: `composer lint` (PHP style) and `npm run test:abilities` (after JS dev adds the frontend)

**Read:** [Abilities Guide](docs/ABILITIES-GUIDE.md) — the full API reference with examples.

---

### React/JS Developers

**Your mission:** Two tracks — ability frontends and the sidebar UI.

#### Track A: Ability Frontends

For every new ability, you write the JS file that tells the AI how to use it.

**What you'll do:**
1. Create a JS file in `src/extensions/abilities/` with `registerAbility()`
2. Define: label, description, keywords, execute function, summarize function
3. Register it in `src/extensions/abilities/index.js`

**Start here:** Look at an existing ability:
- Simple: [`src/extensions/abilities/plugin-list.js`](src/extensions/abilities/plugin-list.js)
- With intent parsing: [`src/extensions/abilities/cache-flush.js`](src/extensions/abilities/cache-flush.js)

**Key things to know:**
- `label` and `description` must be **string literals** (not variables) — the test loader extracts them with regex
- Keywords drive tool selection — choose terms users would actually say
- Keep descriptions under 30 words (they go into the LLM's context window every request)
- Lint before committing: `npx wp-scripts lint-js src/extensions/abilities/your-file.js`

#### Track B: Sidebar UI

The biggest React task of the hackathon — moving the chat from a dedicated settings page into a persistent sidebar on every wp-admin page.

**What you'll build:**
- A toggle button (near "Howdy, admin" in the admin bar) that opens/closes the sidebar
- A slide-out panel that renders the chat alongside whatever admin page the user is on
- Responsive behavior on smaller screens
- The Service Worker already keeps the model loaded across navigation — your sidebar just needs to connect to it

**Your workspace:**
```
src/extensions/components/   ← React components
src/extensions/styles/       ← SCSS styles
src/extensions/index.js      ← App entry point
```

**Read:** [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the component structure, [CLOUDFEST_HACKATHON.md Goal 1](CLOUDFEST_HACKATHON.md#goal-1-sidebar-ui-must-have) for acceptance criteria.

---

### AI Enthusiasts

**Your mission:** Make the ReAct agent smarter and more scalable.

**The problem:** The agent currently sends all 14 tool descriptions to the LLM on every request. This works now but won't scale to 30+ abilities — the tool list alone would eat most of the 4,096 token context window.

**What you can work on:**
- **Tool selection at scale** — implement the RLM-inspired pre-filtering (keyword match → top 5 tools → focused ReAct). The architecture is designed in [CLOUDFEST_HACKATHON.md](CLOUDFEST_HACKATHON.md#tool-selection-at-scale) and explained in [Ch. 11](docs/ai-fundamentals/11-tool-selection-at-scale.md)
- **Prompt optimization** — improve the system prompt for better tool selection accuracy with small models
- **External AI provider architecture** (Goal 3) — add support for Google Gemini, Chrome AI, or local Ollama as alternative backends

**Your workspace:**
```
src/extensions/services/react-agent.js       ← The ReAct loop
src/extensions/services/message-router.js    ← Keyword matching / tool pre-filtering
src/extensions/services/chat-orchestrator.js ← Session management, system prompt construction
src/extensions/services/model-loader.js      ← Model lifecycle (WebLLM, Service Worker)
```

**Read:**
- [Ch. 8 — The ReAct Pattern](docs/ai-fundamentals/08-react-pattern.md) (how the agent loop works)
- [Ch. 11 — Tool Selection at Scale](docs/ai-fundamentals/11-tool-selection-at-scale.md) (the scaling problem and proposed solution)
- [Ch. 10 — Performance & Optimization](docs/ai-fundamentals/10-performance-optimization.md)

---

### LLM Testers

**Your mission:** Make sure the AI picks the right tool for the right user message.

**What you'll do:**
1. For every new ability, write test cases in `tests/abilities/core-abilities.test.js`
2. Each test case is a natural language message + the expected ability
3. Run the suite against a local Qwen 3 1.7B via Ollama

**Example test case:**
```javascript
{
    name: 'should select update-check for "are my plugins up to date"',
    message: 'are my plugins up to date?',
    expectedTool: 'update-check',
}
```

**How to run:**
```bash
# First time: install Ollama and pull the model
brew install ollama
ollama pull qwen3:1.7b

# Run tests
npm run test:abilities
```

**Key things to know:**
- Write both obvious prompts ("list plugins") and tricky ones ("everything feels sluggish")
- If a test fails, the fix is usually adding a keyword to the ability's JS file — not changing the agent
- Work in lockstep with PHP/JS devs — when they ship an ability, you ship the test

**Read:**
- [Testing Guide](tests/TESTING.md)
- [Ch. 11 — Testing Tool Selection](docs/ai-fundamentals/11-tool-selection-at-scale.md#testing-tool-selection-for-llm-testers)

---

### UX/Design Contributors

**Your mission:** Make the AI feel trustworthy and natural inside wp-admin.

**What you'll design:**
- **Sidebar interaction** — how the chat panel opens, sits alongside content, behaves on different screen sizes
- **Model loading experience** — a 1.2 GB download needs clear progress, explanation ("this only happens once"), and a satisfying "ready" state
- **Confirmation dialogs** — destructive actions (deactivate plugin, delete revisions) need clear warnings about consequences
- **Chat UX** — scannable responses, follow-up suggestions, error states

**Think about:** The WordPress admin who has never used AI before. They're skeptical, maybe intimidated. Your job is to make their first interaction feel safe and useful.

**Your output:** Mockups, wireframes, CSS, or detailed descriptions that React/JS developers can implement. Figma, pen-and-paper sketches, or direct CSS — whatever works.

**Read:**
- [Ch. 13 — Designing Abilities](docs/ai-fundamentals/13-designing-abilities.md) — interaction patterns, confirmation dialogs, response formatting
- [CLOUDFEST_HACKATHON.md Goal 1](CLOUDFEST_HACKATHON.md#goal-1-sidebar-ui-must-have) — sidebar acceptance criteria

---

### Writers

**Your mission:** Invent new use cases for the AI assistant.

**You don't need to code.** You need to understand what a WordPress admin does every day and ask: "could the AI help with this?"

**What you'll produce:** For each use case, a spec that answers:
1. **What would the user say?** (3-5 natural language variations)
2. **What should the AI do?** (which WordPress data or actions)
3. **What does the response look like?** (sketch the ideal answer)
4. **Is it destructive?** (read-only, safe write, or dangerous)
5. **What could go wrong?** (permissions, errors, edge cases)

Your specs become the blueprints that PHP and JS developers build from.

**Start here:** Look at the [must-have ability list](CLOUDFEST_HACKATHON.md#goal-2-expanded-abilities-must-have) — pick abilities that don't have specs yet and write them.

**Read:**
- [Ch. 13 — Designing Abilities](docs/ai-fundamentals/13-designing-abilities.md) — full guide with templates and examples
- [CLOUDFEST_HACKATHON.md](CLOUDFEST_HACKATHON.md) — all goals and ability lists

---

### DevOps Experts

**Your mission:** Bring the hosting company perspective — what do site admins and support staff deal with daily?

**What you can work on:**
- **Missing abilities** — server health, disk space, update cycles, backup verification, cron issues. If you see an SRE use case we haven't thought of, flag it or build it
- **CI/CD** — GitHub Actions for automated linting and testing on PRs
- **LAN AI (Goal 4)** — connecting to a local Ollama/llama.cpp server on the network so the browser agent can consult a more powerful model
- **WP Playground** — test environment setup for quick ability verification

**Your workspace:**
```
.github/workflows/           ← CI/CD pipelines (create if needed)
includes/abilities/          ← SRE-focused ability backends
tests/                       ← Test infrastructure
```

**Read:**
- [CLOUDFEST_HACKATHON.md Goals 4 & 5](CLOUDFEST_HACKATHON.md#goal-4-lan-ai-consultation-stretch) — LAN AI and advanced abilities
- [Abilities Guide](docs/ABILITIES-GUIDE.md) — if you're building abilities yourself

---

## Logistics

### Branching

```bash
git checkout -b feature/your-thing    # or: ability/theme-list, fix/sidebar-toggle
# work, commit, push
git push origin feature/your-thing
# open a PR against main
```

### Creating issues

Use `/issue` in Claude Code to create well-structured issues interactively, or create them manually on GitHub with the `[Category] slug — description` title format.

### Commit style

Conventional prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`. Keep commits small and descriptive.

### When in doubt

Open an issue, ask in the hackathon channel, or pair with someone. Don't overthink it — ship it.

---

## Let's go

You've seen the project, you know where things live, you've found your role. Pick a task, grab a partner if you want one, and start building. The [issue board](https://github.com/pluginslab/wp-agentic-admin/issues) has labeled tasks ready to go.

Good luck, and have fun.
