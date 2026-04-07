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
    openDashboard(config)
  } else {
    openOnboarding()
  }

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

ipcMain.handle('data:get-dashboard', () => {
  const { getSessionStatus } = require('./session-tracker')
  const { getWeeklyStatus } = require('./weekly-tracker')
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
  }
})

ipcMain.handle('data:get-sessions', (event, limit = 100) => {
  return require('./db').getSessions(limit)
})

ipcMain.handle('data:get-daily-summaries', () => {
  return require('./db').getDailySummaries()
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
