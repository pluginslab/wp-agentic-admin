# MCP Endpoint

Agentic Admin ships a built-in MCP (Model Context Protocol) server starting in
v0.12.0. When enabled, external AI clients can call this plugin's registered
abilities — and optionally a curated allowlist of third-party Abilities API
entries — via standard MCP JSON-RPC, authenticated with WordPress application
passwords.

**This is read-only in v0.12.0.** Abilities are only exposed if they declare
`meta.annotations.readonly = true`. Write-capable abilities are filtered out
at the protocol boundary.

---

## When to use this

- You want a Claude, ChatGPT, or custom MCP client to read site state,
  diagnose issues, or summarize content without giving anyone SSH/SFTP access.
- You're hosting WordPress somewhere SSH-less (managed WP hosts, low-trust
  shared hosting) but still want programmatic, auditable read access.
- You already use the Abilities API for your own plugins and want them
  callable over MCP without writing a transport layer.

If you don't need any of that, leave the endpoint disabled. It's off by
default and the plugin works entirely client-side without it.

---

## Enabling the endpoint

1. **WordPress admin** → **Agentic Admin** → **Settings tab** → scroll to
   **MCP Endpoint**.
2. Flip **Enable MCP endpoint** on.
3. Decide what's exposed:
   - **Expose Agentic Admin's own abilities** (default on) — every read-only
     ability shipped by this plugin shows up as an MCP tool.
   - **Expose abilities from other plugins** (default off) — reveals a list
     of every third-party ability registered via `wp_register_ability()`,
     grouped by source plugin. Tick each one you want to expose. Non-readonly
     entries are listed but unselectable in v0.12.0.
4. **Save MCP settings**.
5. Copy the endpoint URL shown in the card (something like
   `https://your-site.tld/wp-json/wp-agentic-admin/v1/mcp`).

---

## Creating an application password

External clients can't use cookie auth, so create a scoped app password:

1. **Users** → **Profile** (or **Edit user**).
2. Scroll to **Application Passwords**.
3. New application name: e.g. `claude-mcp` or `chatgpt-mcp`. Click **Add**.
4. Copy the password (shown once — WP will not show it again).
5. Connect with HTTP Basic auth using your WP username + that app password.

> ⚠️ The app password inherits the issuing user's capabilities. A subscriber's
> app password cannot reach an `manage_options`-gated ability — each ability's
> existing `permission_callback` is still enforced inside `tools/call`. But
> don't issue admin app passwords to clients that don't need them.

---

## curl walkthrough

```bash
SITE="https://your-site.tld"
USER="your-wp-username"
APP_PASS="abcd EFGH ijkl MNOP qrst UVWX"      # WP shows spaces; you can omit them
URL="$SITE/wp-json/wp-agentic-admin/v1/mcp"

# 1) Handshake
curl -s -u "$USER:$APP_PASS" -H "Content-Type: application/json" \
  "$URL" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"manual","version":"1.0"}}}'

# 2) List available tools
curl -s -u "$USER:$APP_PASS" -H "Content-Type: application/json" \
  "$URL" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) Call one of them
curl -s -u "$USER:$APP_PASS" -H "Content-Type: application/json" \
  "$URL" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"wp-agentic-admin__site-health","arguments":{}}}'
```

---

## Ability → MCP tool name mapping

WordPress ability IDs (`namespace/ability-name`) contain a slash, which the
MCP spec doesn't allow in tool names. We map slash → double-underscore:

| WordPress ability ID          | MCP tool name                  |
|-------------------------------|--------------------------------|
| `wp-agentic-admin/site-health`| `wp-agentic-admin__site-health`|
| `core/get-site-info`          | `core__get-site-info`          |

The mapping is reversible by inspection — no naming conflicts arise because
WP ability IDs are already namespaced.

---

## Connecting Claude Desktop

In `claude_desktop_config.json` (or your client's MCP server config):

```jsonc
{
  "mcpServers": {
    "wp-agentic-admin": {
      "transport": {
        "type": "http",
        "url": "https://your-site.tld/wp-json/wp-agentic-admin/v1/mcp",
        "headers": {
          "Authorization": "Basic <base64(user:apppassword)>"
        }
      }
    }
  }
}
```

(Exact config keys vary by client; check your client's MCP docs.)

---

## Coexistence with Automattic's `wordpress-mcp`

Agentic Admin's endpoint and Automattic's `wordpress-mcp` plugin are
**independent**:

- **Different routes:** `/wp-json/wp-agentic-admin/v1/mcp` vs
  `/wp-json/wp/v2/wpmcp/streamable`
- **Different auth:** app-password Basic auth vs JWT (Automattic's)
- **Different toolsets:** the plugins do not bridge or share tools
- **Different option storage:** no shared settings, no conflicts

You can run both side-by-side and point different MCP clients at each. We do
not depend on Automattic's plugin, and we do not bridge our abilities into
its endpoint.

---

## What's exposed in v0.12.0

- **Our own abilities** with `meta.annotations.readonly = true` — typically
  diagnostic and reporting tools (site health, security scan, log readers,
  database query in read-only mode, …).
- **Third-party abilities** the admin explicitly allowlisted, again
  read-only only.

Write/destructive abilities are deliberately invisible to MCP in this
release. Future versions may add a separately-gated write surface.

---

## Troubleshooting

**HTTP 404 on the endpoint URL**
The MCP endpoint is disabled. Enable it in Settings → MCP Endpoint, and
make sure pretty permalinks are configured (Settings → Permalinks).

**HTTP 401 "Authentication required"**
Either no credentials were sent, or the user/app password combination is
wrong. Test with `/wp-json/wp/v2/users/me` first to confirm the credential.

**Tool list is empty**
- Make sure at least one of the "Expose own" or "Expose third-party"
  toggles is on.
- Confirm the abilities you expect to see actually declare
  `meta.annotations.readonly = true`. The conservative default is
  "absent = excluded."

**`-32601 Method not found` on `tools/call`**
The tool name was either misspelled or refers to a non-exposed ability.
Check the result of `tools/list` and copy the `name` field verbatim.

**`-32001 Permission denied`**
The tool exists, but the authenticated user's role doesn't satisfy the
ability's own `permission_callback`. Use an app password belonging to a
user with sufficient capabilities (often `manage_options`).
