/**
 * Minimal OTLP HTTP/JSON receiver on port 4318.
 *
 * Claude Code sends metrics to  POST /v1/metrics
 * and log events to             POST /v1/logs
 */

const http = require('http')
const { insertRequest, refreshSession } = require('./db')
const { estimateCostForModel } = require('./normalizer')

const PORT = 4318

// ── Attribute helpers ─────────────────────────────────────────────────────────

function attrVal(attributes, key) {
  const entry = (attributes || []).find(a => a.key === key)
  if (!entry) return null
  const v = entry.value
  if (v.intValue !== undefined) return Number(v.intValue)
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.stringValue !== undefined) return v.stringValue
  if (v.boolValue !== undefined) return v.boolValue
  return null
}

// ── Metrics handler (/v1/metrics) ─────────────────────────────────────────────
// Accumulates claude_code.token.usage by session, then upserts per session batch.
// OTEL metrics are cumulative counters — we store per-batch deltas as synthetic request records.

function handleMetrics(payload) {
  const bySession = new Map()

  for (const rm of payload.resourceMetrics || []) {
    const resAttrs = rm.resource?.attributes || []
    const resSessionId = attrVal(resAttrs, 'session.id')

    for (const sm of rm.scopeMetrics || []) {
      for (const metric of sm.metrics || []) {
        const points = metric.sum?.dataPoints || metric.gauge?.dataPoints || []

        for (const dp of points) {
          const dpAttrs = dp.attributes || []
          const sessionId = attrVal(dpAttrs, 'session.id') || resSessionId
          if (!sessionId) continue

          if (!bySession.has(sessionId)) {
            bySession.set(sessionId, {
              input: 0, output: 0, cacheCreation: 0, cacheRead: 0,
              model: null, timestamp: Date.now(),
            })
          }
          const s = bySession.get(sessionId)

          const value = Number(dp.asInt ?? dp.asDouble ?? 0)
          const type = attrVal(dpAttrs, 'type')
          const model = attrVal(dpAttrs, 'model')
          if (model) s.model = model

          if (metric.name === 'claude_code.token.usage') {
            if (type === 'input') s.input += value
            else if (type === 'output') s.output += value
            else if (type === 'cacheCreation') s.cacheCreation += value
            else if (type === 'cacheRead') s.cacheRead += value
          }
        }
      }
    }
  }

  // Create synthetic request records from metric batches
  for (const [sessionId, data] of bySession) {
    if (data.input === 0 && data.output === 0) continue
    const requestId = `otel-metric-${sessionId}-${data.timestamp}`
    insertRequest({
      request_id: requestId,
      session_id: sessionId,
      project: null,
      model: data.model,
      timestamp: data.timestamp,
      input_tokens: data.input,
      output_tokens: data.output,
      cache_creation_tokens: data.cacheCreation,
      cache_read_tokens: data.cacheRead,
      cost_usd: estimateCostForModel(data.model, data.input, data.output, data.cacheCreation, data.cacheRead),
      source: 'otel',
    })
    refreshSession(sessionId)
  }
}

// ── Logs handler (/v1/logs) ───────────────────────────────────────────────────
// Captures claude_code.api_request events with per-request token counts

function handleLogs(payload) {
  const touchedSessions = new Set()

  for (const rl of payload.resourceLogs || []) {
    const resAttrs = rl.resource?.attributes || []
    const resSessionId = attrVal(resAttrs, 'session.id')

    for (const sl of rl.scopeLogs || []) {
      for (const lr of sl.logRecords || []) {
        const logAttrs = lr.attributes || []
        const eventName = lr.body?.stringValue || attrVal(logAttrs, 'event.name') || ''

        // Only process API request events
        if (eventName !== 'claude_code.api_request') continue

        const sessionId = attrVal(logAttrs, 'session.id') || resSessionId
        if (!sessionId) continue

        const model = attrVal(logAttrs, 'model') || 'unknown'
        const inputTokens = Number(attrVal(logAttrs, 'input_tokens') || 0)
        const outputTokens = Number(attrVal(logAttrs, 'output_tokens') || 0)
        const cacheRead = Number(attrVal(logAttrs, 'cache_read_tokens') || 0)
        const cacheCreation = Number(attrVal(logAttrs, 'cache_creation_tokens') || 0)
        const costUsd = Number(attrVal(logAttrs, 'cost_usd') || 0)
        const promptId = attrVal(logAttrs, 'prompt.id')

        const timestamp = lr.timeUnixNano
          ? Number(BigInt(lr.timeUnixNano) / 1_000_000n)
          : Date.now()

        const requestId = promptId || `otel-log-${sessionId}-${timestamp}`

        insertRequest({
          request_id: requestId,
          session_id: sessionId,
          project: null,
          model,
          timestamp,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_tokens: cacheCreation,
          cache_read_tokens: cacheRead,
          cost_usd: costUsd || estimateCostForModel(model, inputTokens, outputTokens, cacheCreation, cacheRead),
          source: 'otel',
        })
        touchedSessions.add(sessionId)
      }
    }
  }

  for (const sid of touchedSessions) {
    refreshSession(sid)
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const HANDLERS = {
  '/v1/metrics': handleMetrics,
  '/v1/logs': handleLogs,
  '/v1/traces': () => {}, // Accept but ignore traces
}

let server = null

function startReceiver(port = PORT) {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const handler = HANDLERS[req.url]
      if (req.method !== 'POST' || !handler) {
        res.writeHead(404)
        res.end()
        return
      }

      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          handler(payload)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{}')
        } catch (e) {
          console.error(`[receiver] parse error on ${req.url}:`, e.message)
          res.writeHead(400)
          res.end()
        }
      })
    })

    server.on('error', e => {
      if (e.code === 'EADDRINUSE') {
        console.error(`[receiver] Port ${port} already in use — trying ${port + 1}`)
        server.close()
        startReceiver(port + 1).then(resolve).catch(reject)
      } else {
        console.error('[receiver] error:', e.message)
        reject(e)
      }
    })

    server.listen(port, '127.0.0.1', () => {
      console.log(`[receiver] Listening on http://127.0.0.1:${port}`)
      resolve(port)
    })
  })
}

function stopReceiver() {
  if (server) {
    server.close()
    server = null
  }
}

module.exports = { startReceiver, stopReceiver }
