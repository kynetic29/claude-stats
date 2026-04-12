import { useState } from 'react'
import { usePolledData } from './hooks/usePolledData'
import { useLayout } from './hooks/useLayout'
import LimitGauges from './components/LimitGauges'
import StatCards from './components/StatCards'
import AlertBanner from './components/AlertBanner'
import WeeklyChart from './components/WeeklyChart'
import SessionTable from './components/SessionTable'
import LimitLearning from './components/LimitLearning'
import UpdateToast from './components/UpdateToast'
import SettingsModal from './components/SettingsModal'
import ModelBreakdown from './components/ModelBreakdown'
import { BG, DIM, FONT_SANS, FONT_MONO } from './theme'

// Font scale per layout variant — applied to root container so em-relative
// children scale naturally. px-based children in sub-components are unaffected
// but the scale establishes the baseline for future em migration.
const FONT_SCALE = {
  'tall': 0.88,
  'standard': 0.94,
  'wide-2to1': 1.0,
  'ultrawide': 1.0,
  'superwide': 1.06,
}

export default function App() {
  const { data, error } = usePolledData(3000)
  const { layout, isDevOverride } = useLayout()
  const [connecting, setConnecting] = useState(false)
  const [displayPickerOpen, setDisplayPickerOpen] = useState(false)
  const [displays, setDisplays] = useState([])
  const [movingDisplay, setMovingDisplay] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function openDisplayPicker() {
    const list = await window.electronAPI?.getDisplays()
    setDisplays(list || [])
    setDisplayPickerOpen(true)
  }

  async function pickDisplay(id) {
    setMovingDisplay(id)
    await window.electronAPI?.moveToDisplay(id)
    setMovingDisplay(null)
    setDisplayPickerOpen(false)
  }

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

  const { session, weekly, sessions, limits, dailyBreakdown, modelBreakdown, claudeApiError, thresholds } = data
  const isClaudeConnected = session.source === 'claude-api'
  const t = thresholds || { sessionWarnPct: 60, sessionCritPct: 80, weeklyWarnPct: 60, weeklyCritPct: 80 }

  // Sidebar layouts put gauges in a left column alongside the main content.
  const isSidebarLayout = layout === 'ultrawide' || layout === 'superwide'

  // Column sizing for main content grid (bottom area) in top-gauges layouts.
  // standard gets a third column for model breakdown.
  const mainGridColumns = layout === 'tall' ? '1fr'
    : layout === 'standard' ? '3fr 2fr 1fr'
    : '1fr 1fr' // wide-2to1

  const headerEl = (
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
          {isDevOverride && (
            <span style={{
              fontSize: 8, color: '#f59e0b', fontFamily: FONT_MONO, letterSpacing: '0.1em',
              background: '#f59e0b18', padding: '1px 6px', borderRadius: 3, border: '1px solid #f59e0b44',
            }}>
              LAYOUT: {layout.toUpperCase()} (Ctrl+Shift+K)
            </span>
          )}
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
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <UpdateToast />
        {!isClaudeConnected && (
          <button
            onClick={async () => {
              setConnecting(true)
              try {
                await window.electronAPI?.claudeLogin()
              } catch {}
              setConnecting(false)
            }}
            title={claudeApiError === 'auth_expired' ? 'Session expired — click to reconnect' : 'Connect to Claude.ai for live usage data'}
            style={{
              background: 'none',
              border: `1px solid ${claudeApiError === 'auth_expired' ? '#f59e0b' : '#334155'}`,
              borderRadius: 6,
              color: claudeApiError === 'auth_expired' ? '#f59e0b' : '#64748b',
              cursor: connecting ? 'wait' : 'pointer',
              padding: '4px 10px', fontSize: 11,
              fontFamily: FONT_MONO,
              opacity: connecting ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!connecting) { e.target.style.borderColor = '#34d399'; e.target.style.color = '#34d399' } }}
            onMouseLeave={e => { e.target.style.borderColor = claudeApiError === 'auth_expired' ? '#f59e0b' : '#334155'; e.target.style.color = claudeApiError === 'auth_expired' ? '#f59e0b' : '#64748b' }}
            disabled={connecting}
          >
            {connecting ? '...' : claudeApiError === 'auth_expired' ? '!' : 'C'}
          </button>
        )}
        <button
          onClick={() => window.electronAPI?.openHistory()}
          title="History & Analysis"
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#c084fc'; e.target.style.color = '#c084fc' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          ⌛
        </button>
        <button
          onClick={() => window.electronAPI?.recordLimitHit('session')}
          title="Record Limit Hit (Ctrl+Shift+L)"
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#f59e0b'; e.target.style.color = '#f59e0b' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          L
        </button>
        <button
          onClick={openDisplayPicker}
          title="Move to Display"
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#38bdf8'; e.target.style.color = '#38bdf8' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          ⊞
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#38bdf8'; e.target.style.color = '#38bdf8' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          ⚙
        </button>
        <button
          onClick={() => window.electronAPI?.resetSetup()}
          title="Reset Setup (Ctrl+Shift+R)"
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#8b5cf6'; e.target.style.color = '#8b5cf6' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          R
        </button>
        <button
          onClick={() => window.electronAPI?.minimize()}
          title="Minimize"
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#f59e0b'; e.target.style.color = '#f59e0b' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          −
        </button>
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
  )

  const alertEl = (
    <div style={{ flexShrink: 0, marginBottom: 6 }}>
      <AlertBanner sessionPct={session.pct} weeklyPct={weekly.pct} thresholds={t} />
    </div>
  )

  const footerEl = (
    <div style={{ flexShrink: 0, marginTop: 4, fontSize: 9, color: '#334155', textAlign: 'center', fontFamily: FONT_MONO }}>
      OTLP/HTTP · localhost:4318 · JSONL scanner active · Polling every 3s
    </div>
  )

  // ── Sidebar layouts (ultrawide / superwide) ─────────────────────────────────
  // Gauges move to a left column so horizontal space is better used.
  // The superwide layout reserves a third column for Phase 5 (model breakdown).
  if (isSidebarLayout) {
    const sidebarWidth = layout === 'superwide' ? '240px' : '260px'
    const reservedWidth = '280px'

    return (
      <div style={{
        background: BG, height: '100vh', overflow: 'hidden',
        padding: '12px 16px',
        fontFamily: FONT_SANS,
        color: '#e2e8f0',
        display: 'flex', flexDirection: 'column',
        fontSize: `${FONT_SCALE[layout]}rem`,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: #0f172a; }
          ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        `}</style>

        {headerEl}
        {alertEl}

        {/* Three-pane body: [gauges sidebar] [main] [reserved?] */}
        <div style={{
          flex: 1, minHeight: 0,
          display: 'grid',
          gridTemplateColumns: layout === 'superwide'
            ? `${sidebarWidth} 1fr ${reservedWidth}`
            : `${sidebarWidth} 1fr`,
          gap: 10,
        }}>
          {/* Left sidebar: stacked gauges + limit learning + model breakdown (ultrawide only) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <LimitGauges session={session} weekly={weekly} thresholds={t} vertical />
            <LimitLearning limits={limits} />
            {layout === 'ultrawide' && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <ModelBreakdown breakdown={modelBreakdown} />
              </div>
            )}
          </div>

          {/* Main content: stat cards + chart & sessions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <div style={{ flexShrink: 0 }}>
              <StatCards session={session} weekly={weekly} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
              <WeeklyChart dailyBreakdown={dailyBreakdown} />
              <SessionTable sessions={sessions} />
            </div>
          </div>

          {/* Model breakdown column (superwide only) */}
          {layout === 'superwide' && (
            <ModelBreakdown breakdown={modelBreakdown} />
          )}
        </div>

        {footerEl}

        {settingsOpen && (
          <SettingsModal thresholds={t} onClose={() => setSettingsOpen(false)} />
        )}
        {displayPickerOpen && renderDisplayPicker(displays, movingDisplay, pickDisplay, () => setDisplayPickerOpen(false))}
      </div>
    )
  }

  // ── Top-gauges layouts (tall / standard / wide-2to1) ────────────────────────
  return (
    <div style={{
      background: BG, height: '100vh', overflow: 'hidden',
      padding: '12px 16px',
      fontFamily: FONT_SANS,
      color: '#e2e8f0',
      display: 'flex', flexDirection: 'column',
      fontSize: `${FONT_SCALE[layout]}rem`,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>

      {headerEl}
      {alertEl}

      {/* Gauges */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        <LimitGauges session={session} weekly={weekly} thresholds={t} vertical={layout === 'tall'} />
      </div>

      {/* Stat Cards */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        <StatCards session={session} weekly={weekly} wrap={layout === 'tall'} />
      </div>

      {/* Main content grid — 1 col (tall) or 2 col (standard / wide-2to1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mainGridColumns,
        gap: 8,
        flex: 1,
        minHeight: 0,
        // tall layout allows body scroll so sessions remain accessible below fold
        overflowY: layout === 'tall' ? 'auto' : 'hidden',
      }}>
        {layout === 'tall' ? (
          // Single-column stack for tall: chart → limit learning → sessions
          <>
            <WeeklyChart dailyBreakdown={dailyBreakdown} />
            <LimitLearning limits={limits} />
            <div style={{ minHeight: 240 }}>
              <SessionTable sessions={sessions} />
            </div>
          </>
        ) : (
          // Two-column (wide-2to1) or three-column (standard) layout
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                <WeeklyChart dailyBreakdown={dailyBreakdown} />
              </div>
              <div style={{ flexShrink: 0 }}>
                <LimitLearning limits={limits} />
              </div>
            </div>
            {/* Right column: sessions + model breakdown stacked (wide-2to1 only) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                <SessionTable sessions={sessions} />
              </div>
              {layout === 'wide-2to1' && (
                <div style={{ flexShrink: 0, height: 200 }}>
                  <ModelBreakdown breakdown={modelBreakdown} />
                </div>
              )}
            </div>
            {/* Third column: model breakdown (standard only) */}
            {layout === 'standard' && (
              <ModelBreakdown breakdown={modelBreakdown} />
            )}
          </>
        )}
      </div>

      {footerEl}

      {settingsOpen && (
        <SettingsModal thresholds={t} onClose={() => setSettingsOpen(false)} />
      )}
      {displayPickerOpen && renderDisplayPicker(displays, movingDisplay, pickDisplay, () => setDisplayPickerOpen(false))}
    </div>
  )
}

// Extracted so both render paths share the same display picker overlay
function renderDisplayPicker(displays, movingDisplay, onPick, onClose) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
          padding: '16px 20px', minWidth: 280,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, letterSpacing: '0.08em' }}>
          MOVE TO DISPLAY
        </div>
        {displays.map(d => (
          <button
            key={d.id}
            onClick={() => onPick(d.id)}
            disabled={movingDisplay !== null}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none',
              border: '1px solid #334155', borderRadius: 6,
              color: '#e2e8f0', cursor: movingDisplay ? 'wait' : 'pointer',
              padding: '8px 12px', fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
              opacity: movingDisplay && movingDisplay !== d.id ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!movingDisplay) e.currentTarget.style.borderColor = '#38bdf8' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155' }}
          >
            <span>{d.label || `Display ${d.id}`}</span>
            <span style={{ color: '#64748b', fontSize: 10, marginLeft: 12 }}>
              {d.bounds.width}×{d.bounds.height}
              {d.isPrimary && <span style={{ color: '#22c55e', marginLeft: 6 }}>primary</span>}
              {movingDisplay === d.id && <span style={{ color: '#38bdf8', marginLeft: 6 }}>moving…</span>}
            </span>
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            display: 'block', width: '100%', marginTop: 4,
            background: 'none', border: 'none',
            color: '#475569', cursor: 'pointer', fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace", padding: '4px 0',
          }}
        >
          cancel
        </button>
      </div>
    </div>
  )
}
