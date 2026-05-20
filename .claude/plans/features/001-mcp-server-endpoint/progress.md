# 001 — Progress + deviations

## Deviations from plan.md

### No PHPUnit tests (Phase 1, 2, 3, 4)

The plan called for PHPUnit tests under `tests/php/`. The project ships zero PHPUnit infrastructure (composer.json has only WPCS dev deps; `tests/` contains Jest suites only). Adding PHPUnit + a WP test bootstrap is meaningful scope creep for this feature.

**Decision:** Skip PHPUnit. Verification rests on:
- WPCS lint catching obvious mistakes
- Manual smoke tests against the local docker stack documented in Phase 7
- Lightweight script-style PHP harnesses under `tests/php-manual/` only if a class becomes too complex to verify by curl

Revisit if a follow-up feature warrants standing up real PHPUnit.

## Phase progress

- **Phase 0** — branch + plan commit — ✅ done (commit `39b7f98`)
- **Phase 1** — Settings (`agentic_admin_settings` new `mcp` section + `ability_list` sanitizer) — ✅ done (commit `150871c`)
- **Phase 2** — `Ability_Registry` (discovery, filtering, ability→tool mapping) — ✅ done (commit `3e4476c`)
- **Phase 3** — `JsonRpc_Server` (initialize/ping/tools/list/tools/call) — ✅ done (commit `134cb8e`)
- **Phase 4** — `Rest_Endpoint` (POST /wp-agentic-admin/v1/mcp, gated by toggle) — ✅ done (commit `117e3e0`)
- **Phase 5** — Settings UI (React `McpEndpointSection` + admin-only `Settings_Rest`) — ✅ done (commit `2bb8baa`)
- **Phase 6** — docs + version bump 0.12.0 — in progress

## Manual verification log (Phase 7 prep)

End-to-end against the local docker stack at `wp-agentic-admin.local` during phases 4–5:

- ✅ disabled → HTTP 404 on `POST /wp-json/wp-agentic-admin/v1/mcp`
- ✅ enabled, no creds → HTTP 401
- ✅ enabled, app-password Basic → `initialize` returns serverInfo `{ name: "Agentic Admin MCP Server", version: "0.11.0" }`, capabilities `tools.list + tools.call`
- ✅ `tools/list` returns 25 own readonly abilities with correct annotations (readOnlyHint, destructiveHint, idempotentHint)
- ✅ `tools/call wp-agentic-admin__site-health` executes the underlying ability; result wrapped as `{ content: [...], isError: false }`
- ✅ `tools/call` on an unknown tool → JSON-RPC `-32601 Method not found`
- ✅ Settings REST: GET returns current state + third-party catalog (3 entries: `core/get-site-info`, `core/get-user-info`, `core/get-environment-info`)
- ✅ Settings REST POST: enable expose-third + allowlist `core/get-site-info` → next `tools/list` grows from 25 → 26
- ✅ Settings reset via POST → endpoint returns 404 again
- ✅ Jest `npm test` — 96 tests passing, 0 failing
- ✅ PHPCS clean on all new files
