import { usePolledData } from './hooks/usePolledData'
import LimitGauges from './components/LimitGauges'
import StatCards from './components/StatCards'
import AlertBanner from './components/AlertBanner'
import WeeklyChart from './components/WeeklyChart'
import SessionTable from './components/SessionTable'
import LimitLearning from './components/LimitLearning'
import { BG, DIM, FONT_SANS, FONT_MONO } from './theme'

export default function App() {
  const { data, error } = usePolledData(3000)

  if (!data) {
    return (
      <div style={{
        background: BG, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_MONO, color: DIM,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◌</div>
          Loading dashboard data...
          {error && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>{error}</div>}
        </div>
      </div>
    )
  }

  const { session, weekly, sessions, limits, dailyBreakdown } = data

  return (
    <div style={{
      background: BG, height: '100vh', overflow: 'hidden',
      padding: '12px 16px',
      fontFamily: FONT_SANS,
      color: '#e2e8f0',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: session.active ? '#22c55e' : '#475569',
              boxShadow: session.active ? '0 0 8px #22c55e' : 'none',
            }} />
            <span style={{ fontSize: 10, color: session.active ? '#22c55e' : '#475569', fontFamily: FONT_MONO, letterSpacing: '0.1em' }}>
              {session.active ? 'LIVE' : 'IDLE'}
            </span>
          </div>
          <h1 style={{
            fontSize: 18, fontWeight: 800, fontFamily: FONT_MONO,
            background: 'linear-gradient(90deg, #e2e8f0 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            ClaudeStats
          </h1>
          <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#334155', fontFamily: FONT_MONO }}>
            Ctrl+Shift+Q exit · Ctrl+Shift+L mark limit · Ctrl+Shift+R reset
          </span>
          <button
            onClick={() => window.electronAPI?.quit()}
            title="Exit (Ctrl+Shift+Q)"
            style={{
              background: 'none', border: '1px solid #334155', borderRadius: 6,
              color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
              fontFamily: FONT_MONO,
            }}
            onMouseEnter={e => { e.target.style.borderColor = '#ef4444'; e.target.style.color = '#ef4444' }}
            onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div style={{ flexShrink: 0, marginBottom: 6 }}>
        <AlertBanner sessionPct={session.pct} weeklyPct={weekly.pct} />
      </div>

      {/* Limit Gauges */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        <LimitGauges session={session} weekly={weekly} />
      </div>

      {/* Stat Cards */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        <StatCards session={session} weekly={weekly} />
      </div>

      {/* Main content: chart + sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <WeeklyChart dailyBreakdown={dailyBreakdown} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <LimitLearning limits={limits} />
          </div>
        </div>
        <SessionTable sessions={sessions} />
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, marginTop: 4, fontSize: 9, color: '#334155', textAlign: 'center', fontFamily: FONT_MONO }}>
        OTLP/HTTP · localhost:4318 · JSONL scanner active · Polling every 3s
      </div>
    </div>
  )
}
