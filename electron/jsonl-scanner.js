const fs = require('fs')
const path = require('path')
const os = require('os')
const { insertRequests, getScanPosition, setScanPosition, refreshSession } = require('./db')

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects')
const SCAN_INTERVAL = 10000 // 10 seconds

let scanTimer = null
let watchers = []

// Decode project directory name to readable path.
// Claude Code encodes paths as: drive letter + '--' + path-with-dashes-as-separators
// e.g. d--CodingProjects-claude-stats → D:\CodingProjects\claude-stats
//
// Naive replace(/-/g, '\\') is wrong when folder names contain hyphens.
// Instead, walk the filesystem greedily: accumulate segments, committing each
// time the accumulated string exists on disk as a real directory.
function decodeProjectName(dirName) {
  const match = dirName.match(/^([a-zA-Z])--(.*)$/)
  if (!match) return dirName
  const drive = match[1].toUpperCase()
  const encoded = match[2]

  const parts = encoded.split('-')
  let resolved = `${drive}:\\`
  let pending = ''

  for (const part of parts) {
    pending = pending ? `${pending}-${part}` : part
    const candidate = path.join(resolved, pending)
    if (fs.existsSync(candidate)) {
      resolved = candidate
      pending = ''
    }
  }

  // If anything remains unmatched (e.g. the project was deleted), append as-is
  if (pending) resolved = path.join(resolved, pending)

  return resolved
}

// Parse a JSONL file from a given byte offset, returning new requests
function parseJsonlFrom(filePath, fromOffset) {
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch {
    return { requests: [], newOffset: fromOffset }
  }

  if (stat.size <= fromOffset) {
    return { requests: [], newOffset: fromOffset }
  }

  const buf = Buffer.alloc(stat.size - fromOffset)
  const fd = fs.openSync(filePath, 'r')
  try {
    fs.readSync(fd, buf, 0, buf.length, fromOffset)
  } finally {
    fs.closeSync(fd)
  }

  const text = buf.toString('utf8')
  const lines = text.split('\n')
  const requests = []
  const seen = new Map() // requestId → best record (keep last per requestId for final usage)

  for (const line of lines) {
    if (!line.trim()) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }

    // Only process assistant messages with usage data and a stop_reason
    if (obj.type !== 'assistant') continue
    if (!obj.requestId) continue
    if (!obj.message?.usage) continue

    const usage = obj.message.usage
    const stopReason = obj.message.stop_reason

    // We want the final record for each requestId (the one with stop_reason set)
    // Multiple lines share the same requestId; later lines have more complete usage
    const existing = seen.get(obj.requestId)
    if (existing) {
      // Prefer the one with a stop_reason, or the one with more output_tokens
      if (stopReason || usage.output_tokens > (existing.output_tokens || 0)) {
        seen.set(obj.requestId, {
          request_id: obj.requestId,
          session_id: obj.sessionId,
          model: obj.message.model,
          timestamp: new Date(obj.timestamp).getTime(),
          input_tokens: usage.input_tokens || 0,
          output_tokens: usage.output_tokens || 0,
          cache_creation_tokens: usage.cache_creation_input_tokens || 0,
          cache_read_tokens: usage.cache_read_input_tokens || 0,
        })
      }
    } else {
      seen.set(obj.requestId, {
        request_id: obj.requestId,
        session_id: obj.sessionId,
        model: obj.message.model,
        timestamp: new Date(obj.timestamp).getTime(),
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_creation_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_tokens: usage.cache_read_input_tokens || 0,
      })
    }
  }

  for (const req of seen.values()) {
    requests.push(req)
  }

  return { requests, newOffset: stat.size }
}

// Estimate cost in USD based on model and token counts
function estimateCost(req) {
  // Approximate pricing per million tokens (as of 2025)
  const pricing = {
    'claude-opus-4-6': { input: 15, output: 75, cacheCreation: 18.75, cacheRead: 1.5 },
    'claude-sonnet-4-6': { input: 3, output: 15, cacheCreation: 3.75, cacheRead: 0.3 },
    'claude-haiku-4-5': { input: 0.8, output: 4, cacheCreation: 1, cacheRead: 0.08 },
  }
  // Default to sonnet pricing
  const p = pricing[req.model] || pricing['claude-sonnet-4-6']
  return (
    (req.input_tokens * p.input +
      req.output_tokens * p.output +
      req.cache_creation_tokens * p.cacheCreation +
      req.cache_read_tokens * p.cacheRead) / 1_000_000
  )
}

