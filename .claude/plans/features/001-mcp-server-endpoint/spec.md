# 001 — MCP Server Endpoint (read-only, v0.12.0)

## Problem

Today, an external AI agent that wants to call Agentic Admin's abilities has no way to reach them over the wire. The plugin's abilities are registered with the WordPress Abilities API, but the Abilities API is a registry — it has no transport. Sites without SSH/SFTP, or teams that want a Claude / ChatGPT / custom-agent client to drive the site, currently have no first-class path through this plugin.

Automattic's `wordpress-mcp` does provide an MCP transport, but it exposes its own hardcoded toolset (18 tools targeting core WP objects); it does not bridge the Abilities API. Depending on it would couple our release cadence to theirs, force JWT auth on our users, and surrender control of the tool surface.

## Goal

Ship an MCP server endpoint inside `wp-agentic-admin` itself that exposes registered abilities as MCP tools — read-only in v1, opt-in by default, no third-party plugin required.

## Non-goals (v1)

- Write/destructive tools (`annotations.readonly !== true` abilities are filtered out)
- Server-Sent Events / streaming responses (sync JSON-RPC only)
- MCP `resources` and `prompts` capabilities (only `tools`)
- OAuth / dynamic client registration
- Per-call audit log (deferred to a later version)
- Replacing or bridging Automattic's `wordpress-mcp` — we coexist, we don't interop

## Users

- Site admins (`manage_options`) who want to point an external MCP client at their WP site
- Plugin developers who already register abilities via `agentic_admin_register_ability()` and want them MCP-callable for free
- (Indirect) Third-party plugins that register abilities via `wp_register_ability()` directly — surfaced only when the admin explicitly opts them in

## Endpoint

- **Route**: `POST /wp-json/wp-agentic-admin/v1/mcp`
  - matches the existing namespace convention (see `class-llm-proxy.php`)
- **Transport**: JSON-RPC 2.0 over HTTP request/response (no SSE in v1)
- **Content-Type**: `application/json` for both request and response
- **Authentication**: standard WordPress REST authentication
  - App passwords over HTTP Basic auth is the supported path for external clients (no JWT layer)
  - Cookie+nonce continues to work for same-origin browser callers
  - The route's REST `permission_callback` requires `is_user_logged_in()`; per-tool authz delegates to each ability's own `permission_callback`
- **Methods implemented (v1)**:
  - `initialize` — protocol handshake, returns serverInfo + capabilities (`{ tools: { list: true, call: true } }`)
  - `tools/list` — enumerate exposed abilities, mapped to MCP tool descriptors
  - `tools/call` — invoke an ability, return its result
  - `ping` — health check
  - Anything else → JSON-RPC error code `-32601` Method not found

## Ability → MCP tool mapping

| Ability field | MCP tool field | Notes |
|---|---|---|
| `id` (e.g. `wp-agentic-admin/cache-flush`) | `name` (sanitized to `wp_agentic_admin__cache_flush` or `wp-agentic-admin__cache-flush`) | MCP tool names must match `^[a-zA-Z0-9_-]+$`; we replace `/` with `__`. Reverse lookup on `tools/call`. |
| `label` | `annotations.title` | |
| `description` | `description` | |
| `input_schema` | `inputSchema` | Passed through as-is (JSON Schema) |
| `meta.annotations.readonly` | `annotations.readOnlyHint` | v1 filter requires this to be `true` |
| `meta.annotations.destructive` | `annotations.destructiveHint` | |
| `meta.annotations.idempotent` | `annotations.idempotentHint` | |
| `execute_callback` | invoked by `tools/call` handler | Result wrapped as `{ content: [{ type: "text", text: <json> }] }` |
| `permission_callback` | called on `tools/call` before execute | Failure → JSON-RPC error `-32001` (custom) with HTTP 200, JSON-RPC body carries the error |

## Settings (added to the existing settings page)

New section `mcp` in `WPAgenticAdmin\Settings::get_settings_config()`:

