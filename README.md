# ClaudeStats

A real-time token usage dashboard for [Claude Code](https://claude.ai/code), designed to live on a dedicated monitor so you always know where you stand on your session and weekly limits.

![ClaudeStats dashboard](documentation/screenshot.png)

---

## What it does

Claude Code imposes rolling token limits — a 5-hour session window and a 7-day weekly window. ClaudeStats makes those limits visible at a glance:

- **Live gauges** show session and weekly token consumption as colour-coded progress bars (green → yellow → red as you approach limits)
- **ETA projections** calculate your current burn rate over the last 15 minutes and tell you how long until you hit each limit at your current pace
- **Stat cards** surface session tokens, weekly tokens, message counts, cost, and active model in a single row
- **Weekly chart** shows daily token breakdown (input / output / cache) for the current billing period
- **Recent sessions table** lists your last 50 sessions with per-session token counts, duration, and cost
- **Auto-update** checks for new releases every 30 minutes and prompts you to install with a confirmation dialog showing the version change

---

## Data sources

ClaudeStats reads usage data from two sources simultaneously and merges them:

| Source | How it works | What it provides |
|---|---|---|
| **JSONL scanner** | Watches `~/.claude/projects/**/*.jsonl` for new entries | Accurate token counts, model, project, session ID |
| **OTLP/HTTP receiver** | Listens on `localhost:4318` for spans from Claude Code | Low-latency session activity signal |
| **Claude.ai API** *(optional)* | Polls your org's usage endpoint using your browser session | Authoritative utilisation percentages and reset times |

The JSONL scanner and OTLP receiver work without any login. Connecting your Claude.ai account upgrades the gauges from estimated limits to live, Anthropic-confirmed data.

---

## Installation

Download the latest `claude-stats-Setup-x.x.x.exe` from [Releases](https://github.com/kynetic29/claude-stats/releases) and run it. The installer is unsigned, so Windows SmartScreen will show a one-time warning — click **More info → Run anyway**.

Once installed, ClaudeStats auto-updates in the background. When a new version downloads it shows a toast in the header; click it to review and confirm the restart.

---

## Setup

On first launch a setup screen asks for two things:

1. **Target display** — pick the monitor you want the dashboard on. It will open fullscreen on that display every time.
2. **Anthropic Admin API key** *(optional)* — enables the daily usage summary chart. Get one from the [Anthropic Console](https://console.anthropic.com/).

You can re-open setup at any time with the **R** button in the header or `Ctrl+Shift+R`.

---

## Connecting Claude.ai

Click the **C** button in the header. A login window opens — sign in to claude.ai normally, then close the window. ClaudeStats captures the session cookie and starts polling your org's usage endpoint every 30 seconds.

When connected, the gauges switch from local estimates to live Anthropic data:
- A green **LIVE** badge appears on each gauge
- ETA projections use the confirmed limit rather than an estimate
- The session reset countdown reflects Anthropic's actual reset time

---

## Layout

The dashboard automatically adapts to your monitor's aspect ratio:

| Aspect ratio | Layout |
|---|---|
| ≤ 1.5 : 1 (4:3, portrait) | Single column, gauges stacked vertically |
| 1.5 – 1.9 : 1 (16:10, 16:9) | Two columns, chart gets more horizontal room |
| 1.9 – 2.2 : 1 (2:1) | Two equal columns — the original target layout |
| 2.2 – 3.0 : 1 (21:9) | Gauges sidebar on the left, chart + sessions fill the right |
| > 3.0 : 1 (32:9) | Adds a reserved third column (model breakdown, coming in a future release) |

---

## Header buttons

| Button | Action | Shortcut |
|---|---|---|
| **C** | Connect Claude.ai account | — |
| **L** | Record a limit hit (trains the local limit estimator) | `Ctrl+Shift+L` |
| **⊞** | Move dashboard to a different display | — |
| **⚙** | Open settings (thresholds, auto-start) | — |
| **R** | Reset setup and restart | `Ctrl+Shift+R` |
| **−** | Minimise | — |
| **✕** | Quit | `Ctrl+Shift+Q` |

---

## Settings

The **⚙** settings panel lets you:

- **Warn / critical thresholds** — the percentages at which gauges turn yellow and red (defaults: 60% / 80%)
- **Launch on login** — start ClaudeStats automatically when Windows starts

---

## Limit learning

ClaudeStats doesn't know your exact token limits from Anthropic — they vary by plan and change without notice. It learns them from observation:

- Every time you hit a session limit, press `Ctrl+Shift+L` (or the **L** header button) to record the observation. The more observations recorded, the higher the confidence shown in the **Estimated Limits** card.
- You can also tap the pencil icon next to any gauge to manually enter a known limit.
- Connecting Claude.ai bypasses this entirely — the live API provides confirmed utilisation percentages.

---

## Local development

```
npm install
npm run dev        # Vite watch build + Electron (close the installed app first)
npm test           # Unit tests (Vitest)
npm run build      # Production build
```

**Dev tip:** Press `Ctrl+Shift+K` while the dev build is running to cycle through all five layout variants without resizing the window.

---

## Releasing

```
# 1. Bump version in package.json
npm version patch   # or: minor / major

# 2. Push commit and tag
git push && git push --tags
```

GitHub Actions builds the NSIS installer on `windows-latest` and publishes it to GitHub Releases automatically. Installed clients pick up the update within 30 minutes.

---

## FAQ

**My dashboard shows 0% / no data even though I've been using Claude Code.**
The JSONL scanner looks in `~/.claude/projects/`. If your shell home resolves differently or another ClaudeStats instance is already running, nothing gets picked up. Close any running instance before launching the dev build.

**The OTLP receiver started on port 4319 instead of 4318.**
Something else is holding 4318. ClaudeStats falls back automatically, but Claude Code's telemetry won't reach it unless you point it at 4319.

**SmartScreen blocked the installer.**
The installer is unsigned. Click **More info → Run anyway**. Auto-updates are verified against GitHub Releases and work normally after that.

**My session percentage dropped suddenly without me doing anything.**
Expected — the session limit is a rolling 5-hour window. As old requests age out, the percentage falls even without new activity.

**ETA shows `—` even though I'm actively working.**
ETA needs 15 minutes of recent request history to calculate a burn rate. It appears after your first ~15 minutes of sustained activity.

**My percentage says X% but Claude Code isn't rate-limiting me.**
You're using local estimates, which may not match Anthropic's actual limits. Connect your Claude.ai account (the **C** button) for live, authoritative data.

**The C button shows a yellow `!`.**
Your Claude.ai session expired. Click it to re-authenticate.

**How do I move the dashboard to a different monitor?**
Click **⊞** in the header. The choice persists across restarts.

**How do I wipe everything and start fresh?**
`Ctrl+Shift+R` (or the **R** button) clears config and relaunches setup. Usage history in the database is preserved.

For deeper explanations of every tile and metric, see the [Dashboard Guide](documentation/dashboard-guide.md).

---

## Tech stack

- **Frontend:** React 18, Vite, Recharts — 100% inline styles with theme constants in `src/dashboard/theme.js`
- **Backend:** Electron 41, better-sqlite3
- **Data ingestion:** JSONL file scanner, OTLP/HTTP receiver on port 4318
- **Auto-update:** electron-updater with GitHub Releases provider
