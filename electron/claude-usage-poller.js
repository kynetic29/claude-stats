let latestUsage = null
let pollInterval = null
let pollError = null
let currentOrgId = null

/**
 * Start polling the usage endpoint every intervalMs (default 30s).
 * Uses claude-auth's fetchUsage which handles cookies via Electron net module.
 */
function startPolling(orgId, intervalMs = 30000) {
  stopPolling()
  currentOrgId = orgId

  async function poll() {
    try {
      const { fetchUsage } = require('./claude-auth')
      const data = await fetchUsage(orgId)
      latestUsage = data
      pollError = null
    } catch (e) {
      console.error('[claude-usage] Poll error:', e.message)
      if (e.message === 'auth_expired') {
        pollError = 'auth_expired'
        stopPolling()
      } else {
        pollError = e.message
      }
    }
  }

  // Poll immediately, then on interval
  poll()
  pollInterval = setInterval(poll, intervalMs)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/**
 * Get the latest polled usage data, or null if unavailable.
 */
function getLatestUsage() {
  return latestUsage
}

/**
 * Get any polling error (e.g. 'auth_expired'), or null.
 */
function getPollError() {
  return pollError
}

module.exports = { startPolling, stopPolling, getLatestUsage, getPollError }
