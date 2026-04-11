# ClaudeStats

Electron desktop app for monitoring Claude Code token usage on a dedicated display.

## Versioning

This project follows **Semantic Versioning** (Major.Minor.Patch):

- **Major** (X.0.0): Breaking changes -- incompatible config format changes, database schema migrations that require manual intervention, removal of existing features.
- **Minor** (0.X.0): New features -- new dashboard tiles, new data sources, new UI components, new IPC endpoints.
- **Patch** (0.0.X): Bug fixes, styling tweaks, documentation updates, performance improvements, dependency bumps.

**Always update the version in `package.json`** when committing changes. Evaluate the scope of changes against the rules above and bump the appropriate level. When bumping a higher level, reset the lower levels to zero (e.g., 0.1.3 -> 0.2.0).

## Tech Stack

- **Frontend**: React 18 + Vite, Recharts for charts, 100% inline styles with theme constants in `src/dashboard/theme.js`
- **Backend**: Electron main process, better-sqlite3 for local database
- **Data sources**: JSONL log scanner, OTLP/HTTP receiver (port 4318), Claude.ai API (optional)

## Build

```
npm run build    # Vite production build
npm start        # Launch Electron app
npm run dev      # Dev mode with hot reload
npm run package  # Local installer build (no publish)
npm run release  # Build + publish to GitHub Releases (used by CI)
```

## Releases & Auto-update

Releases are **fully automated via GitHub Actions**. The workflow at `.github/workflows/release.yml` runs on `windows-latest` whenever a tag matching `v*` is pushed. It builds the NSIS installer and publishes it + the `latest.yml` manifest to a GitHub Release using the built-in `GITHUB_TOKEN` — no secrets to configure.

**Release ritual:**

```
# 1. Bump version in package.json (creates a git tag automatically)
npm version patch   # or: npm version minor / npm version major

# 2. Push the commit AND the tag
git push && git push --tags
```

GitHub Actions takes over from there. Monitor the run at https://github.com/kynetic29/claude-stats/actions. When it finishes successfully, the release appears at https://github.com/kynetic29/claude-stats/releases and installed clients pick it up on their next startup check (or within 6 hours for long-running sessions).

**The installed app checks for updates on startup** via `electron-updater` (see `electron/updater.js`). When a newer version is found, it downloads in the background and shows a "restart to update" button in the dashboard header. Auto-update is a no-op in dev mode (`!app.isPackaged`).

**Requirements:**
- Build target must be **NSIS** (`build.win.target: "nsis"`). Portable .exe does not support auto-update.
- `build.publish` must be configured for the GitHub provider in `package.json`.
- Tags must start with `v` (e.g., `v0.3.0`) to trigger the workflow.

**SmartScreen:** Unsigned Windows installers trigger a one-time SmartScreen warning on first launch. Updates still apply correctly. Code signing requires a paid certificate and is out of scope for now.

**Failure recovery:** If the workflow fails, fix the issue, delete the failed tag locally and on the remote (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), then re-run the release ritual. Do not reuse a tag that already produced a published release.
