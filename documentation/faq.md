# ClaudeStats — Frequently Asked Questions

---

## Data & Setup

### My dashboard shows 0% / no data even though I've been using Claude Code

The JSONL scanner looks for usage logs in `~/.claude/projects/`. Two common causes:

1. **Another ClaudeStats instance is already running.** The app enforces a single instance lock. If the installed production version is running while you try to launch a dev build (or vice versa), the second instance exits immediately with no error. Close all ClaudeStats windows first.
2. **Your shell home directory resolves to an unexpected path.** On some Windows setups, `~` in a tool may not match `%USERPROFILE%`. Check that `.claude/projects/` exists under your actual user folder and contains `.jsonl` files.

If the files exist but data still isn't appearing, check the Electron console (`View → Toggle Developer Tools` in dev mode) for `[jsonl-scanner]` log lines.

---

### The OTLP receiver started on port 4319 instead of 4318

Something else is holding port 4318 — commonly another ClaudeStats instance, a telemetry collector, or a previous session that didn't clean up. ClaudeStats falls back to 4319 automatically and logs the change. However, Claude Code's built-in telemetry is configured to send to 4318 by default, so spans won't arrive until 4318 is free again. Restarting ClaudeStats after freeing the port will reclaim 4318.

---

### Windows SmartScreen blocked the installer

The installer is currently unsigned (code signing is on the roadmap). On first install:

1. Click **More info** in the SmartScreen dialog.
2. Click **Run anyway**.

This is a one-time step. Auto-updates delivered through the in-app updater are verified against the GitHub Release manifest and do not trigger a second SmartScreen prompt.

---

### Does this work on Mac or Linux?

Not currently. The installer is built as an NSIS executable (Windows-only), and `electron-updater` requires NSIS for auto-update support. Mac and Linux would need separate build targets and are planned for a future release.

---

## Understanding the Numbers

### My session percentage dropped suddenly without me doing anything

This is expected behaviour. The session limit is a **rolling 5-hour window** — it is not tied to when you opened the app or started a conversation. As requests age past the 5-hour mark they fall off the window and the percentage decreases automatically, even if you have not sent a new message.

---

### The ETA shows `—` even though I'm actively working

The ETA projection requires enough recent history to calculate a meaningful burn rate. ClaudeStats uses a 15-minute rolling window of requests. If you have just started a session, or there has been a gap of more than 15 minutes in your requests, there is not enough data yet and `—` is shown. The ETA will appear after approximately 15 minutes of sustained activity.

---

### My percentage says X% but Claude Code is not rate-limiting me

When not connected to the Claude.ai API, ClaudeStats estimates your token limit from previously recorded rate-limit observations (see [Estimated Limits](dashboard-guide.md#estimated-limits)). If you have few observations or your actual limit is higher than estimated, the percentage will appear elevated even though you have headroom remaining. Connecting your Claude.ai account (the **C** button) switches all gauges to Anthropic's authoritative utilisation data and eliminates this discrepancy.

---

### The session and weekly percentages don't add up the way I expect

The two limits are independent counters with different windows:

- **Session (5-hour):** counts every token in the last 5 hours, across all sessions.
- **Weekly (7-day):** counts every token since the weekly reset (default: Monday 6:00 AM), across all sessions.

A single heavy session will simultaneously drive up both percentages. The session percentage resets as old requests age out; the weekly percentage only resets when the weekly window rolls over.

---

### The ETA has a `~` prefix and dimmed styling

The `~` indicates the projection is based on an **estimated** limit, not an Anthropic-confirmed one. Because the true limit is unknown, the remaining-tokens calculation (and therefore the ETA) may be significantly off. When connected to Claude.ai the `~` is removed and the projection uses the confirmed utilisation percentage.

---

### The C button is showing a yellow `!`

Your Claude.ai session has expired. Click the button to re-authenticate. The login window will open; sign in normally, then close the window. Polling resumes automatically. This typically happens after a few weeks of inactivity or if you logged out of claude.ai in your browser.

---

## Configuration & Layout

### How do I move the dashboard to a different monitor?

Click the **⊞** button in the header. A picker lists all connected displays with their resolutions. Click the target display — the window moves immediately and the choice is saved. It will open on that display on every subsequent launch.

---

### How do I change the yellow/red threshold levels?

Click **⚙** in the header to open Settings. The four threshold fields control when each gauge turns yellow (warn) and red (critical) for both the session and weekly limits. Changes take effect on the next 3-second poll without a restart.

---

### How do I make ClaudeStats launch automatically when Windows starts?

Open Settings (**⚙**) and enable **Launch on login**. This registers ClaudeStats with the Windows startup registry via Electron's `setLoginItemSettings`. Disable it the same way.

---

### How do I open the historical analysis view?

Click the **⌛** button in the dashboard header. This opens a separate resizable window showing three views:

- **Daily Trend** — area chart of token or cost usage per day, with a model filter and range selector (7 / 14 / 30 / 60 / 90 days).
- **Week over Week** — bar chart of weekly totals for the last 4 / 8 / 12 / 26 weeks.
- **Monthly Summary** — table of monthly totals with an inline token bar chart, input, output, cost, and request count columns.

The history window opens independently and does not disturb the dashboard on your dedicated display. You can have both open at the same time.

---

### How do I export my usage data?

Click **⚙** to open Settings, then scroll to the **Export Data** section.

- **Format:** CSV or JSON.
- **Scope:** Sessions (one row per session), Requests (one row per individual API call), or All.
- Click **Export…** — a save dialog lets you choose the destination.

**Notes:**
- CSV + All scope exports sessions only. Export requests separately to get the full per-request log, since CSV cannot natively represent two tables in one file.
- JSON is pretty-printed and suitable for processing with tools like `jq`.
- The same export controls are also available at the bottom of the History window.

---

### How do I reset everything and start fresh?

Press `Ctrl+Shift+R` or click the **R** button in the header. This clears the saved configuration (display choice, API keys, thresholds) and relaunches the setup wizard. Your **usage history** stored in the SQLite database is preserved — only the config is cleared.

To delete usage history as well, remove the database file from `%APPDATA%\ClaudeStats\` (`claude-stats.db`) before relaunching.

---

## Limit Learning

### How does ClaudeStats know my token limit?

It doesn't — Anthropic does not publish exact per-plan limits. ClaudeStats estimates them statistically: each time you hit a rate limit, it records the token count as an observation and uses the **10th percentile** of all observations as a conservative estimate. More observations → higher confidence → more accurate gauges.

Connecting your Claude.ai account bypasses this entirely — the live API provides confirmed utilisation percentages directly from Anthropic.

---

### I hit a rate limit but the dashboard didn't record it automatically

Press `Ctrl+Shift+L` (or the **L** header button) immediately after being rate-limited to record the observation manually. The dashboard detects limit hits by monitoring token counts, but in some cases (especially with API-connected sessions) it may not catch the exact threshold. Manual recording is always more reliable.

---

### My limit estimate seems way too low / high

If you have only one or two observations, the estimate can be significantly off. Record more limit hits over time and confidence will improve. If you know your actual limit (e.g. from Anthropic support), click the pencil icon next to the gauge to enter it directly.
