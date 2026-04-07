const { Tray, Menu, nativeImage } = require('electron')
const path = require('path')

let tray = null

function createTray(mainWindow, app) {
  // Create a simple 16x16 icon programmatically (no external file needed initially)
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4T2NkYPj/n4EBCxgdHc3+M' +
      'zAwMOLTgE0NIyMjEz4NuNQwMTEx4dOASw0zMzMTPg241LCwsDDh04BLDQsLCxMAvkkYEWBHLPIA' +
      'AAAASUVORK5CYII=',
      'base64'
    )
  )

  tray = new Tray(icon)
  tray.setToolTip('ClaudeStats')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: 'Hide Dashboard',
      click: () => {
        if (mainWindow) mainWindow.hide()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

module.exports = { createTray, destroyTray }
