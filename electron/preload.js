const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Data queries
  getDashboardData: () => ipcRenderer.invoke('data:get-dashboard'),
  getSessions: (limit) => ipcRenderer.invoke('data:get-sessions', limit),
  getDailySummaries: () => ipcRenderer.invoke('data:get-daily-summaries'),

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

  // App control
  quit: () => ipcRenderer.invoke('app:quit'),
})
