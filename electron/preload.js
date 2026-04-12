const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Data queries
  getDashboardData: () => ipcRenderer.invoke('data:get-dashboard'),
  getSessions: (limit) => ipcRenderer.invoke('data:get-sessions', limit),
  getDailySummaries: () => ipcRenderer.invoke('data:get-daily-summaries'),
  getSessionRequests: (sessionId) => ipcRenderer.invoke('data:get-session-requests', sessionId),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (partial) => ipcRenderer.invoke('config:update', partial),
  getDisplays: () => ipcRenderer.invoke('config:get-displays'),
  completeOnboarding: (config) => ipcRenderer.invoke('config:complete-onboarding', config),

  // Limit management
  recordLimitHit: (type) => ipcRenderer.invoke('limits:record-hit', type),
  getLimitEstimates: () => ipcRenderer.invoke('limits:get-estimates'),
  getLimitObservations: (limit) => ipcRenderer.invoke('limits:get-observations', limit),
  updateLimitEstimate: (data) => ipcRenderer.invoke('limits:update-estimate', data),

  // Claude.ai auth
  claudeLogin: () => ipcRenderer.invoke('auth:login'),
  claudeAuthStatus: () => ipcRenderer.invoke('auth:status'),
  claudeLogout: () => ipcRenderer.invoke('auth:logout'),

  // App control
  quit: () => ipcRenderer.invoke('app:quit'),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  resetSetup: () => ipcRenderer.invoke('app:reset-setup'),
  moveToDisplay: (displayId) => ipcRenderer.invoke('display:move', displayId),

  // Auto-start
  setAutoStart: (enabled) => ipcRenderer.invoke('app:set-autostart', enabled),
  getAutoStart: () => ipcRenderer.invoke('app:get-autostart'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // History window
  openHistory: () => ipcRenderer.invoke('history:open'),
  historyGetDaily: (opts) => ipcRenderer.invoke('history:get-daily', opts),
  historyGetWeekly: (opts) => ipcRenderer.invoke('history:get-weekly', opts),
  historyGetMonthly: (opts) => ipcRenderer.invoke('history:get-monthly', opts),
  historyGetModels: () => ipcRenderer.invoke('history:get-models'),

  // Data export
  exportData: (options) => ipcRenderer.invoke('data:export', options),

  // Auto-updater
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (handler) => {
    const listener = (_event, status) => handler(status)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
})
