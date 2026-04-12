import { useEffect, useState } from 'react'
import { CARD_BG, BORDER, FONT_MONO, EMERALD, BLUE, YELLOW, RED, DIM, TEXT } from '../theme'

export default function UpdateToast() {
  const [status, setStatus] = useState({ state: 'idle' })
  const [currentVersion, setCurrentVersion] = useState(null)
  // null | 'confirm' | 'checking' | 'installing'
  const [modalPhase, setModalPhase] = useState(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.getAppVersion?.().then(v => setCurrentVersion(v)).catch(() => {})
    api.getUpdateStatus?.().then(setStatus).catch(() => {})

    const unsubscribe = api.onUpdateStatus?.((s) => setStatus(s))
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '4px 10px', borderRadius: 6, fontSize: 11,
    fontFamily: FONT_MONO, border: '1px solid', lineHeight: 1,
  }

  // Modal is rendered at the top level so it survives status transitions
  // (e.g. status → 'checking' while the confirm dialog is open).
  const modal = modalPhase !== null ? (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      // Only allow backdrop-dismiss in the confirm phase
      onClick={modalPhase === 'confirm' ? () => setModalPhase(null) : undefined}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: CARD_BG, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '24px 28px', width: 340,
          fontFamily: FONT_MONO,
        }}
      >
        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 16 }}>
          Install Update
        </div>

        {/* Version pill — status.version updates live if a newer version is found */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#0f172a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16,
          border: `1px solid ${BORDER}`,
        }}>
          <span style={{ color: DIM, fontSize: 12 }}>v{currentVersion ?? '…'}</span>
          <span style={{ color: '#334155', fontSize: 11 }}>→</span>
          <span style={{
            color: modalPhase === 'checking' ? YELLOW : EMERALD,
            fontSize: 12, fontWeight: 700,
          }}>
            v{status.version}
          </span>
          {modalPhase === 'confirm' && (
            <span style={{
              marginLeft: 'auto', fontSize: 8, color: EMERALD, fontWeight: 700,
              background: `${EMERALD}18`, padding: '2px 6px', borderRadius: 3,
              border: `1px solid ${EMERALD}44`,
            }}>READY</span>
          )}
          {modalPhase === 'checking' && (
            <span style={{
              marginLeft: 'auto', fontSize: 8, color: YELLOW, fontWeight: 700,
              background: `${YELLOW}18`, padding: '2px 6px', borderRadius: 3,
              border: `1px solid ${YELLOW}44`,
            }}>CHECKING</span>
          )}
          {modalPhase === 'installing' && (
            <span style={{
              marginLeft: 'auto', fontSize: 8, color: BLUE, fontWeight: 700,
              background: `${BLUE}18`, padding: '2px 6px', borderRadius: 3,
              border: `1px solid ${BLUE}44`,
            }}>INSTALLING</span>
          )}
        </div>

        {/* Body */}
        {modalPhase === 'confirm' && (
          <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6, marginBottom: 20 }}>
            The update has already been downloaded. The app will restart to apply it.
            Any in-progress work will be unaffected — ClaudeStats resumes automatically.
          </div>
        )}
        {modalPhase === 'checking' && (
          <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6, marginBottom: 20 }}>
            Checking for the latest version before restarting…
          </div>
        )}
        {modalPhase === 'installing' && (
          <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6, marginBottom: 20 }}>
            Installing and restarting…
          </div>
        )}

        {/* Actions */}
        {modalPhase === 'confirm' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setModalPhase(null)}
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
              onClick={async () => {
                setModalPhase('checking')
                await window.electronAPI?.installUpdate()
                setModalPhase('installing')
              }}
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
        )}
        {(modalPhase === 'checking' || modalPhase === 'installing') && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: DIM, fontSize: 11,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: modalPhase === 'checking' ? YELLOW : BLUE,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            {modalPhase === 'checking' ? 'Please wait…' : 'Restarting…'}
          </div>
        )}
      </div>
    </div>
  ) : null

  // Keep rendering if modal is open, even if status transitions away from 'downloaded'
  if ((!status || status.state === 'idle' || status.state === 'checking') && modalPhase === null) {
    return null
  }

  if (status.state === 'available') {
    return (
      <>
        {modal}
        <div style={{ ...base, borderColor: BLUE, color: BLUE }} title={`Downloading v${status.version}…`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
          update available
        </div>
      </>
    )
  }

  if (status.state === 'downloading') {
    return (
      <>
        {modal}
        <div style={{ ...base, borderColor: BLUE, color: BLUE }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: BLUE,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          downloading {status.percent ?? 0}%
        </div>
      </>
    )
  }

  if (status.state === 'downloaded') {
    const versionLabel = currentVersion
      ? `v${currentVersion} → v${status.version}`
      : `v${status.version} ready`

    return (
      <>
        {modal}
        <button
          onClick={() => setModalPhase('confirm')}
          title="Click to review and install update"
          style={{
            ...base, borderColor: EMERALD, color: EMERALD,
            background: 'none', cursor: 'pointer',
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
      <>
        {modal}
        <div
          style={{ ...base, borderColor: RED, color: RED, opacity: 0.7 }}
          title={status.message || 'Update error'}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED }} />
          update error
        </div>
      </>
    )
  }

  // Fallback: modal may still be open while status is in transition
  return modal
}
