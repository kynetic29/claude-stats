const { getConfigValue, setConfigValue, deleteConfigValue, getAllConfig } = require('./db')

function readConfig() {
  const config = getAllConfig()
  return Object.keys(config).length > 0 ? config : null
}

function writeConfig(data) {
  for (const [key, value] of Object.entries(data)) {
    setConfigValue(key, value)
  }
}

function deleteConfig() {
  const config = getAllConfig()
  for (const key of Object.keys(config)) {
    deleteConfigValue(key)
  }
}

module.exports = { readConfig, writeConfig, deleteConfig }
