import { useState, useEffect } from 'react'
import { CARD_BG, BORDER, DIM, TEXT, FONT_MONO, fmtTokens, fmtDuration, fmtCost, getModelColor } from '../theme'

function TokenBar({ input, output, cache }) {
  const total = input + output + cache
  if (total === 0) return null
  const pctIn = (input / total) * 100
  const pctOut = (output / total) * 100
  const pctCache = (cache / total) * 100
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#1e293b' }}>
      <div style={{ width: `${pctIn}%`, background: '#38bdf8' }} title={`Input: ${fmtTokens(input)}`} />
      <div style={{ width: `${pctOut}%`, background: '#c084fc' }} title={`Output: ${fmtTokens(output)}`} />
      <div style={{ width: `${pctCache}%`, background: '#fb923c' }} title={`Cache: ${fmtTokens(cache)}`} />
    </div>
  )
}

function fmtTime(timestamp) {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function fmtDate(timestamp) {
  const d = new Date(timestamp)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SessionDetailModal({ session, onClose }) {
  const [requests, setRequests] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.electronAPI.getSessionRequests(session.session_id).then(data => {
      if (!cancelled) {
        setRequests(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [session.session_id])

  const modelShort = session.model
    ? session.model.replace('claude-', '').replace(/-\d.*$/, '')
    : '?'
  const modelColor = getModelColor(session.model)
  const elapsed = session.last_request_at && session.first_request_at
    ? session.last_request_at - session.first_request_at
    : 0

  const totalIn = session.total_input_tokens || 0
  const totalOut = session.total_output_tokens || 0
  const totalCache = session.total_cache_creation || 0
  const totalCacheRead = session.total_cache_read || 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: 0, width: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: '#38bdf8', fontWeight: 700 }}>
                {session.session_id}
              </span>
              {session.is_active ? (
                <span style={{ color: '#22c55e', fontSize: 8 }}>●</span>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{
                background: `${modelColor}22`, color: modelColor,
                borderRadius: 3, padding: '2px 8px', fontSize: 10, fontWeight: 700,
              }}>{modelShort}</span>
              <span style={{ color: '#34d399', fontFamily: FONT_MONO, fontSize: 11 }}>
                {fmtDuration(elapsed)}
              </span>
              <span style={{ color: '#fbbf24', fontFamily: FONT_MONO, fontSize: 11 }}>
                {fmtCost(session.total_cost_usd || 0)}
              </span>
              <span style={{ color: DIM, fontSize: 10 }}>
                {session.request_count} request{session.request_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: DIM, cursor: 'pointer',
              fontSize: 16, padding: '0 4px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Summary stats */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Input</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#38bdf8', fontWeight: 700 }}>{fmtTokens(totalIn)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Output</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#c084fc', fontWeight: 700 }}>{fmtTokens(totalOut)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cache Write</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#fb923c', fontWeight: 700 }}>{fmtTokens(totalCache)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cache Read</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: DIM, fontWeight: 700 }}>{fmtTokens(totalCacheRead)}</div>
            </div>
          </div>
          <TokenBar input={totalIn} output={totalOut} cache={totalCache} />
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: DIM }}>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: '#38bdf8', marginRight: 4 }} />Input</span>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: '#c084fc', marginRight: 4 }} />Output</span>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: '#fb923c', marginRight: 4 }} />Cache</span>
          </div>
        </div>

        {/* Requests table */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: DIM, fontFamily: FONT_MONO, fontSize: 12 }}>
              Loading requests...
            </div>
          ) : !requests || requests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: DIM, fontFamily: FONT_MONO, fontSize: 12 }}>
              No request data found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: BORDER }}>
                  {['#', 'Time', 'Input', 'Output', 'Cache Write', 'Cache Read', 'Cost'].map(h => (
                    <th key={h} style={{
                      padding: '6px 8px', textAlign: 'left', color: DIM,
                      fontWeight: 600, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                      position: 'sticky', top: 0, background: BORDER, zIndex: 1,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => (
                  <tr key={r.request_id || i} style={{
                    borderTop: `1px solid ${BORDER}`,
                    background: i % 2 === 0 ? 'transparent' : '#0a1628',
                  }}>
                    <td style={{ padding: '5px 8px', color: DIM, fontFamily: FONT_MONO }}>{i + 1}</td>
                    <td style={{ padding: '5px 8px', color: TEXT, fontFamily: FONT_MONO }}>
                      <span title={new Date(r.timestamp).toLocaleString()}>
                        {fmtDate(r.timestamp)} {fmtTime(r.timestamp)}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', color: '#38bdf8', fontFamily: FONT_MONO }}>
                      {fmtTokens(r.input_tokens || 0)}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#c084fc', fontFamily: FONT_MONO }}>
                      {fmtTokens(r.output_tokens || 0)}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#fb923c', fontFamily: FONT_MONO }}>
                      {fmtTokens(r.cache_creation_tokens || 0)}
                    </td>
                    <td style={{ padding: '5px 8px', color: DIM, fontFamily: FONT_MONO }}>
                      {fmtTokens(r.cache_read_tokens || 0)}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#fbbf24', fontFamily: FONT_MONO }}>
                      {fmtCost(r.cost_usd || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
