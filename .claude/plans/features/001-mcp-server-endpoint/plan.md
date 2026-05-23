# 001 — Plan: MCP Server Endpoint (v0.12.0)

Branch: `feat/001-mcp-server-endpoint` (cut from `dev`)

## Phase 0 — Branch + scaffolding

- [ ] `git checkout dev && git pull && git checkout -b feat/001-mcp-server-endpoint`
- [ ] Commit this `spec.md` + `plan.md` as the first commit on the branch

## Phase 1 — Settings (no UI yet; wire defaults + sanitization)

Files:
- `includes/class-settings.php` — extend `get_settings_config()` with an `mcp` section:
  - `agentic_admin_mcp_enabled` (checkbox, default 0)
  - `agentic_admin_mcp_expose_own` (checkbox, default 1)
  - `agentic_admin_mcp_expose_third` (checkbox, default 0)
  - `agentic_admin_mcp_allowlist` (array of ability IDs, default [])
- `includes/class-settings.php` — extend `update_field()` to handle the array type (`mcp_allowlist`) with sanitization: each entry must match the ability ID regex `^[a-z0-9-]+\/[a-z0-9-]+$` (mirroring `agentic_admin_register_ability`'s validation). Drop anything that fails.

Tests:
- `tests/php/SettingsMcpTest.php` (PHPUnit): defaults are correct; sanitizing the allowlist rejects bogus IDs; setters round-trip through `update_option`.

## Phase 2 — Ability discovery + filtering

New file: `includes/mcp/class-ability-registry.php`
- Namespace: `WPAgenticAdmin\MCP`
- Class: `Ability_Registry`
- Responsibilities:
  - `get_exposed_abilities(): array` — returns the abilities currently exposed via MCP given the current settings
  - Pull our own abilities from `agentic_admin_get_abilities()` (returns global `$agentic_admin_abilities`)
  - Pull third-party abilities from the WordPress Abilities API directly. Look up the WP 6.9 API surface at implementation time — likely `wp_get_abilities()` or an analog. Filter out anything with ID prefix `wp-agentic-admin/` (those are ours).
  - Apply v1 read-only filter: only include abilities where `meta.annotations.readonly === true`
  - Apply settings: if `mcp_expose_own` → include our set; if `mcp_expose_third` → intersect third-party set with `mcp_allowlist`
  - Return an associative array keyed by ability ID, value = the registered ability metadata
- `to_mcp_tool( string $ability_id ): array` — produce the MCP tool descriptor (name with `/` → `__`, label → annotations.title, description, inputSchema, annotations)
- `resolve_tool_name( string $tool_name ): ?string` — reverse map MCP `name` back to ability ID (or null if unknown / not exposed)
- `source_plugin( string $ability_id ): string` — best-effort source attribution for the settings UI: for our own abilities return "Agentic Admin"; for third-party, parse the namespace prefix from the ID, fall back to "Unknown".

Tests:
- `tests/php/AbilityRegistryTest.php`: builds a stub registry, asserts filtering behavior under each settings combination; asserts read-only filter excludes destructive abilities; asserts name round-tripping.

## Phase 3 — MCP JSON-RPC server (no HTTP yet)

New file: `includes/mcp/class-jsonrpc-server.php`
- Namespace: `WPAgenticAdmin\MCP`
- Class: `JsonRpc_Server`
- Constructor takes an `Ability_Registry`
- Public method: `handle( array $request ): array` — dispatches by `$request['method']`
- Methods:
  - `initialize` → returns `{ protocolVersion, serverInfo: { name, version }, capabilities: { tools: { list: true, call: true } } }`
  - `ping` → returns `{}` per MCP spec
  - `tools/list` → enumerate `Ability_Registry::get_exposed_abilities()`, map via `to_mcp_tool()`, return `{ tools: [...] }`
  - `tools/call` → resolve name → ability ID; if null → JSON-RPC `-32601`; else run ability's `permission_callback` (if false → `-32001` Permission denied); else invoke `execute_callback($input)`; wrap result as `{ content: [{ type: "text", text: wp_json_encode($result) }] }`
  - Any other method → `-32601`
- Helpers for valid JSON-RPC error envelopes (`-32600` invalid request, `-32602` invalid params, `-32603` internal error)
- Catch exceptions in `execute_callback` and return `-32603` with a sanitized message (do not leak stack traces)

Tests:
- `tests/php/JsonRpcServerTest.php`: covers each method, error cases, permission_callback false, execute exception path, result wrapping.

## Phase 4 — REST route registration

New file: `includes/mcp/class-rest-endpoint.php`
- Namespace: `WPAgenticAdmin\MCP`
- Class: `Rest_Endpoint`
- Static `init()` adds `rest_api_init` action conditional on `Settings::get_field('agentic_admin_mcp_enabled')`
  - If disabled → don't register the route at all (acceptance criterion #1)
- `register_routes()` registers `POST /wp-agentic-admin/v1/mcp`:
  - `methods` => 'POST'
  - `callback` => static `handle_request()`
  - `permission_callback` => returns true only if `is_user_logged_in()`; on false WP returns 401 automatically via app-password flow
  - No `args` schema — we validate JSON-RPC payload manually
- `handle_request()`:
  - Parse JSON body from `WP_REST_Request::get_json_params()`; on parse failure → JSON-RPC `-32700` Parse error
  - Build `Ability_Registry` + `JsonRpc_Server` and call `handle($payload)`
  - Return `WP_REST_Response` with status 200, JSON-encoded JSON-RPC result/error envelope
- Wire-up in main plugin file: add `require_once` for the three new files and call `\WPAgenticAdmin\MCP\Rest_Endpoint::init();` from `WPAgenticAdmin::init()` (positioned near `LLM_Proxy::init();`)

Tests:
- `tests/php/RestEndpointTest.php`: route only registers when enabled; 401 unauthenticated; integration test calling `initialize` and `tools/list` via `rest_do_request()`.

## Phase 5 — Settings page UI

Files:
- `includes/class-admin-page.php` — add a new "MCP" panel rendering the new settings section
  - Read-only display of the endpoint URL: `get_rest_url(null, 'wp-agentic-admin/v1/mcp')`
  - Copy-to-clipboard button (reuse any existing JS pattern in `src/`)
  - Allowlist UI rendered from `Ability_Registry`-driven discovery:
    - Iterate the Abilities API, group by source plugin (use `Ability_Registry::source_plugin()`)
    - Each row: `<label><input type="checkbox" name="agentic_admin_mcp_allowlist[]" value="<ability_id>"> <ability label> — from <source plugin></label>`
    - Disable + tooltip for non-readonly entries in v1
    - Show empty-state message if no third-party abilities exist
  - Conditionally hide the allowlist section via JS when "Other plugins' …" is unchecked (progressive enhancement; server still respects the toggle)

Tests:
- Manual UI test plan documented in `progress.md` (no JS unit test added in v1)

## Phase 6 — Documentation + version bump

- [ ] `wp-agentic-admin.php`: bump header `Version:` → `0.12.0`, `WP_AGENTIC_ADMIN_VERSION` constant → `'0.12.0'`, `activate()` hook string → `'0.12.0'`
- [ ] `package.json`: `"version": "0.12.0"`
- [ ] `npm install --package-lock-only` to refresh `package-lock.json`
- [ ] `readme.txt`: bump `Stable tag:` to `0.12.0`, add changelog entry under `== Changelog ==`
- [ ] `.release-notes/0.12.0.md`: new file summarizing the MCP endpoint, settings, security notes, opt-in default
- [ ] `docs/MCP-ENDPOINT.md`: new page covering — purpose, how to enable, how to create an app password, example curl session (initialize → tools/list → tools/call), security guidance, what's out of scope in v1, coexistence note with Automattic's wordpress-mcp
- [ ] `README.md`: add a short "Optional: MCP endpoint" section linking to `docs/MCP-ENDPOINT.md`
- [ ] `CLAUDE.md` (project): add the new MCP endpoint to "Further Reading" and to "Adding a New Ability" (mention that abilities with `annotations.readonly = true` will appear in MCP tool lists when the endpoint is enabled)

## Phase 7 — Quality + manual verification

- [ ] `composer lint` — must pass (WPCS 3.x)
- [ ] `npm run lint:js` — must pass
- [ ] `npm test` — Jest unit tests still pass
- [ ] PHPUnit: `composer test` or equivalent — new tests + no regressions
- [ ] Manual smoke against the local docker stack at `wp-agentic-admin.local`:
  - With endpoint disabled → 404 on the route
  - Enable endpoint, no app password → 401
  - Create app password → `initialize` succeeds
  - `tools/list` reflects current settings (own only vs own + selected third-party)
  - `tools/call` on a known read-only ability returns expected result
  - Permission check: drop `marcel` to editor role temporarily, repeat `tools/call` on a `manage_options`-gated ability → JSON-RPC `-32001`
  - Browser-side ReAct loop, LLM proxy, admin pages continue to work
- [ ] Update `progress.md` with manual test results

## Phase 8 — Ship

- [ ] Open PR `feat/001-mcp-server-endpoint` → `dev` with the PR template
- [ ] Request `security-reviewer` sub-agent review on the diff
- [ ] After merge → eventual merge to `main` triggers release build of `wp-agentic-admin.zip` (existing pipeline)
- [ ] Archive `.claude/plans/features/001-mcp-server-endpoint/` to `.claude/plans/archive/2026-05-NN-mcp-server-endpoint/` after merge

## Freeze assessment

Per the wordpress-feature skill: any "yes" answer below indicates the plan should be frozen for human review before implementation starts.

- [ ] New auth model / new credential surface introduced? → **YES** (app-password Basic auth on a new MCP endpoint that can invoke arbitrary registered abilities is a new auth surface for this plugin, even though WP core handles the actual credential check)
- [ ] Cross-plugin coupling (depends on or extends another plugin)? → **NO** (we deliberately do not depend on Automattic's wordpress-mcp; Abilities API is WP core)
- [ ] Wire-protocol implementation that must conform to an external spec? → **YES** (JSON-RPC 2.0 + MCP `2025-03-26`)
- [ ] User-facing default that changes the plugin's security/privacy posture? → **NO** (master toggle defaults off; headline preserved)
- [ ] Affects code that other features depend on (settings store, abilities registry)? → **YES** (extends `Settings` and reads from the abilities registry — additive, but visible everywhere)
- [ ] Estimated diff > ~600 LOC? → **YES** (roughly 700–1000 LOC including tests + UI + docs)

**Recommendation: FREEZE.** Three of six checks are yes, and two of them (new auth surface, wire protocol conformance) are exactly the categories where surprising mistakes are expensive. Surface the spec + plan to the user for explicit review/sign-off before any production code lands.

## Open questions for review

1. **Tool name encoding.** Spec proposes `wp-agentic-admin/cache-flush` → `wp-agentic-admin__cache-flush` (replace `/` with `__`). Acceptable, or prefer a different convention (e.g. dot-separated)? Whatever we pick is hard to change once clients start hardcoding names.
2. **Third-party ability source attribution.** Plan currently parses the namespace from the ability ID (e.g. `woocommerce/list-orders` → "woocommerce"). If WP's Abilities API exposes a richer source field we should use that instead. Confirm during phase 2 implementation.
3. **Readonly detection fallback.** Some abilities may not set `meta.annotations.readonly` at all. v1 plan: treat absent as "not readonly" (conservative — excluded). Confirm this is the right default.
4. **404 vs 401 when disabled.** Acceptance criterion #1 says we don't register the route at all when `mcp_enabled = 0` → that's a 404. Alternative: register the route always but have the permission callback return 404/403 when disabled (lets clients discover the endpoint exists). Plan goes with the cleaner "don't register" approach. OK?
