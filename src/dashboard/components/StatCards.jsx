import { CARD_BG, BORDER, DIM, FONT_MONO, fmtTokens, fmtCost } from '../theme'

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${CARD_BG} 0%, ${BORDER} 100%)`,
      border: `1px solid ${color}33`, borderRadius: 10,
      padding: '10px 14px', flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 9, color: DIM, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: FONT_MONO }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function StatCards({ session, weekly }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <StatCard
        label="Session Tokens"
        value={fmtTokens(session.tokens)}
        sub={`${session.requestCount} requests`}
        color="#38bdf8"
      />
      <StatCard
        label="Messages Today"
        value={String(weekly.requestCountToday)}
        sub={`${weekly.requestCountWeek} this week`}
        color="#c084fc"
      />
      <StatCard
        label="Weekly Tokens"
        value={fmtTokens(weekly.tokens)}
        sub={`${weekly.sessionCount} sessions`}
        color="#34d399"
      />
      <StatCard
        label="Session Cost"
        value={fmtCost(session.cost || 0)}
        sub={`${fmtCost(weekly.cost || 0)} this week`}
        color="#fbbf24"
      />
      <StatCard
        label="Model"
        value={session.model ? session.model.replace('claude-', '').split('-').slice(0, -1).join('-') : '—'}
        sub={session.project || '—'}
        color="#fb923c"
      />
    </div>
  )
}
