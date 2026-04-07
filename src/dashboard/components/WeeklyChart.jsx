import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { CARD_BG, BORDER, DIM, FONT_MONO } from '../theme'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: '8px 12px', fontSize: 11, color: '#e2e8f0',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#c084fc' }}>{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <span style={{ color: '#fff', fontWeight: 600 }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function WeeklyChart({ dailyBreakdown }) {
  if (!dailyBreakdown || dailyBreakdown.length === 0) {
    return (
      <div style={{
        background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
        padding: 20, textAlign: 'center', color: DIM, fontFamily: FONT_MONO, fontSize: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
      }}>
        No data for this week yet
      </div>
    )
  }

  // Aggregate by day bucket
  const byDay = new Map()
  for (const row of dailyBreakdown) {
    const dayMs = row.day_bucket * 86400000
    const date = new Date(dayMs)
    const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!byDay.has(label)) {
      byDay.set(label, { name: label, Input: 0, Output: 0, Cache: 0, Requests: 0 })
    }
    const d = byDay.get(label)
    d.Input += row.input_tokens || 0
    d.Output += row.output_tokens || 0
    d.Cache += row.cache_creation || 0
    d.Requests += row.request_count || 0
  }

  const data = [...byDay.values()]

  return (
    <div style={{
      background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
      padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: DIM, marginBottom: 8,
      }}>
        Weekly Token Usage
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: DIM, fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: DIM, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Input" stackId="1" fill="#38bdf8" stroke="#38bdf8" fillOpacity={0.3} />
            <Area type="monotone" dataKey="Output" stackId="1" fill="#c084fc" stroke="#c084fc" fillOpacity={0.3} />
            <Area type="monotone" dataKey="Cache" stackId="1" fill="#fb923c" stroke="#fb923c" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 12, paddingTop: 4, justifyContent: 'center' }}>
        {[
          { label: 'Input', color: '#38bdf8' },
          { label: 'Output', color: '#c084fc' },
          { label: 'Cache Create', color: '#fb923c' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: DIM }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} /> {label}
          </div>
        ))}
      </div>
    </div>
  )
}
