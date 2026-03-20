---
name: new-instruction
description: "Add a new instruction to the progressive disclosure system. Instructions group abilities into domains so the LLM loads tools on demand instead of seeing them all at once. Use this skill when adding a new instruction (e.g., 'content', 'woocommerce', 'seo'), when grouping existing abilities under a new instruction, or when a team member asks how to register their feature as an instruction. Also use when someone says 'add instruction', 'create instruction', 'register instruction', or 'group these abilities'."
argument-hint: "<instruction-id>"
---

# Add New Instruction: $ARGUMENTS

Instructions are domain groupings for abilities. Instead of showing 50+ tools in the system prompt, the LLM sees a compact list of instruction names and calls `load_instruction` to unlock the tools it needs. This keeps the context window small and tool selection accurate.

## How it works

```
User: "write a blog post"
LLM:  {"action": "tool_call", "tool": "load_instruction", "args": {"instruction": "content"}}
      → content tools now visible (create-post, upload-media, list-categories...)
LLM:  {"action": "tool_call", "tool": "wp-agentic-admin/create-post", "args": {...}}
```

## Before starting

Make sure the abilities you want to group already exist. If not, use `/new-ability` first to scaffold them. Each ability can only belong to one instruction.

Check which abilities exist and which are already grouped:

```bash
# See all abilities
ls src/extensions/abilities/

# See current instructions (each .md file = one instruction)
ls src/extensions/instructions/*.md
```

## Steps

### 1. Create the markdown file

Create `src/extensions/instructions/$ARGUMENTS.md` with this format:

```markdown
---
id: $ARGUMENTS
label: Human-Readable Label
description: One-line description the LLM reads to decide if this instruction matches
keywords:
  - keyword1
  - keyword2
  - keyword3
abilities:
  - wp-agentic-admin/ability-one
  - wp-agentic-admin/ability-two
---

Optional context guidance injected into the system prompt when active.
Use this to tell the LLM which tool to try first or how to sequence calls.
```

**Field guide:**

| Field | Purpose | Tips |
|-------|---------|------|
| `id` | Kebab-case identifier. The LLM uses this in `load_instruction` args | Keep it short — `content`, `seo`, `woocommerce` |
| `label` | Human-readable name shown in active instructions section | `Blog & Content`, `WooCommerce`, `SEO` |
| `description` | The LLM reads this to decide if the instruction matches the user's request | Be specific. "Create, edit, and publish blog posts and pages" beats "Content management" |
| `keywords` | Trigger auto-preloading when these appear in the user's message | Include common synonyms. For content: `post, blog, write, publish, draft, article` |
| `abilities` | The ability IDs that belong to this instruction | Must match the IDs from `registerAbility()` calls exactly |
| Body text | Guidance injected when instruction is active (optional) | Tell the LLM the best sequence of tools or edge cases to watch for |

### 2. Register the import

Edit `src/extensions/instructions/index.js` — add two lines:

1. An import at the top with the other imports:
```js
// eslint-disable-next-line import/no-unresolved
import $ARGUMENTSMd from './$ARGUMENTS.md';
```

2. Add the variable to the `instructionFiles` array:
```js
const instructionFiles = [
    pluginsMd,
    // ... existing entries ...
    $ARGUMENTSMd,   // ← add here
];
```

### 3. Add test cases

Edit `tests/abilities/core-abilities.test.js` — add test cases for each way a user might trigger this instruction:

```js
// ── Your instruction name ─────────────────────────────────────
{
    input: 'natural thing a user would say',
    expectTool: 'wp-agentic-admin/ability-one',      // flat mode expectation
    expectInstruction: { id: '$ARGUMENTS' },          // instruction mode expectation
},
{
    input: 'another natural phrasing',
    expectTool: 'wp-agentic-admin/ability-two',
    expectInstruction: { id: '$ARGUMENTS' },
},
```

The test runner auto-loads instruction definitions from the markdown files — no need to update the `instructions` array in the test file.

Aim for 2-3 test cases per instruction. Cover different phrasings a real user would say.

### 4. Lint & test

```bash
# Lint
npx wp-scripts lint-js src/extensions/instructions/index.js

# Unit tests (should still pass)
npm test

# Benchmark both modes
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode flat
npm run test:abilities -- --file tests/abilities/core-abilities.test.js --mode instruction
```

Both modes should hit 100%. If instruction mode fails on your new tests, check:
- Is the `description` specific enough for the LLM to match it?
- Does the test `input` clearly map to this domain and not another?
- Are the `keywords` comprehensive enough?

## Example: Adding a "content" instruction

Say your teammate is building a blog writer with abilities like `create-post`, `list-categories`, and `upload-media`.

**Create `src/extensions/instructions/content.md`:**

```markdown
---
id: content
label: Blog & Content
description: Create, edit, and publish blog posts, pages, and media
keywords:
  - post
  - posts
  - blog
  - write
  - publish
  - draft
  - article
  - page
  - content
  - media
  - image
  - upload
abilities:
  - wp-agentic-admin/create-post
  - wp-agentic-admin/list-categories
  - wp-agentic-admin/upload-media
---

When creating a post, ask for the title and content first. Use list-categories to show available categories before publishing. If the user wants to add an image, use upload-media before create-post.
```

**In `src/extensions/instructions/index.js`, add the import:**

```js
// eslint-disable-next-line import/no-unresolved
import contentMd from './content.md';

const instructionFiles = [
    pluginsMd,
    cacheMd,
    // ...
    contentMd,
];
```

**In `tests/abilities/core-abilities.test.js`, add tests:**

```js
{
    input: 'write a new blog post',
    expectTool: 'wp-agentic-admin/create-post',
    expectInstruction: { id: 'content' },
},
{
    input: 'show me the categories',
    expectTool: 'wp-agentic-admin/list-categories',
    expectInstruction: { id: 'content' },
},
{
    input: 'upload an image for my post',
    expectTool: 'wp-agentic-admin/upload-media',
    expectInstruction: { id: 'content' },
},
```

## Tips for good instructions

- **Description matters most.** The 1.7B LLM reads the description to decide which instruction to load. Make it concrete: "Create, edit, and publish blog posts" beats "Content management".
- **Keep instructions focused.** 2-5 abilities per instruction is ideal. If you have 10+, split into sub-domains.
- **Keywords drive auto-preloading.** The message router uses keywords to preload instructions before the LLM even runs. Include common synonyms.
- **Context guides tool sequencing.** If there's a best order to call tools, say so in the body text.
- **One ability, one instruction.** Each ability should belong to exactly one instruction.
