import { FONT_MONO } from '../theme'

export default function AlertBanner({ sessionPct, weeklyPct }) {
  let message = null
  let bg = null
  let color = null

  if (sessionPct >= 95 || weeklyPct >= 95) {
    message = sessionPct >= 95 ? 'SESSION LIMIT CRITICAL' : 'WEEKLY LIMIT CRITICAL'
    bg = '#ef444422'
    color = '#ef4444'
  } else if (sessionPct >= 80 || weeklyPct >= 80) {
    message = sessionPct >= 80 ? 'Session usage approaching limit' : 'Weekly usage approaching limit'
    bg = '#f59e0b18'
    color = '#f59e0b'
  } else if (sessionPct >= 60 || weeklyPct >= 60) {
    message = sessionPct >= 60 ? 'Session at moderate usage' : 'Weekly at moderate usage'
    bg = '#22c55e12'
    color = '#22c55e'
  }

  if (!message) return null

  return (
    <div style={{
      background: bg, borderRadius: 6, padding: '6px 14px',
      fontSize: 11, fontWeight: 600, fontFamily: FONT_MONO,
      color, textAlign: 'center', letterSpacing: '0.05em',
      animation: (sessionPct >= 95 || weeklyPct >= 95) ? 'pulse 1.5s ease-in-out infinite' : 'none',
    }}>
      ⚠ {message} — {sessionPct >= 60 ? `Session: ${sessionPct.toFixed(1)}%` : ''}{sessionPct >= 60 && weeklyPct >= 60 ? ' · ' : ''}{weeklyPct >= 60 ? `Weekly: ${weeklyPct.toFixed(1)}%` : ''}
    </div>
  )
}
