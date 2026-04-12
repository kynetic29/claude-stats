const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')

const CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

let initialized = false
let lastStatus = { state: 'idle' }

function broadcast(status) {
  lastStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('update-status', status)
    }
  }
}

function initAutoUpdater() {
  if (initialized) return
  if (!app.isPackaged) {
    console.log('[updater] Skipping auto-update in dev mode')
    return
  }
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (msg) => console.log('[updater]', msg),
    warn: (msg) => console.warn('[updater]', msg),
    error: (msg) => console.error('[updater]', msg),
    debug: (msg) => console.log('[updater:debug]', msg),
  }

  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: ${info.version}`)
    broadcast({ state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast({ state: 'idle' })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      state: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] Update downloaded: ${info.version}`)
    broadcast({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err?.message || err)
    broadcast({ state: 'error', message: err?.message || String(err) })
  })

  // Initial check + periodic re-checks
  autoUpdater.checkForUpdatesAndNotify().catch((e) => {
    console.error('[updater] Initial check failed:', e.message)
  })

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e) => {
      console.error('[updater] Periodic check failed:', e.message)
    })
  }, CHECK_INTERVAL_MS)
}

function getLastStatus() {
  return lastStatus
}

function quitAndInstall() {
  autoUpdater.quitAndInstall()
}

module.exports = { initAutoUpdater, getLastStatus, quitAndInstall }
