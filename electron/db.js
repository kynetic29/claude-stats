const path = require('path')
const { app } = require('electron')

let db = null

function getDb() {
  if (db) return db
  const Database = require('better-sqlite3')
  const dbPath = path.join(app.getPath('userData'), 'claude-stats.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  migrate(db)
  return db
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      request_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project TEXT,
      model TEXT,
      timestamp INTEGER NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      source TEXT DEFAULT 'jsonl'
    );

    CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
    CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      project TEXT,
      model TEXT,
      first_request_at INTEGER,
      last_request_at INTEGER,
      request_count INTEGER DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cache_creation INTEGER DEFAULT 0,
      total_cache_read INTEGER DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      is_active INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS limit_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      model TEXT,
      tokens_at_hit INTEGER NOT NULL,
      source TEXT DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS limit_estimates (
      type TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'all',
      estimated_limit INTEGER NOT NULL,
      confidence REAL DEFAULT 0.1,
      observation_count INTEGER DEFAULT 0,
      last_updated INTEGER,
      PRIMARY KEY (type, model)
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS scan_positions (
      file_path TEXT PRIMARY KEY,
      last_byte_offset INTEGER DEFAULT 0,
      last_scan_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      date TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      data TEXT,
      PRIMARY KEY (date, actor_id)
    );
  `)

  // Remove any model-specific rows — we only use 'all' since limits are model-agnostic
  const hadModelSpecific = db.prepare(`SELECT COUNT(*) as n FROM limit_observations WHERE model != 'all'`).get().n > 0
  db.prepare(`DELETE FROM limit_estimates WHERE model != 'all'`).run()
  db.prepare(`UPDATE limit_observations SET model = 'all' WHERE model != 'all'`).run()

  // Seed default limit estimates if empty
  const count = db.prepare('SELECT COUNT(*) as n FROM limit_estimates').get()
  if (count.n === 0) {
    const seed = db.prepare(`
      INSERT OR IGNORE INTO limit_estimates (type, model, estimated_limit, confidence, observation_count, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const now = Date.now()
    // Community-estimated defaults for Pro tier
    seed.run('session', 'all', 250000, 0.1, 0, now)
    seed.run('weekly', 'all', 2500000, 0.1, 0, now)
  }
}

// ── Prepared statements (lazy-initialized) ─────────────────────────────────

let stmts = null

function getStmts() {
  if (stmts) return stmts
  const d = getDb()
  stmts = {
    upsertRequest: d.prepare(`
      INSERT INTO requests (request_id, session_id, project, model, timestamp, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd, source)
      VALUES (@request_id, @session_id, @project, @model, @timestamp, @input_tokens, @output_tokens, @cache_creation_tokens, @cache_read_tokens, @cost_usd, @source)
      ON CONFLICT(request_id) DO UPDATE SET
        input_tokens = CASE WHEN excluded.source = 'jsonl' OR requests.source != 'jsonl' THEN excluded.input_tokens ELSE requests.input_tokens END,
        output_tokens = CASE WHEN excluded.source = 'jsonl' OR requests.source != 'jsonl' THEN excluded.output_tokens ELSE requests.output_tokens END,
        cache_creation_tokens = CASE WHEN excluded.source = 'jsonl' OR requests.source != 'jsonl' THEN excluded.cache_creation_tokens ELSE requests.cache_creation_tokens END,
        cache_read_tokens = CASE WHEN excluded.source = 'jsonl' OR requests.source != 'jsonl' THEN excluded.cache_read_tokens ELSE requests.cache_read_tokens END,
        cost_usd = CASE WHEN excluded.source = 'jsonl' OR requests.source != 'jsonl' THEN excluded.cost_usd ELSE requests.cost_usd END,
        model = COALESCE(excluded.model, requests.model),
        source = CASE WHEN excluded.source = 'jsonl' THEN 'jsonl' ELSE requests.source END
    `),

    refreshSession: d.prepare(`
      INSERT INTO sessions (session_id, project, model, first_request_at, last_request_at, request_count,
        total_input_tokens, total_output_tokens, total_cache_creation, total_cache_read, total_cost_usd, is_active)
      SELECT
        session_id,
        MAX(project) as project,
        MAX(model) as model,
        MIN(timestamp) as first_request_at,
        MAX(timestamp) as last_request_at,
        COUNT(*) as request_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cache_creation_tokens) as total_cache_creation,
        SUM(cache_read_tokens) as total_cache_read,
        SUM(cost_usd) as total_cost_usd,
        CASE WHEN (? - MAX(timestamp)) < 300000 THEN 1 ELSE 0 END as is_active
      FROM requests
      WHERE session_id = ?
      GROUP BY session_id
      ON CONFLICT(session_id) DO UPDATE SET
        project = excluded.project,
        model = excluded.model,
        first_request_at = excluded.first_request_at,
        last_request_at = excluded.last_request_at,
        request_count = excluded.request_count,
        total_input_tokens = excluded.total_input_tokens,
        total_output_tokens = excluded.total_output_tokens,
        total_cache_creation = excluded.total_cache_creation,
        total_cache_read = excluded.total_cache_read,
        total_cost_usd = excluded.total_cost_usd,
        is_active = excluded.is_active
    `),

    getSessions: d.prepare(`
      SELECT * FROM sessions ORDER BY last_request_at DESC LIMIT ?
    `),

    getSessionsSince: d.prepare(`
      SELECT * FROM sessions WHERE last_request_at >= ? ORDER BY last_request_at DESC
    `),

    getWeeklyTokens: d.prepare(`
      SELECT
        COALESCE(SUM(total_input_tokens + total_output_tokens + total_cache_creation), 0) as total_tokens,
        COALESCE(SUM(total_input_tokens), 0) as input_tokens,
        COALESCE(SUM(total_output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_cache_creation), 0) as cache_creation,
        COALESCE(SUM(total_cache_read), 0) as cache_read,
        COALESCE(SUM(total_cost_usd), 0) as total_cost,
        COUNT(*) as session_count
      FROM sessions WHERE first_request_at >= ?
    `),

    getTokensInWindow: d.prepare(`
      SELECT
        COALESCE(SUM(input_tokens + output_tokens + cache_creation_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(cache_creation_tokens), 0) as cache_creation,
        COALESCE(SUM(cache_read_tokens), 0) as cache_read,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(*) as request_count
      FROM requests WHERE timestamp >= ?
    `),

    getCurrentSession: d.prepare(`
      SELECT * FROM sessions ORDER BY last_request_at DESC LIMIT 1
    `),

    getEarliestRequestInWindow: d.prepare(`
      SELECT MIN(timestamp) as earliest FROM requests WHERE timestamp >= ?
    `),

    getRequestCountToday: d.prepare(`
      SELECT COUNT(*) as n FROM requests WHERE timestamp >= ?
    `),

    getRequestCountWeek: d.prepare(`
      SELECT COUNT(*) as n FROM requests WHERE timestamp >= ?
    `),

    getDailyBreakdown: d.prepare(`
      SELECT
        CAST(timestamp / 86400000 AS INTEGER) as day_bucket,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cache_creation_tokens) as cache_creation,
        COUNT(*) as request_count,
        model
      FROM requests
      WHERE timestamp >= ?
      GROUP BY day_bucket, model
      ORDER BY day_bucket
    `),

    getLimitEstimates: d.prepare(`SELECT * FROM limit_estimates`),

    upsertLimitEstimate: d.prepare(`
      INSERT INTO limit_estimates (type, model, estimated_limit, confidence, observation_count, last_updated)
      VALUES (@type, @model, @estimated_limit, @confidence, @observation_count, @last_updated)
      ON CONFLICT(type, model) DO UPDATE SET
        estimated_limit = excluded.estimated_limit,
        confidence = excluded.confidence,
        observation_count = excluded.observation_count,
        last_updated = excluded.last_updated
    `),

    insertLimitObservation: d.prepare(`
      INSERT INTO limit_observations (timestamp, type, model, tokens_at_hit, source)
      VALUES (?, ?, ?, ?, ?)
    `),

    getLimitObservations: d.prepare(`
      SELECT * FROM limit_observations ORDER BY timestamp DESC LIMIT ?
    `),

    getScanPosition: d.prepare(`
      SELECT last_byte_offset FROM scan_positions WHERE file_path = ?
    `),

    upsertScanPosition: d.prepare(`
      INSERT INTO scan_positions (file_path, last_byte_offset, last_scan_at)
      VALUES (?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        last_byte_offset = excluded.last_byte_offset,
        last_scan_at = excluded.last_scan_at
    `),

    getConfig: d.prepare(`SELECT value FROM config WHERE key = ?`),

    setConfig: d.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `),

    deleteConfig: d.prepare(`DELETE FROM config WHERE key = ?`),

    getAllConfig: d.prepare(`SELECT key, value FROM config`),

    upsertDailySummary: d.prepare(`
      INSERT INTO daily_summaries (date, actor_id, data)
      VALUES (?, ?, ?)
      ON CONFLICT(date, actor_id) DO UPDATE SET data = excluded.data
    `),

    getDailySummaries: d.prepare(`
      SELECT * FROM daily_summaries ORDER BY date DESC LIMIT ?
    `),

    getDistinctSessionIds: d.prepare(`
      SELECT DISTINCT session_id FROM requests
    `),

    getRequestsBySessionId: d.prepare(`
      SELECT * FROM requests WHERE session_id = ? ORDER BY timestamp ASC
    `),

    pruneOldRequests: d.prepare(`
      DELETE FROM requests WHERE timestamp < ?
    `),
  }
  return stmts
}

// ── Public API ──────────────────────────────────────────────────────────────

function insertRequest(data) {
  getStmts().upsertRequest.run(data)
}

function insertRequests(batch) {
  const s = getStmts()
  const tx = getDb().transaction((items) => {
    for (const item of items) s.upsertRequest.run(item)
  })
  tx(batch)
}

function refreshSession(sessionId) {
  getStmts().refreshSession.run(Date.now(), sessionId)
}

function refreshAllSessions() {
  const ids = getStmts().getDistinctSessionIds.all()
  const s = getStmts()
  const now = Date.now()
  const tx = getDb().transaction(() => {
    for (const { session_id } of ids) {
      s.refreshSession.run(now, session_id)
    }
  })
  tx()
}

function getSessions(limit = 100) {
  return getStmts().getSessions.all(limit)
}

function getSessionsSince(timestamp) {
  return getStmts().getSessionsSince.all(timestamp)
}

function getWeeklyTokens(weekStartTimestamp) {
  return getStmts().getWeeklyTokens.get(weekStartTimestamp)
}

function getTokensInWindow(windowStartTimestamp) {
  return getStmts().getTokensInWindow.get(windowStartTimestamp)
}

function getCurrentSession() {
  return getStmts().getCurrentSession.get()
}

function getEarliestRequestInWindow(windowStartTimestamp) {
  const row = getStmts().getEarliestRequestInWindow.get(windowStartTimestamp)
  return row ? row.earliest : null
}

function getRequestCountToday(todayStartTimestamp) {
  return getStmts().getRequestCountToday.get(todayStartTimestamp).n
}

function getRequestCountWeek(weekStartTimestamp) {
  return getStmts().getRequestCountWeek.get(weekStartTimestamp).n
}

function getDailyBreakdown(sinceTimestamp) {
  return getStmts().getDailyBreakdown.all(sinceTimestamp)
}

function getRequestsBySessionId(sessionId) {
  return getStmts().getRequestsBySessionId.all(sessionId)
}

function getLimitEstimates() {
  return getStmts().getLimitEstimates.all()
}

function upsertLimitEstimate(data) {
  getStmts().upsertLimitEstimate.run(data)
}

function insertLimitObservation(timestamp, type, model, tokens, source) {
  getStmts().insertLimitObservation.run(timestamp, type, model, tokens, source)
}

function getLimitObservations(limit = 50) {
  return getStmts().getLimitObservations.all(limit)
}

function getScanPosition(filePath) {
  const row = getStmts().getScanPosition.get(filePath)
  return row ? row.last_byte_offset : 0
}

function setScanPosition(filePath, offset) {
  getStmts().upsertScanPosition.run(filePath, offset, Date.now())
}

function getConfigValue(key) {
  const row = getStmts().getConfig.get(key)
  return row ? JSON.parse(row.value) : null
}

function setConfigValue(key, value) {
  getStmts().setConfig.run(key, JSON.stringify(value))
}

function deleteConfigValue(key) {
  getStmts().deleteConfig.run(key)
}

function getAllConfig() {
  const rows = getStmts().getAllConfig.all()
  const config = {}
  for (const { key, value } of rows) {
    config[key] = JSON.parse(value)
  }
  return config
}

function upsertDailySummary(date, actorId, data) {
  getStmts().upsertDailySummary.run(date, actorId, JSON.stringify(data))
}

function getDailySummaries(limit = 90) {
  return getStmts().getDailySummaries.all(limit).map(r => ({
    ...r,
    data: JSON.parse(r.data),
  }))
}

function pruneOldRequests(olderThanMs) {
  const cutoff = Date.now() - olderThanMs
  getStmts().pruneOldRequests.run(cutoff)
}

function close() {
  if (db) {
    db.close()
    db = null
    stmts = null
  }
}

module.exports = {
  getDb,
  insertRequest,
  insertRequests,
  refreshSession,
  refreshAllSessions,
  getSessions,
  getSessionsSince,
  getWeeklyTokens,
  getTokensInWindow,
  getCurrentSession,
  getEarliestRequestInWindow,
  getRequestCountToday,
  getRequestCountWeek,
  getDailyBreakdown,
  getRequestsBySessionId,
  getLimitEstimates,
  upsertLimitEstimate,
  insertLimitObservation,
  getLimitObservations,
  getScanPosition,
  setScanPosition,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  getAllConfig,
  upsertDailySummary,
  getDailySummaries,
  pruneOldRequests,
  close,
}
