# Changelog

All notable changes to ClaudeStats are documented here.

---

## [1.0.0] — 2026-04-12

First stable release. All seven planned phases complete.

### Summary of what's included
- Full auto-update pipeline (silent NSIS, GitHub Actions)
- Configurable thresholds and launch-on-startup
- Responsive layout across 5 aspect ratios
- Time-to-limit ETA projections
- Model breakdown donut chart
- CSV/JSON data export
- Historical analysis window (daily/weekly/monthly charts)
- Pre-install version check (always installs the latest available build)

---

## [0.9.2] — 2026-04-12

### Fixed
- **Pre-install version check** — before calling `quitAndInstall()`, a fresh `checkForUpdates()` is triggered with a 10-second timeout. If a newer version was published between download and confirmation, it downloads and installs automatically. Falls through to the staged installer on timeout/error — user is never blocked.
- **Update modal survives status transitions** — the confirm modal was previously rendered inside the `status.state === 'downloaded'` branch, causing it to close when status changed to `'checking'` mid-flow. Modal is now rendered at the top level, controlled by `modalPhase` state (`confirm` → `checking` → `installing`).

---

## [0.9.1] — 2026-04-12

### Fixed
- **Silent NSIS updates** — `oneClick: false` in the NSIS config was causing the full installer wizard (with per-user/all-users choice) to appear on every update. Set to `oneClick: true` so updates install silently to `%LOCALAPPDATA%\Programs\ClaudeStats` with no UI.

---

## [0.9.0] — 2026-04-12

### Added
- **Historical analysis window** — click ⌛ in the dashboard header to open a separate, resizable History window that does not disturb the dedicated display.
  - Daily trend area chart with model filter, 7/14/30/60/90-day range, and tokens/cost toggle.
  - Week-over-week bar chart with 4/8/12/26-week range.
  - Monthly summary table with inline token bar chart and columns for input, output, cost, and request count.
  - Export bar on the history page reuses the Phase 6 CSV/JSON exporter.
- New IPC channels: `history:open`, `history:get-daily`, `history:get-weekly`, `history:get-monthly`, `history:get-models`.

---

## [0.8.1] — 2026-04-12

### Fixed
- **Project path decoding** — folder names containing hyphens (e.g. `claude-stats`) were previously decoded incorrectly (`D:\CodingProjects\claude\stats` instead of `D:\CodingProjects\claude-stats`). The decoder now walks the filesystem greedily to distinguish path separators from literal hyphens in directory names.
- On startup, previously stored mis-decoded project values in `requests` and `sessions` are patched automatically.

---

## [0.8.0] — 2026-04-12

### Added
- **CSV/JSON export** via the Settings modal (⚙).
  - Format: CSV or JSON.
  - Scope: sessions, requests, or all.
  - File destination chosen via the OS save dialog.
  - CSV uses a hand-rolled formatter with correct comma/quote escaping (no new dependency).
  - JSON is pretty-printed.
  - Note: CSV + "all" scope exports sessions only; export requests separately for the full request log.

---

## [0.7.2] — 2026-04-12

### Fixed
- **Duplicate model breakdown tile** — the `ModelBreakdown` chart appeared twice in the standard layout (right-column stack + explicit third column) and twice in the superwide layout (left sidebar + dedicated third column). Each layout now shows exactly one instance.

---

## [0.7.1] — 2026-04-12

### Fixed
- `ModelBreakdown` tile was not visible in the wide-2to1 layout (primary 2:1 display). It is now stacked below the Recent Sessions table in the right column.

### Documentation
- FAQ entry clarifying Mac and Linux support status.

---

## [0.7.0] — 2026-04-12

### Added
- **Model breakdown tile** — donut chart showing token and cost split by model for the current 5-hour session window.
  - Tokens/cost toggle.
  - Center label showing window total.
  - Color-coded legend with percentage breakdown.
  - Placed as a third column in standard layout, dedicated column in superwide, and in the left sidebar in ultrawide.
- FAQ documentation covering data & setup, understanding the numbers, configuration, and limit learning.

---

## [0.6.0] — 2026-04-12

### Added
- **Time-to-limit ETA projections** — shown below each gauge's percentage.
  - Calculated from a 15-minute rolling burn rate.
  - Shows `—` when idle (no recent activity).
  - Shows `~` prefix and dimmed styling when using an estimated (not API-confirmed) limit.
  - When connected to Claude.ai, uses the authoritative utilisation percentage for the projection.
- Comprehensive `README.md` with project overview, setup instructions, feature summary, and an inline FAQ.

---

## [0.5.1] — 2026-04-12

### Added
- **Responsive / aspect-ratio-aware layout** — five named variants based on window aspect ratio:
  | Variant | Ratio | Layout |
  |---------|-------|--------|
  | `tall` | ≤ 1.5 | Single column, vertical gauges, stat cards wrap |
  | `standard` | 1.5–1.9 | Three columns: chart+limits / sessions / model breakdown |
  | `wide-2to1` | 1.9–2.2 | Two columns optimised for 2:1 displays |
  | `ultrawide` | 2.2–3.0 | Gauges sidebar + main content |
  | `superwide` | > 3.0 | Gauges sidebar + main content + model breakdown column |
- Font scaling per layout (`0.88rem` to `1.06rem`).
- Hidden **Ctrl+Shift+K** shortcut to cycle layout variants for visual QA.

### Changed
- **Auto-update confirmation dialog** — the updater now downloads silently but requires explicit user confirmation before installing. The toast shows the current → new version (e.g. `v0.5.0 → v0.5.1`) and a modal with "Not now" / "Restart & Update" buttons.
- Update check interval reduced from 6 hours to 30 minutes.

---

## [0.4.2] — prior

### Fixed
- Session token count showed 0 for long-running sessions that span the 5-hour window boundary.
- Claude.ai login window opened behind the dashboard instead of in front.

### Added
- Minimize button (`−`) in the dashboard header.

---

## [0.4.0] — prior

### Added
- **Configurable alert thresholds** — warn% and critical% for both session and weekly gauges, adjustable in Settings (⚙). Defaults: warn at 60%, alert at 80%.
- **Launch on system startup** — toggle in Settings registers ClaudeStats with the Windows startup registry.

---

## [0.3.0] — prior

### Added
- **Auto-update infrastructure** — `electron-updater` + GitHub Actions release workflow. Push a version tag (`v*`) to trigger a build on `windows-latest`; the resulting NSIS installer and `latest.yml` manifest are published to GitHub Releases automatically.
- Running instances check for updates every 30 minutes and show a toast when a new version is downloaded.

---

## Earlier releases

### Added (pre-0.3.0)
- In-app display picker (⊞) to move the window between monitors without restarting.
- Clickable session detail modal showing per-request token breakdown.
- Live usage data from the Claude.ai API (the **C** button), providing authoritative utilisation percentages when connected.
- OTLP/HTTP receiver on port 4318 for real-time span ingestion from Claude Code.
- JSONL log scanner reading `~/.claude/projects/` for offline/historical data.
- Local SQLite database for indefinite history storage.
- Limit estimator using the 10th-percentile of recorded rate-limit observations.
- Initial dashboard: session gauge, weekly gauge, stat cards, recent sessions table, weekly chart.
