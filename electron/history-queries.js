const { getDb } = require('./db')

// ── Helpers ──────────────────────────────────────────────────────────────────

// ISO week number (Monday-based)
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

function weekLabel(ts) {
  const d = new Date(ts)
  const w = isoWeek(d)
  return `W${w} '${String(d.getFullYear()).slice(2)}`
}

function monthLabel(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Daily token + cost totals for the last N days.
 * Returns [{date, label, input_tokens, output_tokens, cache_creation,
 *           total_tokens, cost, request_count}]
 */
function getDailyTrend(days = 30) {
  const db = getDb()
  const since = Date.now() - days * 24 * 60 * 60 * 1000

  const rows = db.prepare(`
    SELECT
      CAST(timestamp / 86400000 AS INTEGER) as day_bucket,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation,
      SUM(input_tokens + output_tokens + cache_creation_tokens) as total_tokens,
      SUM(cost_usd) as cost,
      COUNT(*) as request_count
    FROM requests
    WHERE timestamp >= ?
    GROUP BY day_bucket
    ORDER BY day_bucket ASC
  `).all(since)

  return rows.map(r => {
    const ts = r.day_bucket * 86400000
    const d = new Date(ts)
    return {
      ...r,
      ts,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  })
}

/**
 * Week-over-week totals for the last N weeks.
 * Returns [{week, label, input_tokens, output_tokens, cache_creation,
 *           total_tokens, cost, request_count, session_count}]
 */
function getWeekOverWeek(weeks = 8) {
  const db = getDb()
  const since = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000

  // Group by ISO week bucket: floor to Monday of the week
  // SQLite: compute Monday of the week from timestamp
  const rows = db.prepare(`
    SELECT
      -- Monday of the week containing this timestamp (ms → days → week Monday)
      (CAST(timestamp / 86400000 AS INTEGER) -
        ((CAST(timestamp / 86400000 AS INTEGER) + 3) % 7)) * 86400000 as week_start_ms,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation,
      SUM(input_tokens + output_tokens + cache_creation_tokens) as total_tokens,
      SUM(cost_usd) as cost,
      COUNT(*) as request_count,
      COUNT(DISTINCT session_id) as session_count
    FROM requests
    WHERE timestamp >= ?
    GROUP BY week_start_ms
    ORDER BY week_start_ms ASC
  `).all(since)

  return rows.map(r => ({
    ...r,
    label: weekLabel(r.week_start_ms),
  }))
}

/**
 * Monthly totals for the last N months.
 * Returns [{month, label, input_tokens, output_tokens, cache_creation,
 *           total_tokens, cost, request_count, session_count}]
 */
function getMonthlySummary(months = 12) {
  const db = getDb()
  const since = Date.now() - months * 30 * 24 * 60 * 60 * 1000

  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch')) as month,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation,
      SUM(input_tokens + output_tokens + cache_creation_tokens) as total_tokens,
      SUM(cost_usd) as cost,
      COUNT(*) as request_count,
      COUNT(DISTINCT session_id) as session_count
    FROM requests
    WHERE timestamp >= ?
    GROUP BY month
    ORDER BY month ASC
  `).all(since)

  return rows.map(r => ({
    ...r,
    label: monthLabel(new Date(r.month + '-01T12:00:00Z')),
  }))
}

/**
 * All distinct models that have at least one request.
 */
function getDistinctModels() {
  const db = getDb()
  return db.prepare(`
    SELECT DISTINCT COALESCE(model, 'unknown') as model
    FROM requests
    ORDER BY model
  `).all().map(r => r.model)
}

/**
 * Daily trend filtered by model.
 */
function getDailyTrendByModel(days = 30, model = null) {
  const db = getDb()
  const since = Date.now() - days * 24 * 60 * 60 * 1000

  const where = model ? 'AND COALESCE(model, \'unknown\') = ?' : ''
  const params = model ? [since, model] : [since]

  const rows = db.prepare(`
    SELECT
      CAST(timestamp / 86400000 AS INTEGER) as day_bucket,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation,
      SUM(input_tokens + output_tokens + cache_creation_tokens) as total_tokens,
      SUM(cost_usd) as cost,
      COUNT(*) as request_count
    FROM requests
    WHERE timestamp >= ? ${where}
    GROUP BY day_bucket
    ORDER BY day_bucket ASC
  `).all(...params)

  return rows.map(r => {
    const ts = r.day_bucket * 86400000
    const d = new Date(ts)
    return {
      ...r,
      ts,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  })
}

module.exports = { getDailyTrend, getWeekOverWeek, getMonthlySummary, getDistinctModels, getDailyTrendByModel }
