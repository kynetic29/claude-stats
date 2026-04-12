import { useState } from 'react'
import {
  CARD_BG, BORDER, DIM, TEXT, FONT_MONO,
  getLimitColor, fmtTokens, fmtCountdown, fmtDuration,
} from '../theme'
import { useCountdown } from '../hooks/useCountdown'

function LimitEditor({ label, currentValue, onSave, onCancel }) {
  const [val, setVal] = useState(String(currentValue || ''))
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }}>
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, width: 320 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 12 }}>Set {label}</div>
        <input
          type="number" value={val} onChange={e => setVal(e.target.value)}
          placeholder="e.g. 500000"
          style={{
            width: '100%', padding: '8px 12px', background: '#060d1a', border: `1px solid ${BORDER}`,
            borderRadius: 6, color: TEXT, fontSize: 13, fontFamily: FONT_MONO, outline: 'none',
          }}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && onSave(parseInt(val) || 0)}
        />
        <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Enter 0 to remove limit</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6,
            color: DIM, cursor: 'pointer', padding: '6px 14px', fontSize: 11,
          }}>Cancel</button>
          <button onClick={() => onSave(parseInt(val) || 0)} style={{
            background: '#38bdf8', border: 'none', borderRadius: 6,
            color: '#060d1a', cursor: 'pointer', padding: '6px 14px', fontSize: 11, fontWeight: 700,
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function GaugeBar({ label, pct, current, limit, confidence, countdown, countdownLabel, color, onEditLimit, source, warnPct, critPct, eta, etaApprox }) {
  const remaining = useCountdown(countdown)
  const barColor = getLimitColor(pct, warnPct, critPct)
  const isAuthoritative = source === 'claude-api'
  const isLowConfidence = !isAuthoritative && confidence < 0.3
  const pulse = pct >= 90

  return (
    <div style={{
      flex: 1, background: CARD_BG, borderRadius: 12, border: `1px solid ${BORDER}`,
      padding: '16px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: DIM, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {isAuthoritative && (
            <span style={{
              fontSize: 8, color: '#34d399', fontWeight: 700, letterSpacing: '0.1em',
              background: '#34d39915', padding: '1px 5px', borderRadius: 3,
            }}>LIVE</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: DIM }}>
          {countdownLabel}: <span style={{ color: TEXT, fontFamily: FONT_MONO }}>{fmtCountdown(remaining)}</span>
        </div>
      </div>

      {/* Percentage */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 36, fontWeight: 800, fontFamily: FONT_MONO, color: barColor,
          animation: pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}>
          {isLowConfidence ? '~' : ''}{pct.toFixed(1)}%
        </span>
        {isAuthoritative ? (
          <span style={{ fontSize: 11, color: DIM }}>
            {current > 0 && fmtTokens(current)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: DIM }}>
            {fmtTokens(current)} / {limit > 0 ? fmtTokens(limit) : (
              <span onClick={onEditLimit} style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>set limit</span>
            )}
            {limit > 0 && (
              <span onClick={onEditLimit} style={{ color: '#475569', cursor: 'pointer', marginLeft: 4 }} title="Edit limit">&#9998;</span>
            )}
          </span>
        )}
      </div>

      {/* ETA projection */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: '#475569', fontFamily: FONT_MONO, letterSpacing: '0.06em' }}>ETA</span>
        <span style={{
          fontSize: 11, fontFamily: FONT_MONO,
          color: eta === null ? '#334155' : etaApprox ? '#64748b' : DIM,
        }}>
          {eta === null
            ? '—'
            : `${etaApprox ? '~' : ''}${fmtCountdown(eta)}`
          }
        </span>
        {etaApprox && eta !== null && (
          <span style={{ fontSize: 8, color: '#334155', fontFamily: FONT_MONO }}>est.</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ position: 'relative', height: 10, background: '#1e293b', borderRadius: 5, overflow: 'hidden' }}>
        {/* Uncertainty band for low confidence */}
        {isLowConfidence && (
          <div style={{
            position: 'absolute', top: 0, left: `${Math.max(0, pct - 15)}%`,
            width: '30%', height: '100%',
            background: `${barColor}15`, borderRadius: 5,
          }} />
        )}
        <div style={{
          width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 5,
          background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          transition: 'width 0.8s ease',
          boxShadow: pct >= 80 ? `0 0 12px ${barColor}66` : 'none',
        }} />
      </div>

      {/* Status text */}
      <div style={{ fontSize: 9, color: barColor, marginTop: 4, textAlign: 'right', fontFamily: FONT_MONO }}>
        {pct >= critPct + 15 ? 'NEAR LIMIT!' : pct >= critPct ? 'APPROACHING LIMIT' : pct >= warnPct ? 'MODERATE USAGE' : ''}
        {isLowConfidence && ' (estimate)'}
      </div>
    </div>
  )
}

export default function LimitGauges({ session, weekly, thresholds, onEditLimit, vertical = false, }) {
  const [editing, setEditing] = useState(null)
  const sWarn = thresholds?.sessionWarnPct ?? 60
  const sCrit = thresholds?.sessionCritPct ?? 80
  const wWarn = thresholds?.weeklyWarnPct ?? 60
  const wCrit = thresholds?.weeklyCritPct ?? 80

  const handleSave = (type, value) => {
    setEditing(null)
    if (window.electronAPI?.updateLimitEstimate) {
      window.electronAPI.updateLimitEstimate({
        type,
        model: 'all',
        estimated_limit: value,
        confidence: 0.9,
        observation_count: 1,
        last_updated: Date.now(),
      })
    }
    if (onEditLimit) onEditLimit(type, value)
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 12 }}>
        <GaugeBar
          label="Session Limit"
          pct={session.pct}
          current={session.tokens}
          limit={session.estimatedLimit}
          confidence={session.confidence}
          countdown={session.remainingMs}
          countdownLabel="Resets in"
          color="#38bdf8"
          onEditLimit={() => setEditing('session')}
          source={session.source}
          warnPct={sWarn}
          critPct={sCrit}
          eta={session.eta ?? null}
          etaApprox={session.etaApprox ?? true}
        />
        <GaugeBar
          label="Weekly Limit"
          pct={weekly.pct}
          current={weekly.tokens}
          limit={weekly.estimatedLimit}
          confidence={weekly.confidence}
          countdown={weekly.resetIn}
          countdownLabel="Resets"
          color="#34d399"
          onEditLimit={() => setEditing('weekly')}
          source={weekly.source}
          warnPct={wWarn}
          critPct={wCrit}
          eta={weekly.eta ?? null}
          etaApprox={weekly.etaApprox ?? true}
        />
      </div>

      {editing === 'session' && (
        <LimitEditor
          label="Session Token Limit"
          currentValue={session.estimatedLimit}
          onSave={v => handleSave('session', v)}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing === 'weekly' && (
        <LimitEditor
          label="Weekly Token Limit"
          currentValue={weekly.estimatedLimit}
          onSave={v => handleSave('weekly', v)}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  )
}
