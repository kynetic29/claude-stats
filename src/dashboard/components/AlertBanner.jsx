import { FONT_MONO } from '../theme'

export default function AlertBanner({ sessionPct, weeklyPct, thresholds }) {
  const sWarn = thresholds?.sessionWarnPct ?? 60
  const sCrit = thresholds?.sessionCritPct ?? 80
  const wWarn = thresholds?.weeklyWarnPct ?? 60
  const wCrit = thresholds?.weeklyCritPct ?? 80
  const nearCrit = Math.min(sCrit, wCrit) + 15

  let message = null
  let bg = null
  let color = null

  if (sessionPct >= nearCrit || weeklyPct >= nearCrit) {
    message = sessionPct >= nearCrit ? 'SESSION LIMIT CRITICAL' : 'WEEKLY LIMIT CRITICAL'
    bg = '#ef444422'
    color = '#ef4444'
  } else if (sessionPct >= sCrit || weeklyPct >= wCrit) {
    message = sessionPct >= sCrit ? 'Session usage approaching limit' : 'Weekly usage approaching limit'
    bg = '#f59e0b18'
    color = '#f59e0b'
  } else if (sessionPct >= sWarn || weeklyPct >= wWarn) {
    message = sessionPct >= sWarn ? 'Session at moderate usage' : 'Weekly at moderate usage'
    bg = '#22c55e12'
    color = '#22c55e'
  }

  if (!message) return null

  return (
    <div style={{
      background: bg, borderRadius: 6, padding: '6px 14px',
      fontSize: 11, fontWeight: 600, fontFamily: FONT_MONO,
      color, textAlign: 'center', letterSpacing: '0.05em',
      animation: (sessionPct >= nearCrit || weeklyPct >= nearCrit) ? 'pulse 1.5s ease-in-out infinite' : 'none',
    }}>
      ⚠ {message} — {sessionPct >= 60 ? `Session: ${(sessionPct ?? 0).toFixed(1)}%` : ''}{sessionPct >= 60 && weeklyPct >= 60 ? ' · ' : ''}{weeklyPct >= 60 ? `Weekly: ${(weeklyPct ?? 0).toFixed(1)}%` : ''}
    </div>
  )
}
