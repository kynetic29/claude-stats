const { getCurrentSession, getLimitEstimates, getEarliestRequestInWindow, getTokensInWindow } = require('./db')
const { getLatestUsage } = require('./claude-usage-poller')

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const BURN_WINDOW_MS = 15 * 60 * 1000 // 15-minute rolling window for burn rate

/**
 * Compute current token burn rate from the last 15 minutes of requests.
 * Returns tokens per millisecond. Returns 0 if no recent activity (idle).
 */
function computeBurnRate(windowMs = BURN_WINDOW_MS) {
  const windowStart = Date.now() - windowMs
  const row = getTokensInWindow(windowStart)
  const tokens = row.total_tokens || 0
  if (tokens === 0) return 0
  return tokens / windowMs
}

/**
 * Given current tokens, a limit (or pct+tokens for API path), and a burn
 * rate, compute ETA in ms until the limit is reached. Returns null if idle.
 */
function computeEta(currentTokens, limitTokens, burnRatePerMs) {
  if (burnRatePerMs <= 0 || limitTokens <= 0) return null
  const remaining = limitTokens - currentTokens
  if (remaining <= 0) return 0
  return remaining / burnRatePerMs
}

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

  // Local token data: query requests directly so long-running sessions
  // (started > 5h ago) are still counted correctly within the rolling window.
  const windowTokens = getTokensInWindow(windowStart)
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
      eta: null,
      etaApprox: true,
    }
  }

  const burnRate = computeBurnRate()

  if (hasApiData) {
    // Use authoritative data from claude.ai usage API
    const apiResetAt = new Date(apiUsage.five_hour.resets_at).getTime()
    const apiRemainingMs = Math.max(0, apiResetAt - Date.now())
    const apiPct = apiUsage.five_hour.utilization ?? 0

    // Derive limit from API utilization percentage + local token count
    const derivedLimit = apiPct > 0 ? totalTokens * 100 / apiPct : 0
    const eta = computeEta(totalTokens, derivedLimit, burnRate)

    return {
      active: session ? session.is_active === 1 : false,
      sessionId: session?.session_id || null,
      tokens: totalTokens,
      inputTokens: windowTokens.input_tokens,
      outputTokens: windowTokens.output_tokens,
      cacheCreation: windowTokens.cache_creation,
      cacheRead: windowTokens.cache_read,
      requestCount: windowTokens.request_count,
      model: session?.model || null,
      project: session?.project || null,
      startedAt: earliestInWindow,
      lastRequestAt: session?.last_request_at || null,
      elapsedMs: earliestInWindow ? Date.now() - earliestInWindow : 0,
      remainingMs: apiRemainingMs,
      windowResetAt: apiResetAt,
      pct: apiPct,
      estimatedLimit: null,
      confidence: 1.0,
      cost: windowTokens.total_cost,
      source: 'claude-api',
      eta,
      etaApprox: false,
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

  const eta = computeEta(totalTokens, sessionEstimate.estimated_limit, burnRate)

  return {
    active: session.is_active === 1,
    sessionId: session.session_id,
    tokens: totalTokens,
    inputTokens: windowTokens.input_tokens,
    outputTokens: windowTokens.output_tokens,
    cacheCreation: windowTokens.cache_creation,
    cacheRead: windowTokens.cache_read,
    requestCount: windowTokens.request_count,
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
    eta,
    etaApprox: true,
  }
}

module.exports = { getSessionStatus, computeBurnRate, computeEta }
