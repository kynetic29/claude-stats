const { getCurrentSession, getLimitEstimates, getEarliestRequestInWindow, getWeeklyTokens } = require('./db')
const { getLatestUsage } = require('./claude-usage-poller')

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

  // Local token data for detail breakdown
  const windowTokens = getWeeklyTokens(windowStart)
  const totalTokens = windowTokens.total_tokens

  // Check for authoritative API data from claude.ai
  const apiUsage = getLatestUsage()
  const hasApiData = apiUsage && apiUsage.five_hour != null

  if (!session && !hasApiData) {
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
      source: 'local',
    }
  }

  if (hasApiData) {
    // Use authoritative data from claude.ai usage API
    const apiResetAt = new Date(apiUsage.five_hour.resets_at).getTime()
    const apiRemainingMs = Math.max(0, apiResetAt - Date.now())

    return {
      active: session ? session.is_active === 1 : false,
      sessionId: session?.session_id || null,
      tokens: totalTokens,
      inputTokens: windowTokens.input_tokens,
      outputTokens: windowTokens.output_tokens,
      cacheCreation: windowTokens.cache_creation,
      cacheRead: windowTokens.cache_read,
      requestCount: session?.request_count || 0,
      model: session?.model || null,
      project: session?.project || null,
      startedAt: earliestInWindow,
      lastRequestAt: session?.last_request_at || null,
      elapsedMs: earliestInWindow ? Date.now() - earliestInWindow : 0,
      remainingMs: apiRemainingMs,
      windowResetAt: apiResetAt,
      pct: apiUsage.five_hour.utilization,
      estimatedLimit: null,
      confidence: 1.0,
      cost: windowTokens.total_cost,
      source: 'claude-api',
    }
  }

  // Fallback: local estimation
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
    source: 'local',
  }
}

module.exports = { getSessionStatus }
