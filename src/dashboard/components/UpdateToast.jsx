import { useEffect, useState } from 'react'
import { CARD_BG, BORDER, FONT_MONO, EMERALD, BLUE, YELLOW, RED, DIM, TEXT } from '../theme'

export default function UpdateToast() {
  const [status, setStatus] = useState({ state: 'idle' })
  const [currentVersion, setCurrentVersion] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    // Fetch current installed version once
    api.getAppVersion?.().then(v => setCurrentVersion(v)).catch(() => {})

    // Prime current update state
    api.getUpdateStatus?.().then(setStatus).catch(() => {})

    // Subscribe to live update events from the main process
    const unsubscribe = api.onUpdateStatus?.((s) => setStatus(s))
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  if (!status || status.state === 'idle' || status.state === 'checking') {
    return null
  }

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: FONT_MONO,
    border: '1px solid',
    lineHeight: 1,
  }

  // Confirmation overlay — rendered as a fixed modal so it works regardless
  // of where UpdateToast is placed in the header.
  const confirmDialog = showConfirm && status.state === 'downloaded' ? (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => setShowConfirm(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '24px 28px',
          width: 340,
          fontFamily: FONT_MONO,
        }}
      >
        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 16 }}>
          Install Update
        </div>

        {/* Version pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#0f172a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16,
          border: `1px solid ${BORDER}`,
        }}>
          <span style={{ color: DIM, fontSize: 12 }}>
            v{currentVersion ?? '…'}
          </span>
          <span style={{ color: '#334155', fontSize: 11 }}>→</span>
          <span style={{ color: EMERALD, fontSize: 12, fontWeight: 700 }}>
            v{status.version}
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 8, color: EMERALD, fontWeight: 700,
            background: `${EMERALD}18`, padding: '2px 6px', borderRadius: 3,
            border: `1px solid ${EMERALD}44`,
          }}>
            READY
          </span>
        </div>

        {/* Body */}
        <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6, marginBottom: 20 }}>
          The update has already been downloaded. The app will restart to apply it.
          Any in-progress work will be unaffected — ClaudeStats resumes automatically.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowConfirm(false)}
            style={{
              background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6,
              color: DIM, cursor: 'pointer', padding: '7px 16px', fontSize: 11,
              fontFamily: FONT_MONO,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#475569' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER }}
          >
            Not now
          </button>
          <button
            onClick={() => window.electronAPI?.installUpdate()}
            style={{
              background: EMERALD, border: 'none', borderRadius: 6,
              color: '#060d1a', cursor: 'pointer', padding: '7px 16px',
              fontSize: 11, fontWeight: 700, fontFamily: FONT_MONO,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            Restart &amp; Update
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (status.state === 'available') {
    return (
      <div style={{ ...base, borderColor: BLUE, color: BLUE }} title={`Downloading v${status.version}…`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
        update available
      </div>
    )
  }

  if (status.state === 'downloading') {
    return (
      <div style={{ ...base, borderColor: BLUE, color: BLUE }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: BLUE,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        downloading {status.percent ?? 0}%
      </div>
    )
  }

  if (status.state === 'downloaded') {
    const versionLabel = currentVersion
      ? `v${currentVersion} → v${status.version}`
      : `v${status.version} ready`

    return (
      <>
        {confirmDialog}
        <button
          onClick={() => setShowConfirm(true)}
          title="Click to review and install update"
          style={{
            ...base,
            borderColor: EMERALD,
            color: EMERALD,
            background: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${EMERALD}14` }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: EMERALD,
            boxShadow: `0 0 6px ${EMERALD}`,
          }} />
          {versionLabel}
        </button>
      </>
    )
  }

  if (status.state === 'error') {
    return (
      <div
        style={{ ...base, borderColor: RED, color: RED, opacity: 0.7 }}
        title={status.message || 'Update error'}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED }} />
        update error
      </div>
    )
  }

  return null
}
