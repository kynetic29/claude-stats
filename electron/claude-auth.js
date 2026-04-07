const { BrowserWindow, session } = require('electron')

const PARTITION = 'persist:claude-auth'
const CLAUDE_URL = 'https://claude.ai'

let cachedOrgId = null
let hiddenWindow = null

function getAuthSession() {
  return session.fromPartition(PARTITION)
}

/**
 * Get or create a hidden BrowserWindow that shares the auth session.
 * All API requests go through this window's webContents.executeJavaScript,
 * which means cookies, CSRF tokens, origin headers, etc. are all handled
 * identically to a real browser — no 403s.
 */
function getHiddenWindow() {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) return hiddenWindow

  hiddenWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    webPreferences: {
      session: getAuthSession(),
      contextIsolation: false,
      nodeIntegration: false,
    },
  })

  // Load a minimal page on claude.ai so fetch calls are same-origin
  hiddenWindow.loadURL(`${CLAUDE_URL}/favicon.ico`)

  hiddenWindow.on('closed', () => { hiddenWindow = null })
  return hiddenWindow
}

/**
 * Execute a fetch call from inside the hidden window's browser context.
 * Returns { status, body } where body is the parsed JSON or raw string.
 */
async function browserFetch(path) {
  const win = getHiddenWindow()

  // Wait for the page to be at least minimally loaded
  if (win.webContents.isLoading()) {
    await new Promise(resolve => win.webContents.once('did-finish-load', resolve))
  }

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const resp = await fetch('${path}');
        const text = await resp.text();
        return { status: resp.status, body: text };
      } catch (e) {
        return { status: 0, body: e.message };
      }
    })()
  `)

  return result
}

/**
 * Fetch the org ID.
 */
async function fetchOrgId() {
  const ses = getAuthSession()
  try {
    // Try the lastActiveOrg cookie first (fastest)
    const cookies = await ses.cookies.get({ url: CLAUDE_URL })
    const orgCookie = cookies.find(c => c.name === 'lastActiveOrg')
    if (orgCookie) {
      console.log('[claude-auth] Found org ID from cookie:', orgCookie.value)
      return orgCookie.value
    }

    // Fallback: call the organizations endpoint via browser context
    console.log('[claude-auth] No lastActiveOrg cookie, trying API...')
    const resp = await browserFetch('/api/organizations')
    if (resp.status === 200) {
      const orgs = JSON.parse(resp.body)
      if (Array.isArray(orgs) && orgs.length > 0) {
        const orgId = orgs[0].uuid || orgs[0].id
        console.log('[claude-auth] Got org ID from API:', orgId)
        return orgId
      }
    }
    console.log('[claude-auth] Could not determine org ID, status:', resp.status)
    return null
  } catch (e) {
    console.error('[claude-auth] fetchOrgId error:', e.message)
    return null
  }
}

/**
 * Test if the session can access the usage API for the given org.
 */
async function testUsageAccess(orgId) {
  try {
    const resp = await browserFetch(`/api/organizations/${orgId}/usage`)
    console.log('[claude-auth] testUsageAccess: HTTP', resp.status)
    return resp.status === 200
  } catch (e) {
    console.error('[claude-auth] testUsageAccess error:', e.message)
    return false
  }
}

/**
 * Open a login window to claude.ai. Returns a promise that resolves
 * when the user successfully logs in.
 */
function openLoginWindow() {
  return new Promise((resolve, reject) => {
    const ses = getAuthSession()

    const win = new BrowserWindow({
      width: 520,
      height: 720,
      title: 'Sign in to Claude',
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    win.setMenuBarVisibility(false)
    win.loadURL(`${CLAUDE_URL}/login`)
    console.log('[claude-auth] Login window opened')

    let resolved = false

    async function tryDetectLogin(trigger) {
      if (resolved) return
      try {
        const orgId = await fetchOrgId()
        if (!orgId) return

        // Destroy old hidden window so it gets recreated with fresh cookies
        if (hiddenWindow && !hiddenWindow.isDestroyed()) {
          hiddenWindow.destroy()
          hiddenWindow = null
        }

        const hasAccess = await testUsageAccess(orgId)
        if (!hasAccess) {
          console.log(`[claude-auth] ${trigger}: have orgId but no API access yet`)
          return
        }

        console.log(`[claude-auth] ${trigger}: Login confirmed! org=${orgId}`)
        resolved = true
        cachedOrgId = orgId
        win.close()
        resolve({ orgId })
      } catch (e) {
        console.error(`[claude-auth] ${trigger} error:`, e.message)
      }
    }

    // Detect full page navigations
    win.webContents.on('did-navigate', (event, url) => {
      console.log('[claude-auth] did-navigate:', url)
      try {
        const parsed = new URL(url)
        if (parsed.hostname === 'claude.ai' && !parsed.pathname.startsWith('/login') && !parsed.pathname.startsWith('/oauth')) {
          tryDetectLogin('navigate')
        }
      } catch {}
    })

    // Detect SPA-style in-page navigations
    win.webContents.on('did-navigate-in-page', (event, url) => {
      try {
        const parsed = new URL(url)
        if (parsed.hostname === 'claude.ai' && !parsed.pathname.startsWith('/login') && !parsed.pathname.startsWith('/oauth')) {
          tryDetectLogin('in-page-navigate')
        }
      } catch {}
    })

    // Detect page finished loading
    win.webContents.on('did-finish-load', () => {
      const url = win.webContents.getURL()
      try {
        const parsed = new URL(url)
        if (parsed.hostname === 'claude.ai' && !parsed.pathname.startsWith('/login') && !parsed.pathname.startsWith('/oauth')) {
          tryDetectLogin('did-finish-load')
        }
      } catch {}
    })

    // Poll as final fallback every 3 seconds
    const poll = setInterval(() => {
      if (resolved) { clearInterval(poll); return }
      const url = win.webContents?.getURL() || ''
      try {
        const parsed = new URL(url)
        if (parsed.hostname === 'claude.ai' && !parsed.pathname.startsWith('/login') && !parsed.pathname.startsWith('/oauth')) {
          tryDetectLogin('poll')
        }
      } catch {}
    }, 3000)

    win.on('closed', () => {
      clearInterval(poll)
      if (!resolved) {
        reject(new Error('Login window closed before authentication completed'))
      }
    })
  })
}

/**
 * Check if we have a valid session (called on app startup).
 */
async function checkAuth() {
  const ses = getAuthSession()
  try {
    const cookies = await ses.cookies.get({ url: CLAUDE_URL })
    console.log(`[claude-auth] checkAuth: ${cookies.length} cookies in session`)

    if (cookies.length === 0) {
      console.log('[claude-auth] checkAuth: no cookies, not authenticated')
      return { authenticated: false }
    }

    const orgId = await fetchOrgId()
    if (!orgId) {
      console.log('[claude-auth] checkAuth: could not determine org ID')
      return { authenticated: false }
    }

    cachedOrgId = orgId

    const valid = await testUsageAccess(orgId)
    console.log(`[claude-auth] checkAuth: org=${orgId}, valid=${valid}`)
    return { authenticated: valid, orgId: valid ? orgId : null }
  } catch (e) {
    console.error('[claude-auth] checkAuth error:', e.message)
    return { authenticated: false }
  }
}

/**
 * Fetch usage data from claude.ai via the hidden browser window.
 */
async function fetchUsage(orgId) {
  const resp = await browserFetch(`/api/organizations/${orgId}/usage`)
  if (resp.status === 401 || resp.status === 403) {
    throw new Error('auth_expired')
  }
  if (resp.status >= 400) {
    throw new Error(`HTTP ${resp.status}`)
  }
  return JSON.parse(resp.body)
}

function getOrgId() {
  return cachedOrgId
}

/**
 * Clear the auth session (logout).
 */
async function clearAuth() {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    hiddenWindow.destroy()
    hiddenWindow = null
  }
  const ses = getAuthSession()
  await ses.clearStorageData()
  cachedOrgId = null
  console.log('[claude-auth] Session cleared')
}

module.exports = { openLoginWindow, checkAuth, fetchUsage, getOrgId, clearAuth }
