import { useState, useEffect } from 'react'
import { CARD_BG, BORDER, DIM, TEXT, FONT_MONO, FONT_SANS, BLUE, EMERALD } from '../theme'

function ThresholdRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: DIM }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number" min="1" max="99" value={value}
          onChange={e => onChange(Math.max(1, Math.min(99, parseInt(e.target.value) || 0)))}
          style={{
            width: 56, padding: '5px 8px',
            background: '#060d1a', border: `1px solid ${BORDER}`, borderRadius: 6,
            color: TEXT, fontSize: 13, fontFamily: FONT_MONO, outline: 'none',
            textAlign: 'right',
          }}
        />
        <span style={{ fontSize: 12, color: DIM }}>%</span>
      </div>
    </div>
  )
}

export default function SettingsModal({ thresholds, onClose }) {
  const [sWarn, setSWarn] = useState(thresholds?.sessionWarnPct ?? 60)
  const [sCrit, setSCrit] = useState(thresholds?.sessionCritPct ?? 80)
  const [wWarn, setWWarn] = useState(thresholds?.weeklyWarnPct ?? 60)
  const [wCrit, setWCrit] = useState(thresholds?.weeklyCritPct ?? 80)
  const [autoStart, setAutoStart] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.electronAPI?.getAutoStart().then(v => setAutoStart(!!v)).catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await window.electronAPI?.updateConfig({
        sessionWarnPct: sWarn,
        sessionCritPct: sCrit,
        weeklyWarnPct: wWarn,
        weeklyCritPct: wCrit,
      })
      await window.electronAPI?.setAutoStart(autoStart)
      onClose()
    } catch (e) {
      console.error('[settings] save failed', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '20px 24px', width: 340,
          fontFamily: FONT_SANS,
        }}
      >
        <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 16 }}>
          SETTINGS
        </div>

        {/* Thresholds */}
        <div style={{ fontSize: 11, color: DIM, letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>
          Alert Thresholds
        </div>
        <ThresholdRow label="Session — warn at" value={sWarn} onChange={setSWarn} />
        <ThresholdRow label="Session — alert at" value={sCrit} onChange={setSCrit} />
        <div style={{ borderTop: `1px solid ${BORDER}`, margin: '10px 0' }} />
        <ThresholdRow label="Weekly — warn at" value={wWarn} onChange={setWWarn} />
        <ThresholdRow label="Weekly — alert at" value={wCrit} onChange={setWCrit} />

        <div style={{ borderTop: `1px solid ${BORDER}`, margin: '14px 0 12px' }} />

        {/* Auto-start */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: DIM }}>Launch on system startup</span>
          <button
            onClick={() => setAutoStart(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11,
              background: autoStart ? EMERALD : '#334155',
              border: 'none', cursor: 'pointer',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: autoStart ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 16 }}>
          Automatically open ClaudeStats when Windows starts
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6,
              color: DIM, cursor: 'pointer', padding: '6px 14px', fontSize: 11,
              fontFamily: FONT_MONO,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: BLUE, border: 'none', borderRadius: 6,
              color: '#060d1a', cursor: saving ? 'wait' : 'pointer',
              padding: '6px 14px', fontSize: 11, fontWeight: 700,
              fontFamily: FONT_MONO, opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
