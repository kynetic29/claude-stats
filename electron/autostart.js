const { app } = require('electron')

function setAutoStart(enabled) {
  if (process.platform === 'linux') {
    // Linux requires a .desktop file; skip silently
    return
  }
  app.setLoginItemSettings({
    openAtLogin: enabled,
    // On Windows, pass the exe path explicitly so it survives moves
    path: process.execPath,
    // Open minimized to tray rather than foregrounded
    openAsHidden: false,
  })
}

function getAutoStart() {
  if (process.platform === 'linux') return false
  return app.getLoginItemSettings().openAtLogin
}

module.exports = { setAutoStart, getAutoStart }
