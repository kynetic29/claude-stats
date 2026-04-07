export const BG = '#060d1a'
export const CARD_BG = '#0f172a'
export const BORDER = '#1e293b'
export const DIM = '#94a3b8'
export const TEXT = '#e2e8f0'

export const GREEN = '#22c55e'
export const YELLOW = '#f59e0b'
export const RED = '#ef4444'
export const BLUE = '#38bdf8'
export const PURPLE = '#c084fc'
export const EMERALD = '#34d399'
export const ORANGE = '#fb923c'

export const MODEL_COLORS = {
  'claude-sonnet-4-6': BLUE,
  'claude-opus-4-6': ORANGE,
  'claude-haiku-4-5': EMERALD,
  sonnet: BLUE,
  opus: ORANGE,
  haiku: EMERALD,
}

export function getModelColor(model) {
  if (!model) return BLUE
  if (MODEL_COLORS[model]) return MODEL_COLORS[model]
  if (model.includes('opus')) return ORANGE
  if (model.includes('haiku')) return EMERALD
  return BLUE
}

export function getLimitColor(pct) {
  if (pct >= 90) return RED
  if (pct >= 60) return YELLOW
  return GREEN
}

export function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function fmtDuration(ms) {
  if (!ms || ms <= 0) return '—'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) {
    const m = Math.floor(ms / 60000)
    const s = Math.round((ms % 60000) / 1000)
    return `${m}m ${s}s`
  }
  const h = Math.floor(ms / 3600000)
  const m = Math.round((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export function fmtCountdown(ms) {
  if (ms <= 0) return 'Now'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return `${d}d ${rh}h`
  }
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function fmtCost(usd) {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

export function shortId(id) {
  if (!id) return '—'
  return id.length > 12 ? id.slice(0, 8) + '…' : id
}

export const FONT_MONO = "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace"
export const FONT_SANS = "'IBM Plex Sans', 'Segoe UI', sans-serif"
