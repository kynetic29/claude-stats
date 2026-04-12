const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron')
const path = require('path')

// Ensure single instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow = null
let tray = null

function openOnboarding() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 620,
    resizable: false,
    center: true,
    title: 'ClaudeStats — Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadFile(path.join(__dirname, '../dist/src/onboarding/index.html'))
  mainWindow.on('closed', () => { mainWindow = null })
}

function openDashboard(config) {
  const displays = screen.getAllDisplays()
  const target = displays.find(d => d.id === config.displayId) || screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    alwaysOnTop: true,
    title: 'ClaudeStats',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadFile(path.join(__dirname, '../dist/src/dashboard/index.html'))

  if (process.platform === 'darwin') {
    win.setSimpleFullScreen(true)
  } else {
    win.setFullScreen(true)
  }

  win.on('closed', () => { mainWindow = null })
  mainWindow = win

  // Create system tray
  const { createTray } = require('./tray')
  tray = createTray(mainWindow, app)
}

function startUsagePolling(adminApiKey) {
  if (!adminApiKey) return

  const { fetchRecentDays, fetchDay } = require('./usage-api')
  const { upsertDailySummary } = require('./db')

  fetchRecentDays(adminApiKey, 30)
    .then(records => {
      for (const r of records) {
        const actorId = r.actor?.email_address || r.actor?.api_key_name || 'unknown'
        upsertDailySummary(r.date, actorId, r)
      }
      console.log(`[usage-api] Loaded ${records.length} daily records`)
    })
    .catch(e => console.error('[usage-api] Initial fetch failed:', e.message))

  setInterval(() => {
    const today = new Date().toISOString().split('T')[0]
    fetchDay(adminApiKey, today)
      .then(records => {
        for (const r of records) {
          const actorId = r.actor?.email_address || r.actor?.api_key_name || 'unknown'
          upsertDailySummary(r.date, actorId, r)
        }
      })
      .catch(e => console.error('[usage-api] Hourly refresh failed:', e.message))
  }, 60 * 60 * 1000)
}

async function startClaudeUsagePolling() {
  const { checkAuth } = require('./claude-auth')
  const { startPolling } = require('./claude-usage-poller')

  try {
    const auth = await checkAuth()
    if (auth.authenticated && auth.orgId) {
      startPolling(auth.orgId)
      console.log('[claude-usage] Started polling with org', auth.orgId)
    } else {
      console.log('[claude-usage] Not authenticated, skipping usage polling')
    }
  } catch (e) {
    console.error('[claude-usage] Failed to start polling:', e.message)
  }
}

