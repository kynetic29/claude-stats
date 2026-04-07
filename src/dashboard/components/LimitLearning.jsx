import { CARD_BG, BORDER, DIM, FONT_MONO, TEXT, fmtTokens } from '../theme'

export default function LimitLearning({ limits }) {
  if (!limits || limits.length === 0) return null

  const sessionLimit = limits.find(l => l.type === 'session') || { estimated_limit: 0, confidence: 0, observation_count: 0 }
  const weeklyLimit = limits.find(l => l.type === 'weekly') || { estimated_limit: 0, confidence: 0, observation_count: 0 }

  return (
    <div style={{
      background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
      padding: '10px 14px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: DIM, marginBottom: 8,
      }}>
        Estimated Limits
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <LimitDetail label="Session" estimate={sessionLimit} />
        <LimitDetail label="Weekly" estimate={weeklyLimit} />
      </div>

      <div style={{ fontSize: 9, color: '#475569', marginTop: 6, fontFamily: FONT_MONO }}>
        Ctrl+Shift+L to record a limit hit · More observations = higher confidence
      </div>
    </div>
  )
}

function LimitDetail({ label, estimate }) {
  const confidencePct = (estimate.confidence * 100).toFixed(0)
  const isLow = estimate.confidence < 0.3

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT, fontFamily: FONT_MONO }}>
          {isLow ? '~' : ''}{fmtTokens(estimate.estimated_limit)}
        </span>
        <span style={{ fontSize: 9, color: DIM }}>tokens</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <div style={{ flex: 1, height: 3, background: '#1e293b', borderRadius: 2 }}>
          <div style={{
            width: `${confidencePct}%`, height: '100%', borderRadius: 2,
            background: isLow ? '#f59e0b' : '#22c55e',
          }} />
        </div>
        <span style={{ fontSize: 9, color: DIM, fontFamily: FONT_MONO }}>
          {confidencePct}% · {estimate.observation_count} obs
        </span>
      </div>
    </div>
  )
}
