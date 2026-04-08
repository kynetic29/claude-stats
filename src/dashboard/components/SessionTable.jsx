import { useState } from 'react'
import { CARD_BG, BORDER, DIM, FONT_MONO, fmtTokens, fmtDuration, fmtCost, shortId, getModelColor } from '../theme'
import SessionDetailModal from './SessionDetailModal'

export default function SessionTable({ sessions }) {
  const [selectedSession, setSelectedSession] = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null)
  if (!sessions || sessions.length === 0) {
    return (
      <div style={{
        background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
        padding: 20, textAlign: 'center', color: DIM, fontFamily: FONT_MONO, fontSize: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
      }}>
        Waiting for session data...
      </div>
    )
  }

  return (
    <div style={{
      background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: DIM, padding: '10px 14px 6px',
      }}>
        Recent Sessions
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: BORDER }}>
              {['Session', 'Model', 'In', 'Out', 'Cache', 'Msgs', 'Duration', 'Cost'].map(h => (
                <th key={h} style={{
                  padding: '6px 8px', textAlign: 'left', color: DIM,
                  fontWeight: 600, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                  position: 'sticky', top: 0, background: BORDER, zIndex: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => {
              const modelColor = getModelColor(s.model)
              const totalTokens = (s.total_input_tokens || 0) + (s.total_output_tokens || 0)
              const elapsed = s.last_request_at && s.first_request_at
                ? s.last_request_at - s.first_request_at
                : 0
              const modelShort = s.model
                ? s.model.replace('claude-', '').replace(/-\d.*$/, '')
                : '?'

              return (
                <tr
                  key={s.session_id}
                  onClick={() => setSelectedSession(s)}
                  onMouseEnter={() => setHoveredRow(s.session_id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderTop: `1px solid ${BORDER}`,
                    background: hoveredRow === s.session_id ? '#1e293b' : (i % 2 === 0 ? 'transparent' : '#0a1628'),
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '6px 8px', fontFamily: FONT_MONO, color: '#38bdf8', fontSize: 10 }}>
                    {shortId(s.session_id)}
                    {s.is_active ? (
                      <span style={{ marginLeft: 4, color: '#22c55e', fontSize: 8 }}>●</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{
                      background: `${modelColor}22`, color: modelColor,
                      borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                    }}>{modelShort}</span>
                  </td>
                  <td style={{ padding: '6px 8px', color: '#e2e8f0', fontFamily: FONT_MONO, fontSize: 10 }}>
                    {fmtTokens(s.total_input_tokens || 0)}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#c084fc', fontFamily: FONT_MONO, fontSize: 10 }}>
                    {fmtTokens(s.total_output_tokens || 0)}
                  </td>
                  <td style={{ padding: '6px 8px', color: DIM, fontFamily: FONT_MONO, fontSize: 10 }}>
                    {fmtTokens(s.total_cache_creation || 0)}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#e2e8f0', fontFamily: FONT_MONO, fontSize: 10 }}>
                    {s.request_count || 0}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#34d399', fontFamily: FONT_MONO, fontSize: 10 }}>
                    {fmtDuration(elapsed)}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#fbbf24', fontFamily: FONT_MONO, fontSize: 10 }}>
                    {fmtCost(s.total_cost_usd || 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
