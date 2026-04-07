const { getCurrentSession, getLimitEstimates, getEarliestRequestInWindow, getWeeklyTokens } = require('./db')

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000

function getSessionStatus() {
  const session = getCurrentSession()

  // Find the true start of the current rate-limit window:
  // the earliest request in the last 5 hours across ALL sessions.
  // Claude's rate limit is a rolling 5-hour window, not per session file.
  const windowStart = Date.now() - FIVE_HOURS_MS
  const earliestInWindow = getEarliestRequestInWindow(windowStart)

  // Rolling window: reset happens at earliestInWindow + 5h
  const windowResetAt = earliestInWindow ? earliestInWindow + FIVE_HOURS_MS : null
  const remainingMs = windowResetAt ? Math.max(0, windowResetAt - Date.now()) : FIVE_HOURS_MS

  if (!session) {
    return {
      active: false,
      sessionId: null,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreation: 0,
      cacheRead: 0,
      requestCount: 0,
      model: null,
      elapsedMs: 0,
      remainingMs,
      windowResetAt,
      pct: 0,
      cost: 0,
      estimatedLimit: 250000,
      confidence: 0.1,
    }
  }

  // Session tokens: sum all tokens across all sessions in the current 5-hour window,
  // because rate limits are per-window, not per individual session file.
  const windowTokens = getWeeklyTokens(windowStart)
  const totalTokens = windowTokens.total_tokens

  // Find the session limit estimate
  const estimates = getLimitEstimates()
  const sessionEstimate =
    estimates.find(e => e.type === 'session' && e.model === 'all') ||
    estimates.find(e => e.type === 'session') ||
    { estimated_limit: 250000, confidence: 0.1 }

  const pct = sessionEstimate.estimated_limit > 0
    ? Math.min(100, (totalTokens / sessionEstimate.estimated_limit) * 100)
    : 0

  return {
    active: session.is_active === 1,
    sessionId: session.session_id,
    tokens: totalTokens,
    inputTokens: windowTokens.input_tokens,
    outputTokens: windowTokens.output_tokens,
    cacheCreation: windowTokens.cache_creation,
    cacheRead: windowTokens.cache_read,
    requestCount: session.request_count,
    model: session.model,
    project: session.project,
    startedAt: earliestInWindow,
    lastRequestAt: session.last_request_at,
    elapsedMs: earliestInWindow ? Date.now() - earliestInWindow : 0,
    remainingMs,
    windowResetAt,
    pct,
    estimatedLimit: sessionEstimate.estimated_limit,
    confidence: sessionEstimate.confidence,
    cost: windowTokens.total_cost,
  }
}

module.exports = { getSessionStatus }
