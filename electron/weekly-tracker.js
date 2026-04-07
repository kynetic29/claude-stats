const { getWeeklyTokens, getLimitEstimates, getRequestCountWeek, getRequestCountToday } = require('./db')
const { getWeekStartTimestamp, getTimeUntilWeeklyReset } = require('./limit-estimator')

function getWeeklyStatus(resetDay = 1, resetHour = 6) {
  const weekStart = getWeekStartTimestamp(resetDay, resetHour)
  const weekly = getWeeklyTokens(weekStart)

  const estimates = getLimitEstimates()
  const weeklyEstimate =
    estimates.find(e => e.type === 'weekly' && e.model === 'all') ||
    estimates.find(e => e.type === 'weekly') ||
    { estimated_limit: 2500000, confidence: 0.1 }

  const pct = weeklyEstimate.estimated_limit > 0
    ? Math.min(100, (weekly.total_tokens / weeklyEstimate.estimated_limit) * 100)
    : 0

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  return {
    tokens: weekly.total_tokens,
    inputTokens: weekly.input_tokens,
    outputTokens: weekly.output_tokens,
    cacheCreation: weekly.cache_creation,
    cacheRead: weekly.cache_read,
    cost: weekly.total_cost,
    sessionCount: weekly.session_count,
    requestCountWeek: getRequestCountWeek(weekStart),
    requestCountToday: getRequestCountToday(todayStart.getTime()),
    pct,
    estimatedLimit: weeklyEstimate.estimated_limit,
    confidence: weeklyEstimate.confidence,
    resetIn: getTimeUntilWeeklyReset(resetDay, resetHour),
    weekStart,
  }
}

module.exports = { getWeeklyStatus }
