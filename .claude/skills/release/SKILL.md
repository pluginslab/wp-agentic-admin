---
name: release
description: Version bump, commit, push, and create GitHub release with notes
argument-hint: "<version>"
allowed-tools: "Bash(npm *), Bash(git *), Bash(gh *), Read, Edit"
---

# Release v$ARGUMENTS

## Steps

1. **Version bump** — update ALL of these to `$ARGUMENTS`:
   - `agentic-admin.php`: plugin header `Version:`, `AGENTIC_ADMIN_VERSION` constant, `activate()` hook
   - `package.json`: `version` field
   - `readme.txt`: `Stable tag:` field
   - Run `npm install --package-lock-only` to sync `package-lock.json`

2. **Changelog** — add a new section in `readme.txt` under `== Changelog ==` for version `$ARGUMENTS` describing what changed since the last release. Use `git log` to find changes.

3. **Lint** — run `npx wp-scripts lint-js` on any modified JS files

4. **Tests** — run `npm test` to verify unit tests pass

5. **Commit** — stage all version-bumped files and commit:
   ```
   release: v$ARGUMENTS — <short description>
   ```

6. **Push** — `git push origin main`

7. **GitHub release** — create with `gh release create v$ARGUMENTS` including:
   - Title: `v$ARGUMENTS — <short description>`
   - Notes: summary of changes, breaking changes if any, notable improvements
