const {
  getLimitEstimates,
  upsertLimitEstimate,
  insertLimitObservation,
  getLimitObservations,
  getCurrentSession,
  getWeeklyTokens,
  getEarliestRequestInWindow,
} = require('./db')

// Record that the user hit a rate limit right now
function recordLimitHit(type, source = 'manual') {
  const now = Date.now()

  if (type === 'session') {
    const windowStart = now - (5 * 60 * 60 * 1000)
    const windowTokens = getWeeklyTokens(windowStart)
    const tokens = windowTokens.total_tokens
    // Always use 'all' — the limit is model-agnostic (opus+sonnet share the same window)
    insertLimitObservation(now, 'session', 'all', tokens, source)
    recalcEstimate('session', 'all')
    return { type: 'session', tokens, model: 'all' }
  }

  if (type === 'weekly') {
    const weekStart = getWeekStartTimestamp()
    const weekly = getWeeklyTokens(weekStart)
    const tokens = weekly.total_tokens
    insertLimitObservation(now, 'weekly', 'all', tokens, source)
    recalcEstimate('weekly', 'all')
    return { type: 'weekly', tokens }
  }

  return null
}

// Recalculate the estimated limit based on all observations
function recalcEstimate(type, model) {
  const observations = getLimitObservations(100)
    .filter(o => o.type === type && (model === 'all' || o.model === model))

  if (observations.length === 0) return

  const values = observations.map(o => o.tokens_at_hit).sort((a, b) => a - b)
  const n = values.length

  // Use 10th percentile (conservative — better to warn early)
  const p10Index = Math.max(0, Math.floor(n * 0.1))
  const estimatedLimit = values[p10Index]

  // Confidence based on observation count and consistency
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  const cv = mean > 0 ? stdDev / mean : 1 // coefficient of variation

  // More observations + lower variance = higher confidence
  const countFactor = Math.min(n / 10, 1) // max out at 10 observations
  const consistencyFactor = Math.max(0, 1 - cv)
  const confidence = Math.max(0.1, Math.min(0.95, countFactor * 0.5 + consistencyFactor * 0.5))

  upsertLimitEstimate({
    type,
    model,
    estimated_limit: estimatedLimit,
    confidence,
    observation_count: n,
    last_updated: Date.now(),
  })
}

// Get the start of the current week (Monday at configured time)
function getWeekStartTimestamp(resetDay = 1, resetHour = 6) {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = day === 0 ? 6 : day - resetDay
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - diff)
  weekStart.setHours(resetHour, 0, 0, 0)
  // If we haven't reached reset time yet today and it's the reset day, use last week
  if (weekStart > now) {
    weekStart.setDate(weekStart.getDate() - 7)
  }
  return weekStart.getTime()
}

// Get time until next weekly reset
function getTimeUntilWeeklyReset(resetDay = 1, resetHour = 6) {
  const now = new Date()
  const next = new Date(now)
  const day = now.getDay()
  let daysUntil = resetDay - day
  if (daysUntil < 0) daysUntil += 7
  if (daysUntil === 0 && now.getHours() >= resetHour) daysUntil = 7
  next.setDate(next.getDate() + daysUntil)
  next.setHours(resetHour, 0, 0, 0)
  return next.getTime() - now.getTime()
}

// Check if a session might have hit a rate limit (gap detection)
function checkForInferredLimits(session) {
  if (!session) return false

  const now = Date.now()
  const fiveHours = 5 * 60 * 60 * 1000
  const windowStart = now - fiveHours
  const earliest = getEarliestRequestInWindow(windowStart)
  if (!earliest) return false

  const elapsed = now - earliest

  // If the rolling window is nearly exhausted (90%+ of 5 hours), might be at limit
  if (elapsed >= fiveHours * 0.9) {
    const windowTokens = getWeeklyTokens(windowStart)
    const tokens = windowTokens.total_tokens
    if (tokens > 0) {
      // Check if we already recorded a similar observation recently
      const recent = getLimitObservations(5)
      const alreadyRecorded = recent.some(o =>
        o.type === 'session' &&
        Math.abs(o.tokens_at_hit - tokens) < tokens * 0.05 &&
        Date.now() - o.timestamp < 60 * 60 * 1000
      )
      if (!alreadyRecorded) {
        insertLimitObservation(now, 'session', 'all', tokens, 'inferred')
        recalcEstimate('session', 'all')
        return true
      }
    }
  }
  return false
}

module.exports = {
  recordLimitHit,
  recalcEstimate,
  getWeekStartTimestamp,
  getTimeUntilWeeklyReset,
  checkForInferredLimits,
}
