import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  BG, CARD_BG, BORDER, DIM, TEXT, FONT_MONO, FONT_SANS,
  BLUE, ORANGE, EMERALD, GREEN,
  fmtTokens, fmtCost, getModelColor,
} from '../dashboard/theme'

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_RANGES = [7, 14, 30, 60, 90]
const WEEK_RANGES = [4, 8, 12, 26]
const MONTH_RANGES = [3, 6, 12]

// ── Shared components ────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: DIM, marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: '14px 16px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function RangeButton({ value, current, onChange, label }) {
  const active = value === current
  return (
    <button
      onClick={() => onChange(value)}
      style={{
        background: active ? '#1e293b' : 'none',
        border: `1px solid ${active ? '#334155' : 'transparent'}`,
        borderRadius: 4, color: active ? TEXT : '#475569',
        cursor: 'pointer', padding: '2px 8px', fontSize: 10,
        fontFamily: FONT_MONO,
      }}
    >
      {label || value}
    </button>
  )
}

function StatPill({ label, value, color = TEXT }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: FONT_MONO }}>{value}</div>
      <div style={{ fontSize: 9, color: DIM, letterSpacing: '0.08em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function EmptyState({ message = 'No data in this range' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: DIM, fontFamily: FONT_MONO, fontSize: 12,
    }}>
      {message}
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: '8px 12px', fontSize: 11, fontFamily: FONT_MONO,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: DIM, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || TEXT, marginBottom: 2 }}>
          {p.name}: {metric === 'cost' ? fmtCost(p.value) : fmtTokens(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── Daily trend chart ─────────────────────────────────────────────────────────

function DailyTrendChart({ days, setDays, models, model, setModel, metric, setMetric }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.electronAPI?.historyGetDaily({ days, model: model === 'all' ? null : model })
      .then(rows => { setData(rows || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days, model])

  const totals = data.reduce((acc, r) => ({
    tokens: acc.tokens + (r.total_tokens || 0),
    cost: acc.cost + (r.cost || 0),
    requests: acc.requests + (r.request_count || 0),
  }), { tokens: 0, cost: 0, requests: 0 })

  const dataKey = metric === 'cost' ? 'cost' : 'total_tokens'

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SectionTitle>Daily Trend</SectionTitle>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Metric toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            {['tokens', 'cost'].map(m => (
              <RangeButton key={m} value={m} current={metric} onChange={setMetric} />
            ))}
          </div>
          {/* Model filter */}
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{
              background: '#0f172a', border: `1px solid ${BORDER}`, borderRadius: 5,
              color: TEXT, fontSize: 10, fontFamily: FONT_MONO, padding: '2px 6px',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">All models</option>
            {models.map(m => (
              <option key={m} value={m}>{m.replace('claude-', '')}</option>
            ))}
          </select>
          {/* Day range */}
          <div style={{ display: 'flex', gap: 2 }}>
            {DAY_RANGES.map(d => (
              <RangeButton key={d} value={d} current={days} onChange={setDays} label={`${d}d`} />
            ))}
          </div>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 4 }}>
        <StatPill label="TOTAL TOKENS" value={fmtTokens(totals.tokens)} color={BLUE} />
        <StatPill label="TOTAL COST" value={fmtCost(totals.cost)} color={EMERALD} />
        <StatPill label="REQUESTS" value={totals.requests.toLocaleString()} color={ORANGE} />
        <StatPill label="AVG / DAY" value={fmtTokens(data.length ? totals.tokens / data.length : 0)} />
      </div>

      <div style={{ height: 200 }}>
        {loading ? (
          <EmptyState message="Loading…" />
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label" tick={{ fill: DIM, fontSize: 9, fontFamily: FONT_MONO }}
                axisLine={false} tickLine={false}
                interval={Math.ceil(data.length / 8) - 1}
              />
              <YAxis
                tick={{ fill: DIM, fontSize: 9, fontFamily: FONT_MONO }}
                axisLine={false} tickLine={false} width={48}
                tickFormatter={v => metric === 'cost' ? fmtCost(v) : fmtTokens(v)}
              />
              <Tooltip content={<ChartTooltip metric={metric} />} />
              <Area
                type="monotone" dataKey={dataKey} name={metric === 'cost' ? 'Cost' : 'Tokens'}
                stroke={BLUE} fill="url(#areaGrad)" strokeWidth={2} dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

// ── Week-over-week chart ──────────────────────────────────────────────────────

function WeeklyChart({ weeks, setWeeks, metric }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.electronAPI?.historyGetWeekly({ weeks })
      .then(rows => { setData(rows || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [weeks])

  const dataKey = metric === 'cost' ? 'cost' : 'total_tokens'

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>Week over Week</SectionTitle>
        <div style={{ display: 'flex', gap: 2 }}>
          {WEEK_RANGES.map(w => (
            <RangeButton key={w} value={w} current={weeks} onChange={setWeeks} label={`${w}w`} />
          ))}
        </div>
      </div>
      <div style={{ height: 180 }}>
        {loading ? (
          <EmptyState message="Loading…" />
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label" tick={{ fill: DIM, fontSize: 9, fontFamily: FONT_MONO }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: DIM, fontSize: 9, fontFamily: FONT_MONO }}
                axisLine={false} tickLine={false} width={48}
                tickFormatter={v => metric === 'cost' ? fmtCost(v) : fmtTokens(v)}
              />
              <Tooltip content={<ChartTooltip metric={metric} />} />
              <Bar
                dataKey={dataKey} name={metric === 'cost' ? 'Cost' : 'Tokens'}
                fill={ORANGE} radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

// ── Monthly summary table ─────────────────────────────────────────────────────

function MonthlyTable({ months, setMonths }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.electronAPI?.historyGetMonthly({ months })
      .then(rows => { setData(rows || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [months])

  const maxTokens = Math.max(...data.map(r => r.total_tokens || 0), 1)

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>Monthly Summary</SectionTitle>
        <div style={{ display: 'flex', gap: 2 }}>
          {MONTH_RANGES.map(m => (
            <RangeButton key={m} value={m} current={months} onChange={setMonths} label={`${m}mo`} />
          ))}
        </div>
      </div>

      {loading ? (
        <EmptyState message="Loading…" />
      ) : data.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowY: 'auto', maxHeight: 320 }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 90px 80px 80px 60px',
            gap: 8, padding: '0 4px 6px',
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 9, color: DIM, fontFamily: FONT_MONO, letterSpacing: '0.06em',
          }}>
            <span>MONTH</span>
            <span>TOKENS</span>
            <span style={{ textAlign: 'right' }}>INPUT</span>
            <span style={{ textAlign: 'right' }}>OUTPUT</span>
            <span style={{ textAlign: 'right' }}>COST</span>
            <span style={{ textAlign: 'right' }}>REQS</span>
          </div>
          {[...data].reverse().map((row, i) => (
            <div
              key={row.month || i}
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 90px 80px 80px 60px',
                gap: 8, padding: '7px 4px',
                borderBottom: `1px solid ${BORDER}22`,
                fontSize: 11, fontFamily: FONT_MONO,
              }}
            >
              <span style={{ color: DIM }}>{row.label}</span>
              {/* Token bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{
                  height: 6, borderRadius: 3, flexShrink: 0,
                  background: BLUE,
                  width: `${Math.round((row.total_tokens / maxTokens) * 100)}%`,
                  minWidth: 2,
                }} />
                <span style={{ color: TEXT, flexShrink: 0 }}>{fmtTokens(row.total_tokens)}</span>
              </div>
              <span style={{ color: DIM, textAlign: 'right' }}>{fmtTokens(row.input_tokens)}</span>
              <span style={{ color: DIM, textAlign: 'right' }}>{fmtTokens(row.output_tokens)}</span>
              <span style={{ color: EMERALD, textAlign: 'right' }}>{fmtCost(row.cost)}</span>
              <span style={{ color: DIM, textAlign: 'right' }}>{row.request_count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Export button ─────────────────────────────────────────────────────────────

function ExportBar() {
  const [format, setFormat] = useState('csv')
  const [scope, setScope] = useState('sessions')
  const [state, setState] = useState('idle') // idle | saving | done | error

  async function handleExport() {
    setState('saving')
    try {
      const result = await window.electronAPI?.exportData({ format, scope })
      setState(result?.ok ? 'done' : 'error')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <Card style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
      <span style={{ fontSize: 10, color: DIM, fontFamily: FONT_MONO, letterSpacing: '0.06em', marginRight: 4 }}>
        EXPORT
      </span>
      <div style={{ display: 'flex', gap: 2 }}>
        {['csv', 'json'].map(f => (
          <RangeButton key={f} value={f} current={format} onChange={setFormat} label={f.toUpperCase()} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {['sessions', 'requests', 'all'].map(s => (
          <RangeButton key={s} value={s} current={scope} onChange={setScope} />
        ))}
      </div>
      <button
        onClick={handleExport}
        disabled={state === 'saving'}
        style={{
          background: 'none', border: `1px solid ${BORDER}`, borderRadius: 5,
          color: state === 'done' ? GREEN : state === 'error' ? '#ef4444' : TEXT,
          cursor: state === 'saving' ? 'wait' : 'pointer',
          padding: '4px 12px', fontSize: 11, fontFamily: FONT_MONO,
          opacity: state === 'saving' ? 0.6 : 1,
        }}
      >
        {state === 'saving' ? 'Saving…' : state === 'done' ? 'Saved ✓' : state === 'error' ? 'Error' : 'Export…'}
      </button>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [days, setDays] = useState(30)
  const [weeks, setWeeks] = useState(8)
  const [months, setMonths] = useState(6)
  const [metric, setMetric] = useState('tokens') // shared by daily + weekly
  const [model, setModel] = useState('all')
  const [models, setModels] = useState([])

  useEffect(() => {
    window.electronAPI?.historyGetModels()
      .then(list => setModels(list || []))
      .catch(() => {})
  }, [])

  return (
    <div style={{
      background: BG, minHeight: '100vh',
      padding: '16px 20px',
      fontFamily: FONT_SANS, color: TEXT,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 800, fontFamily: FONT_MONO,
            background: 'linear-gradient(90deg, #e2e8f0 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            ClaudeStats — History
          </h1>
          <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>
            Long-term usage analysis · all data is local
          </div>
        </div>
        <button
          onClick={() => window.close()}
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', cursor: 'pointer', padding: '5px 12px', fontSize: 11,
            fontFamily: FONT_MONO,
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#ef4444'; e.target.style.color = '#ef4444' }}
          onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b' }}
        >
          ✕
        </button>
      </div>

      {/* Charts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <DailyTrendChart
          days={days} setDays={setDays}
          models={models} model={model} setModel={setModel}
          metric={metric} setMetric={setMetric}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <WeeklyChart weeks={weeks} setWeeks={setWeeks} metric={metric} />
          <MonthlyTable months={months} setMonths={setMonths} />
        </div>
        <ExportBar />
      </div>
    </div>
  )
}
