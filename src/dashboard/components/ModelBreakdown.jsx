import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CARD_BG, BORDER, DIM, FONT_MONO, getModelColor, fmtTokens, fmtCost } from '../theme'

function CustomTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: '8px 12px', fontSize: 11, fontFamily: FONT_MONO,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: getModelColor(d.model), fontWeight: 700, marginBottom: 4 }}>
        {d.model}
      </div>
      <div style={{ color: '#e2e8f0' }}>
        {metric === 'cost'
          ? fmtCost(d.cost)
          : fmtTokens(d.tokens)
        }
        {' '}<span style={{ color: DIM }}>({(d.pct ?? 0).toFixed(1)}%)</span>
      </div>
      <div style={{ color: DIM, marginTop: 2 }}>{d.requests} requests</div>
    </div>
  )
}

export default function ModelBreakdown({ breakdown }) {
  const [metric, setMetric] = useState('tokens') // 'tokens' | 'cost'

  const isEmpty = !breakdown || breakdown.length === 0
  const isSingleModel = breakdown?.length === 1

  if (isEmpty) {
    return (
      <div style={{
        background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
        padding: 20, textAlign: 'center', color: DIM, fontFamily: FONT_MONO,
        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%',
      }}>
        No session data yet
      </div>
    )
  }

  const total = breakdown.reduce((s, r) => s + (metric === 'cost' ? r.cost : r.tokens), 0)

  const data = breakdown.map(r => ({
    ...r,
    value: metric === 'cost' ? r.cost : r.tokens,
    pct: total > 0 ? ((metric === 'cost' ? r.cost : r.tokens) / total) * 100 : 0,
  }))

  return (
    <div style={{
      background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: DIM,
        }}>
          Model Breakdown
        </div>
        {/* Toggle: tokens / cost */}
        <div style={{ display: 'flex', gap: 2 }}>
          {['tokens', 'cost'].map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                background: metric === m ? '#1e293b' : 'none',
                border: `1px solid ${metric === m ? '#334155' : 'transparent'}`,
                borderRadius: 4, color: metric === m ? '#e2e8f0' : '#475569',
                cursor: 'pointer', padding: '2px 8px', fontSize: 9,
                fontFamily: FONT_MONO, letterSpacing: '0.06em',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Donut chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              dataKey="value"
              strokeWidth={2}
              stroke={CARD_BG}
            >
              {data.map((entry) => (
                <Cell key={entry.model} fill={getModelColor(entry.model)} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip metric={metric} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', fontFamily: FONT_MONO }}>
            {metric === 'cost' ? fmtCost(total) : fmtTokens(total)}
          </div>
          <div style={{ fontSize: 8, color: DIM, letterSpacing: '0.06em', marginTop: 2 }}>
            5H WINDOW
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {data.map(entry => (
          <div key={entry.model} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 2, flexShrink: 0,
              background: getModelColor(entry.model),
            }} />
            <span style={{
              fontSize: 10, color: '#94a3b8', fontFamily: FONT_MONO,
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {(entry.model || 'unknown').replace('claude-', '')}
            </span>
            <span style={{ fontSize: 10, color: '#e2e8f0', fontFamily: FONT_MONO, flexShrink: 0 }}>
              {metric === 'cost' ? fmtCost(entry.cost) : fmtTokens(entry.tokens)}
            </span>
            <span style={{ fontSize: 9, color: DIM, fontFamily: FONT_MONO, flexShrink: 0, minWidth: 34, textAlign: 'right' }}>
              {(entry.pct ?? 0).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