```
MCP Endpoint
  ▢ Enable MCP endpoint                              [agentic_admin_mcp_enabled]      default: 0
    When enabled, external clients can call abilities via /wp-json/wp-agentic-admin/v1/mcp
    using an application password.

  Exposed abilities:
    ▣ Agentic Admin's own abilities                  [agentic_admin_mcp_expose_own]   default: 1
    ▢ Other plugins' Abilities API entries           [agentic_admin_mcp_expose_third] default: 0
       When checked, a checkbox list appears below to pick which third-party abilities
       are allowed. Default: all unchecked.

  ▢ <ability A>  (from: <plugin slug>)                [agentic_admin_mcp_allowlist[]] (multi-checkbox)
  ▢ <ability B>  (from: <plugin slug>)
  ...

  Endpoint URL (read-only display): https://example.com/wp-json/wp-agentic-admin/v1/mcp
```

UX details:
- The three top-level checkboxes are visible always; the allowlist appears only when "Other plugins' …" is checked
- Third-party allowlist excludes abilities whose ID starts with `wp-agentic-admin/` (those are governed by the "own" toggle)
- Third-party allowlist also excludes write-y abilities for v1 (`annotations.readonly !== true`), shown but disabled with a tooltip "v1 is read-only"
- Endpoint URL is shown with a "copy" button (existing admin-page UI patterns reused)

## Privacy + headline guarantee

The master toggle defaults **off**. The plugin's "privacy-first, browser-side AI" headline remains accurate out-of-the-box: nothing leaves the site, nothing accepts remote tool calls, until an admin explicitly enables the endpoint. Documentation in `readme.txt` and `docs/` is updated to call this out.

## Coexistence with Automattic `wordpress-mcp`

Distinct routes, distinct option keys, distinct auth surfaces. If both plugins are active:
- `/wp-json/wp-agentic-admin/v1/mcp` — our endpoint, app-password auth, our abilities
- `/wp-json/wp/v2/wpmcp/streamable` — Automattic's, JWT/OAuth, their 18 tools
- An admin can run both, point different clients at each. We do not register tools with `wordpress_mcp_init`. We do not depend on or detect their plugin.

## Risks

- **MCP spec drift.** Current target is the same protocol Automattic implements (`2025-03-26` per their schema). We don't ship the spec JSON; we implement against a documented version and bump as needed. Mitigation: pin the protocol version returned from `initialize`, document the supported version range in `readme.txt`.
- **Third-party ability quality.** A buggy/insecure ability in another plugin becomes remote-callable when opted in. Mitigation: default off, explicit allowlist, read-only v1, each ability's own `permission_callback` still gates.
- **App password rotation.** Compromised app password = full read access to allowed tools. Same risk model as `/wp-json/wp/v2/users/me` already has. Documentation reminds admins to scope app passwords per client and revoke unused.

## Acceptance criteria

1. With `mcp_enabled = 0`: POSTing to the endpoint returns HTTP 404 (route not registered at all when disabled).
2. With `mcp_enabled = 1` and no auth: HTTP 401.
3. With valid app password + `initialize`: returns serverInfo containing plugin name + version, capabilities `{ tools: { list: true, call: true } }`.
4. With `mcp_expose_own = 1` only: `tools/list` returns N items where every `name` maps to an `wp-agentic-admin/*` ability AND every ability has `readonly === true`. No third-party tools present.
5. With `mcp_expose_third = 1` plus an allowlist of one third-party read-only ability: `tools/list` includes that ability alongside the own ones.
6. `tools/call` on an allowed read-only ability returns the ability's result in MCP content format.
7. `tools/call` on an ability whose `permission_callback` returns false → JSON-RPC error with code `-32001`, HTTP 200.
8. `tools/call` on a write-y ability (`readonly !== true`) → JSON-RPC error `-32601` Method not found (it was never in `tools/list`, so name lookup fails).
9. Unknown method → JSON-RPC error `-32601`.
10. Existing functionality (browser-side ReAct loop, LLM proxy, admin pages) continues to work unchanged. No regressions in `composer lint`, `npm run lint:js`, `npm test`.

## Out of scope (explicit)

- `tools/call` for non-readonly abilities
- SSE streaming
- `resources/*` and `prompts/*` MCP methods
- Multi-language tool descriptions
- Rate limiting on the endpoint (rely on infra; document recommendation)
- Audit log table; we log only via the existing PHP error log on failure paths
- WP-CLI command for managing the allowlist
- Detecting wordpress-mcp's presence or bridging into it
