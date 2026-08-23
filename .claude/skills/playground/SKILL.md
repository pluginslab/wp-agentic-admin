---
name: playground
description: Spin up a WordPress Playground instance with the plugin mounted and activated
allowed-tools: "mcp__wp-playground__start_playground, mcp__wp-playground__wp_cli, mcp__wp-playground__get_playground_logs, mcp__wp-playground__stop_playground"
---

# Start WordPress Playground

Spin up an ephemeral WordPress Playground with agentic-admin mounted from the local working directory.

## Important: Mount + Activation Gotchas

- **Do NOT include `activatePlugin` in the blueprint steps.** Mounted directories are not available when blueprint steps execute, so activation will fail with "Plugin file does not exist."
- **Do NOT use `mountBeforeInstall`** — it does not help; the mount is still unavailable at blueprint step time.
- **Always use an empty blueprint** (`{"steps": []}`) with the `mount` option, then activate via WP-CLI after startup.

## Steps

1. **Start Playground** with an empty blueprint and mount the plugin:
   - Blueprint: `{"steps": []}`
   - Options: `{"mount": ["<project-root>:/wordpress/wp-content/plugins/agentic-admin"]}`
   - Where `<project-root>` is the current working directory

2. **Activate the plugin** via WP-CLI (only after Playground is running):
   - `plugin activate agentic-admin`

3. **Report** the URL and credentials to the user:
   - Site URL (typically http://127.0.0.1:9400)
   - Plugin page: `<site-url>/wp-admin/admin.php?page=agentic-admin`
   - Credentials: admin / password

4. If any step fails, check logs with `get_playground_logs` and report the error.