app.whenReady().then(async () => {
  // Initialize database (triggers schema creation + migrations)
  require('./db').getDb()

  // Recalculate limit estimates from all stored observations on every startup
  // (ensures estimates stay correct after migrations or manual DB edits)
  const { recalcEstimate } = require('./limit-estimator')
  recalcEstimate('session', 'all')
  recalcEstimate('weekly', 'all')

  // Migrate config from old JSON file if it exists and SQLite config is empty
  const fs = require('fs')
  const { readConfig: rc, writeConfig: wc } = require('./config')
  if (!rc()) {
    const oldConfigPath = path.join(app.getPath('userData'), 'config.json')
    if (fs.existsSync(oldConfigPath)) {
      try {
        const old = JSON.parse(fs.readFileSync(oldConfigPath, 'utf8'))
        if (old.displayId) {
          wc({
            displayId: old.displayId,
            adminApiKey: old.adminApiKey || null,
            resetDay: old.resetDay ?? 1,
            resetHour: old.resetHour ?? 6,
          })
          fs.unlinkSync(oldConfigPath)
          console.log('[main] Migrated config from config.json and removed old file')
        }
      } catch {}
    }
  }

  // Start OTLP receiver
  const { startReceiver } = require('./receiver')
  try {
    await startReceiver()
  } catch (e) {
    console.error('[main] Failed to start OTLP receiver:', e.message)
  }

  // Start JSONL scanner
  const { startScanner } = require('./jsonl-scanner')
  startScanner()

  // Check config
  const { readConfig } = require('./config')
  const config = readConfig()
  if (config && config.displayId) {
    startUsagePolling(config.adminApiKey)
    startClaudeUsagePolling()
    openDashboard(config)
  } else {
    openOnboarding()
  }

  // Reconcile auto-start setting with OS
  const { setAutoStart, getAutoStart } = require('./autostart')
  const currentConfig = readConfig() || {}
  const wantAutoStart = currentConfig.autoStart ?? false
  if (getAutoStart() !== wantAutoStart) {
    setAutoStart(wantAutoStart)
  }

  // Start auto-updater (no-op in dev mode)
  const { initAutoUpdater } = require('./updater')
  initAutoUpdater()

  // Global shortcuts
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit())
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    require('./config').deleteConfig()
    app.relaunch()
    app.exit(0)
  })
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    const { recordLimitHit } = require('./limit-estimator')
    const result = recordLimitHit('session')
    if (result) {
      console.log(`[main] Recorded session limit hit: ${result.tokens} tokens`)
    }
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  require('./db').close()
  require('./jsonl-scanner').stopScanner()
  require('./receiver').stopReceiver()
  const { destroyTray } = require('./tray')
  destroyTray()
})

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('app:quit', () => app.quit())
ipcMain.handle('app:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
})

ipcMain.handle('app:set-autostart', (event, enabled) => {
  const { setAutoStart } = require('./autostart')
  const { readConfig, writeConfig } = require('./config')
  setAutoStart(enabled)
  const existing = readConfig() || {}
  writeConfig({ ...existing, autoStart: enabled })
  return { ok: true }
})

ipcMain.handle('app:get-autostart', () => {
  const { getAutoStart } = require('./autostart')
  return getAutoStart()
})

ipcMain.handle('app:get-version', () => app.getVersion())

ipcMain.handle('update:get-status', () => {
  return require('./updater').getLastStatus()
})

ipcMain.handle('update:install', () => {
  require('./updater').quitAndInstall()
  return { ok: true }
})

ipcMain.handle('app:reset-setup', () => {
  require('./config').deleteConfig()
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('data:get-dashboard', () => {
  const { getSessionStatus } = require('./session-tracker')
  const { getWeeklyStatus } = require('./weekly-tracker')
  const { getPollError } = require('./claude-usage-poller')
  const { readConfig } = require('./config')
  const db = require('./db')

  const config = readConfig() || {}
  const resetDay = config.resetDay ?? 1
  const resetHour = config.resetHour ?? 6

  return {
    session: getSessionStatus(),
    weekly: getWeeklyStatus(resetDay, resetHour),
    sessions: db.getSessions(50),
    limits: db.getLimitEstimates(),
    dailyBreakdown: db.getDailyBreakdown(
      require('./limit-estimator').getWeekStartTimestamp(resetDay, resetHour)
    ),
    modelBreakdown: db.getModelBreakdown(Date.now() - 5 * 60 * 60 * 1000),
    claudeApiError: getPollError(),
    thresholds: {
      sessionWarnPct: config.sessionWarnPct ?? 60,
      sessionCritPct: config.sessionCritPct ?? 80,
      weeklyWarnPct: config.weeklyWarnPct ?? 60,
      weeklyCritPct: config.weeklyCritPct ?? 80,
    },
  }
})

ipcMain.handle('data:get-sessions', (event, limit = 100) => {
  return require('./db').getSessions(limit)
})

ipcMain.handle('data:get-daily-summaries', () => {
  return require('./db').getDailySummaries()
})

ipcMain.handle('data:get-session-requests', (event, sessionId) => {
  return require('./db').getRequestsBySessionId(sessionId)
})

ipcMain.handle('config:get', () => {
  return require('./config').readConfig()
})

ipcMain.handle('config:update', (event, partial) => {
  const { readConfig, writeConfig } = require('./config')
  const existing = readConfig() || {}
  writeConfig({ ...existing, ...partial })
  return { ok: true }
})

ipcMain.handle('config:get-displays', () => {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primary.id,
  }))
})

