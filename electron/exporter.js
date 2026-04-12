const { dialog } = require('electron')
const fs = require('fs')
const db = require('./db')

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Quote if contains comma, double-quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ]
  return lines.join('\r\n')
}

// ── Data queries by scope ────────────────────────────────────────────────────

function getSessionsData() {
  return db.getSessions(10000).map(r => ({
    session_id: r.session_id,
    project: r.project,
    model: r.model,
    first_request_at: r.first_request_at ? new Date(r.first_request_at).toISOString() : '',
    last_request_at: r.last_request_at ? new Date(r.last_request_at).toISOString() : '',
    request_count: r.request_count,
    total_input_tokens: r.total_input_tokens,
    total_output_tokens: r.total_output_tokens,
    total_cache_creation: r.total_cache_creation,
    total_cache_read: r.total_cache_read,
    total_cost_usd: r.total_cost_usd,
    is_active: r.is_active ? 1 : 0,
  }))
}

function getRequestsData() {
  // Pull all requests ordered by timestamp via the DB function
  const d = db.getDb()
  return d.prepare(`
    SELECT
      request_id, session_id, project, model,
      timestamp, input_tokens, output_tokens,
      cache_creation_tokens, cache_read_tokens, cost_usd, source
    FROM requests
    ORDER BY timestamp ASC
  `).all().map(r => ({
    ...r,
    timestamp_iso: r.timestamp ? new Date(r.timestamp).toISOString() : '',
  }))
}

function getAllData() {
  return {
    sessions: getSessionsData(),
    requests: getRequestsData(),
  }
}

// ── Main export function ─────────────────────────────────────────────────────

async function exportData({ format, scope }) {
  // Gather data
  let rows
  let isMultiTable = false

  if (scope === 'sessions') {
    rows = getSessionsData()
  } else if (scope === 'requests') {
    rows = getRequestsData()
  } else {
    // 'all'
    rows = getAllData()
    isMultiTable = format === 'json'
  }

  // Build default filename
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const ext = format === 'csv' ? 'csv' : 'json'
  const defaultName = `claude-stats-${scope}-${ts}.${ext}`

  // Prompt user for save location
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export ClaudeStats Data',
    defaultPath: defaultName,
    filters: format === 'csv'
      ? [{ name: 'CSV Files', extensions: ['csv'] }]
      : [{ name: 'JSON Files', extensions: ['json'] }],
  })

  if (canceled || !filePath) return { ok: false, reason: 'canceled' }

  // Format and write
  try {
    let content
    if (format === 'json') {
      content = JSON.stringify(isMultiTable ? rows : rows, null, 2)
    } else {
      // CSV — for 'all' scope, write sessions only (requests can be very large and CSV
      // can't express multi-table natively; user should export each separately)
      const csvRows = scope === 'all' ? getSessionsData() : rows
      content = rowsToCsv(csvRows)
    }
    fs.writeFileSync(filePath, content, 'utf8')
    return { ok: true, filePath, rowCount: Array.isArray(rows) ? rows.length : undefined }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

module.exports = { exportData }
