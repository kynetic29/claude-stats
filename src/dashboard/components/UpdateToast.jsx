import { useEffect, useState } from 'react'
import { FONT_MONO, EMERALD, BLUE, YELLOW, RED } from '../theme'

export default function UpdateToast() {
  const [status, setStatus] = useState({ state: 'idle' })

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.getUpdateStatus) return

    // Prime current status
    api.getUpdateStatus().then(setStatus).catch(() => {})

    // Subscribe to live updates
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

  if (status.state === 'available') {
    return (
      <div style={{ ...base, borderColor: BLUE, color: BLUE }} title={`Downloading ${status.version}…`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
        update available
      </div>
    )
  }

  if (status.state === 'downloading') {
    return (
      <div style={{ ...base, borderColor: BLUE, color: BLUE }} title={`Downloading update…`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        downloading {status.percent ?? 0}%
      </div>
    )
  }

  if (status.state === 'downloaded') {
    return (
      <button
        onClick={() => window.electronAPI?.installUpdate()}
        title={`Restart to install ${status.version}`}
        style={{
          ...base,
          borderColor: EMERALD,
          color: EMERALD,
          background: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: EMERALD, boxShadow: `0 0 6px ${EMERALD}` }} />
        restart to update
      </button>
    )
  }

  if (status.state === 'error') {
    return (
      <div style={{ ...base, borderColor: RED, color: RED, opacity: 0.7 }} title={status.message || 'Update error'}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED }} />
        update error
      </div>
    )
  }

  return null
}
