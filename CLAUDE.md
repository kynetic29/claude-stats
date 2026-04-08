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
```