ipcMain.handle('config:complete-onboarding', (event, config) => {
  require('./config').writeConfig(config)
  startUsagePolling(config.adminApiKey)
  startClaudeUsagePolling()
  openDashboard(config)
  const prev = BrowserWindow.getAllWindows().find(w => w !== mainWindow)
  if (prev) prev.close()
  return { ok: true }
})

ipcMain.handle('limits:record-hit', (event, type) => {
  return require('./limit-estimator').recordLimitHit(type)
})

ipcMain.handle('limits:get-estimates', () => {
  return require('./db').getLimitEstimates()
})

ipcMain.handle('limits:get-observations', (event, limit = 50) => {
  return require('./db').getLimitObservations(limit)
})

ipcMain.handle('limits:update-estimate', (event, data) => {
  require('./db').upsertLimitEstimate(data)
  return { ok: true }
})

ipcMain.handle('display:move', (event, displayId) => {
  const { readConfig, writeConfig } = require('./config')
  const displays = screen.getAllDisplays()
  const target = displays.find(d => d.id === displayId)
  if (!target || !mainWindow) return { ok: false, error: 'Display not found' }

  const existing = readConfig() || {}
  writeConfig({ ...existing, displayId })

  mainWindow.setFullScreen(false)
  mainWindow.setBounds({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
  })
  if (process.platform === 'darwin') {
    mainWindow.setSimpleFullScreen(true)
  } else {
    mainWindow.setFullScreen(true)
  }
  return { ok: true }
})

// ── Claude.ai Auth ──────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async () => {
  const { clearAuth, openLoginWindow } = require('./claude-auth')
  const { stopPolling, startPolling } = require('./claude-usage-poller')

  try {
    // Clear any stale session data before a fresh login
    stopPolling()
    await clearAuth()
    console.log('[claude-auth] Cleared previous session, opening login window...')

    const result = await openLoginWindow()
    // Start polling immediately after successful login
    startPolling(result.orgId)
    console.log('[claude-usage] Authenticated, polling started for org', result.orgId)
    return { ok: true, orgId: result.orgId }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('auth:status', async () => {
  const { checkAuth } = require('./claude-auth')
  const { getPollError } = require('./claude-usage-poller')

  const auth = await checkAuth()
  return {
    authenticated: auth.authenticated,
    orgId: auth.orgId,
    pollError: getPollError(),
  }
})

ipcMain.handle('history:open', () => {
  const existing = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'ClaudeStats — History')
  if (existing) {
    existing.focus()
    return
  }
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    title: 'ClaudeStats — History',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '../dist/src/history/index.html'))
})

ipcMain.handle('history:get-daily', (event, { days, model }) => {
  const { getDailyTrendByModel } = require('./history-queries')
  return getDailyTrendByModel(days, model || null)
})

ipcMain.handle('history:get-weekly', (event, { weeks }) => {
  const { getWeekOverWeek } = require('./history-queries')
  return getWeekOverWeek(weeks)
})

ipcMain.handle('history:get-monthly', (event, { months }) => {
  const { getMonthlySummary } = require('./history-queries')
  return getMonthlySummary(months)
})

ipcMain.handle('history:get-models', () => {
  const { getDistinctModels } = require('./history-queries')
  return getDistinctModels()
})

ipcMain.handle('data:export', async (event, options) => {
  const { exportData } = require('./exporter')
  return exportData(options)
})

ipcMain.handle('auth:logout', async () => {
  const { clearAuth } = require('./claude-auth')
  const { stopPolling } = require('./claude-usage-poller')

  stopPolling()
  await clearAuth()
  return { ok: true }
})