// Fix previously mis-decoded project paths already stored in the DB.
// Runs once on startup: re-derives the correct project name for each
// project directory and patches requests + sessions rows where it differs.
function fixStoredProjectPaths() {
  if (!fs.existsSync(CLAUDE_DIR)) return

  const { getDb } = require('./db')
  const db = getDb()

  const updateRequests = db.prepare(`UPDATE requests SET project = ? WHERE project = ?`)
  const updateSessions = db.prepare(`UPDATE sessions SET project = ? WHERE project = ?`)

  const projectDirs = fs.readdirSync(CLAUDE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const projectDir of projectDirs) {
    const correct = decodeProjectName(projectDir.name)
    // The old (broken) name replaced ALL dashes with backslashes
    const broken = (() => {
      const m = projectDir.name.match(/^([a-zA-Z])--(.*)$/)
      if (!m) return null
      return `${m[1].toUpperCase()}:\\${m[2].replace(/-/g, '\\')}`
    })()

    if (broken && broken !== correct) {
      const r = updateRequests.run(correct, broken)
      const s = updateSessions.run(correct, broken)
      if (r.changes > 0 || s.changes > 0) {
        console.log(`[jsonl-scanner] Fixed project path: "${broken}" → "${correct}" (${r.changes} requests, ${s.changes} sessions)`)
      }
    }
  }
}

// Recursively find all .jsonl files under a directory
function findJsonlFiles(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findJsonlFiles(fullPath))
    } else if (entry.name.endsWith('.jsonl')) {
      results.push(fullPath)
    }
  }
  return results
}

// Scan all JSONL files in the Claude projects directory
function scanAll() {
  if (!fs.existsSync(CLAUDE_DIR)) return

  const projectDirs = fs.readdirSync(CLAUDE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())

  const touchedSessions = new Set()

  for (const projectDir of projectDirs) {
    const projectPath = path.join(CLAUDE_DIR, projectDir.name)
    const projectName = decodeProjectName(projectDir.name)

    let jsonlFiles
    try {
      jsonlFiles = findJsonlFiles(projectPath)
    } catch {
      continue
    }

    for (const filePath of jsonlFiles) {
      // The session UUID is the filename without extension
      const sessionId = path.basename(filePath, '.jsonl')
      const lastOffset = getScanPosition(filePath)
      const { requests, newOffset } = parseJsonlFrom(filePath, lastOffset)

      if (requests.length === 0) continue

      // Add project and cost to each request
      const enriched = requests.map(r => ({
        ...r,
        project: projectName,
        cost_usd: estimateCost(r),
        source: 'jsonl',
      }))

      insertRequests(enriched)
      setScanPosition(filePath, newOffset)
      touchedSessions.add(sessionId)
    }
  }

  // Refresh session aggregates for touched sessions
  for (const sid of touchedSessions) {
    refreshSession(sid)
  }

  if (touchedSessions.size > 0) {
    console.log(`[jsonl-scanner] Processed ${touchedSessions.size} session(s)`)
  }
}

// Start watching for changes and scanning periodically
function startScanner() {
  // Fix any mis-decoded project paths from previous versions
  fixStoredProjectPaths()

  // Initial full scan (backfill)
  console.log('[jsonl-scanner] Starting initial scan...')
  scanAll()
  console.log('[jsonl-scanner] Initial scan complete')

  // Watch for new files / changes
  if (fs.existsSync(CLAUDE_DIR)) {
    try {
      const watcher = fs.watch(CLAUDE_DIR, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.jsonl')) {
          // Debounce: the periodic scan will pick it up
        }
      })
      watchers.push(watcher)
    } catch (e) {
      console.error('[jsonl-scanner] Watch error:', e.message)
    }
  }

  // Periodic scan
  scanTimer = setInterval(scanAll, SCAN_INTERVAL)
}

function stopScanner() {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
  for (const w of watchers) {
    try { w.close() } catch {}
  }
  watchers = []
}

module.exports = { startScanner, stopScanner, scanAll }
