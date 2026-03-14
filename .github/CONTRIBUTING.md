# Contributing to WP Agentic Admin

Welcome, hackathon contributor! This is a quick-start guide to get you up and running.

> Full contribution guidelines are in `.github/templates-full/` for post-hackathon use.

## Quick Setup

1. **Fork & clone** the repo
2. `npm install`
3. `npm run start` (watch mode) or `npx wp-scripts build`
4. Copy/symlink the plugin into `wp-content/plugins/wp-agentic-admin/`
5. Activate in WordPress admin

### Requirements

- WordPress 6.9+ / PHP 8.2+ / Node 18+
- Chrome or Edge with WebGPU support

## What Can I Work On?

- **New abilities** — atomic WordPress operations in `includes/abilities/` + `src/extensions/abilities/`
- **New workflows** — multi-step sequences in `src/extensions/workflows/`
- **ReAct agent improvements** — `src/extensions/services/react-agent.js`
- **UI/UX** — React components in `src/extensions/components/`
- **Documentation** — `docs/`

## Branch & PR

```bash
git checkout -b feature/your-thing
# hack hack hack
git push origin feature/your-thing
# open PR against main
```

Keep commits small and descriptive. Conventional commit prefixes welcome: `feat:`, `fix:`, `docs:`, `refactor:`.

## Running Tests

```bash
npx wp-scripts build                    # build
npx wp-scripts test-unit-js --no-coverage  # unit tests (43 tests)
```

## Code Style

Follow WordPress coding standards (spaces inside parentheses, tabs for indentation). The `.editorconfig` and `.eslintrc.js` handle most of it.

## Questions?

Open an issue or ask in the hackathon channel. Don't overthink it — ship it!
