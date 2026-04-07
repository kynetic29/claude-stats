import { useState, useEffect } from 'react'

const DIM = '#94a3b8'
const BG = '#060d1a'
const CARD_BG = '#0f172a'
const BORDER = '#1e293b'
const ACCENT = '#38bdf8'

const primaryBtn = {
  padding: '10px 24px',
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
  border: 'none', borderRadius: 8,
  color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  fontFamily: "'IBM Plex Sans', sans-serif",
}

const ghostBtn = {
  padding: '10px 24px',
  background: 'transparent',
  border: `1px solid ${BORDER}`, borderRadius: 8,
  color: DIM, fontSize: 14, cursor: 'pointer',
  fontFamily: "'IBM Plex Sans', sans-serif",
}

const inputStyle = (active) => ({
  width: '100%', padding: '10px 14px',
  background: '#1e293b', border: `1px solid ${active ? ACCENT + '66' : BORDER}`,
  borderRadius: 8, color: '#e2e8f0', fontSize: 14,
  fontFamily: "'JetBrains Mono', monospace", outline: 'none',
})

const STEPS = [
  { title: 'Welcome to ClaudeStats', subtitle: 'Real-time Claude Code usage monitoring' },
  { title: 'Connect to Claude.ai', subtitle: 'Get real-time usage data matching the Claude usage panel' },
  { title: 'Admin API Key (Optional)', subtitle: 'Enables org-wide usage history from Anthropic' },
  { title: 'Weekly Reset Schedule', subtitle: 'When does your weekly limit reset?' },
  { title: 'Choose Display', subtitle: 'Pick which monitor shows the dashboard' },
]

export default function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [claudeConnected, setClaudeConnected] = useState(false)
  const [claudeConnecting, setClaudeConnecting] = useState(false)
  const [claudeError, setClaudeError] = useState('')
  const [adminApiKey, setAdminApiKey] = useState('')
  const [resetDay, setResetDay] = useState(1) // Monday
  const [resetHour, setResetHour] = useState(6) // 6 AM
  const [displays, setDisplays] = useState([])
  const [selectedDisplay, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (step !== 4) return
    window.electronAPI.getDisplays().then(list => {
      setDisplays(list)
      const preferred = list.find(d => !d.isPrimary) ?? list[0]
      if (preferred) setSelected(preferred.id)
    })
  }, [step])

  async function handleFinish() {
    if (!selectedDisplay || saving) return
    setSaving(true)
    setError('')
    try {
      await window.electronAPI.completeOnboarding({
        adminApiKey: adminApiKey.trim() || null,
        resetDay,
        resetHour,
        displayId: selectedDisplay,
      })
    } catch {
      setError('Failed to save configuration. Please try again.')
      setSaving(false)
    }
  }

  const canAdvance =
    step === 0 ? true :
    step === 1 ? true : // optional (Claude.ai login)
    step === 2 ? true : // optional (admin API key)
    step === 3 ? true :
    !!selectedDisplay

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div style={{
      background: BG, minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', sans-serif", color: '#e2e8f0',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        button:disabled { cursor: not-allowed; }
        input::placeholder { color: #334155; }
        select { appearance: none; }
      `}</style>

      <div style={{
        position: 'relative', width: 480,
        background: CARD_BG, border: `1px solid ${BORDER}`,
        borderRadius: 16, padding: '36px 40px',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Exit */}
        <button
          onClick={() => window.electronAPI.quit()}
          title="Exit"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'transparent', border: 'none', color: DIM,
            fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
          }}
        >✕</button>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? ACCENT : BORDER,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0',
          }}>{STEPS[step].title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: DIM }}>{STEPS[step].subtitle}</p>
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.7 }}>
            <p style={{ marginTop: 0 }}>
              ClaudeStats monitors your Claude Code usage in real time — token consumption,
              session limits, and weekly limits on a dedicated display.
            </p>
            <p style={{ color: DIM, fontSize: 13 }}>
              Data is collected from your local Claude Code JSONL files and OpenTelemetry metrics.
              No data leaves your machine.
            </p>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 0 }}>
              Press <kbd style={{ background: BORDER, borderRadius: 4, padding: '1px 5px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                Ctrl+Shift+Q
              </kbd> to quit, <kbd style={{ background: BORDER, borderRadius: 4, padding: '1px 5px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                Ctrl+Shift+R
              </kbd> to reset setup.
            </p>
          </div>
        )}

        {/* Step 1 — Claude.ai Login (Optional) */}
        {step === 1 && (
          <div>
            {claudeConnected ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>&#10003;</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#34d399', marginBottom: 8 }}>Connected to Claude.ai</div>
                <p style={{ fontSize: 12, color: DIM, marginBottom: 0 }}>
                  Your dashboard will show real-time usage data matching the Claude usage panel.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.7, marginTop: 0 }}>
                  Sign in to your Claude.ai account to get <strong style={{ color: '#e2e8f0' }}>exact, real-time</strong> session
                  and weekly usage percentages — the same data shown on the Claude usage panel.
                </p>
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  <button
                    onClick={async () => {
                      setClaudeConnecting(true)
                      setClaudeError('')
                      try {
                        const result = await window.electronAPI.claudeLogin()
                        if (result.ok) {
                          setClaudeConnected(true)
                        } else {
                          setClaudeError(result.error || 'Login failed')
                        }
                      } catch (e) {
                        setClaudeError(e.message || 'Login failed')
                      }
                      setClaudeConnecting(false)
                    }}
                    disabled={claudeConnecting}
                    style={{
                      ...primaryBtn,
                      padding: '12px 32px',
                      fontSize: 15,
                      opacity: claudeConnecting ? 0.6 : 1,
                    }}
                  >
                    {claudeConnecting ? 'Waiting for login...' : 'Sign in to Claude.ai'}
                  </button>
                </div>
                {claudeError && (
                  <p style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{claudeError}</p>
                )}
                <p style={{ fontSize: 12, color: '#475569', marginBottom: 0, textAlign: 'center' }}>
                  You can skip this — the dashboard will estimate usage from local data instead.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Admin API Key (Optional) */}
        {step === 2 && (
          <div>
            <label style={{
              fontSize: 11, color: DIM, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: 8,
            }}>Admin API Key</label>
            <input
              autoFocus type="password"
              value={adminApiKey}
              onChange={e => setAdminApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setStep(3)}
              placeholder="sk-ant-admin01-... (optional)"
              style={inputStyle(adminApiKey.length > 0)}
            />
            <p style={{ fontSize: 12, color: DIM, marginTop: 8 }}>
              Generate at <span style={{ color: ACCENT, fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                console.anthropic.com → Settings → Admin Keys
              </span>. Enables pulling org-wide usage history.
            </p>
            <p style={{ fontSize: 12, color: '#475569', marginBottom: 0 }}>
              You can skip this — the dashboard works without it using local data.
            </p>
          </div>
        )}

        {/* Step 3 — Weekly Reset */}
        {step === 3 && (
          <div>
            <label style={{
              fontSize: 11, color: DIM, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: 8,
            }}>Reset Day</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {DAYS.map((day, i) => (
                <button key={i} onClick={() => setResetDay(i)} style={{
                  flex: 1, padding: '8px 4px',
                  background: resetDay === i ? '#1e293b' : 'transparent',
                  border: `1px solid ${resetDay === i ? ACCENT + '66' : BORDER}`,
                  borderRadius: 6, cursor: 'pointer',
                  color: resetDay === i ? '#e2e8f0' : DIM,
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}>{day.slice(0, 3)}</button>
              ))}
            </div>

            <label style={{
              fontSize: 11, color: DIM, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: 8,
            }}>Reset Hour (Local Time)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" min="0" max="23" value={resetHour}
                onChange={e => setResetHour(parseInt(e.target.value) || 0)}
                style={{ ...inputStyle(true), width: 80 }}
              />
              <span style={{ color: DIM, fontSize: 13 }}>:00</span>
              <span style={{ color: '#475569', fontSize: 12, marginLeft: 8 }}>
                ({resetHour < 12 ? `${resetHour || 12} AM` : `${resetHour - 12 || 12} PM`})
              </span>
            </div>
          </div>
        )}

        {/* Step 4 — Display picker */}
        {step === 4 && (
          <div>
            {displays.length === 0 ? (
              <div style={{ color: DIM, fontSize: 13 }}>Detecting displays…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {displays.map(d => {
                  const active = selectedDisplay === d.id
                  return (
                    <button key={d.id} onClick={() => setSelected(d.id)} style={{
                      padding: '14px 16px',
                      background: active ? '#1e293b' : 'transparent',
                      border: `1px solid ${active ? ACCENT + '66' : BORDER}`,
                      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                    }}>
                      <div style={{
                        width: 38, height: 26,
                        border: `2px solid ${active ? ACCENT : DIM}`,
                        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ width: 22, height: 14, background: active ? ACCENT + '33' : BORDER, borderRadius: 2 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: active ? '#e2e8f0' : DIM,
                          fontFamily: "'JetBrains Mono', monospace",
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          {d.label}
                          {d.isPrimary && <span style={{ fontSize: 10, color: '#34d399', fontWeight: 400 }}>primary</span>}
                        </div>
                        <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>
                          {d.bounds.width} × {d.bounds.height}
                          {d.scaleFactor !== 1 && ` · ${d.scaleFactor}x`}
                        </div>
                      </div>
                      {active && <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`,
                      }} />}
                    </button>
                  )
                })}
              </div>
            )}
            {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 12, marginBottom: 0 }}>{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={ghostBtn}>Back</button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance}
              style={{ ...primaryBtn, opacity: canAdvance ? 1 : 0.4 }}
            >
              {step === 0 ? 'Get Started' : step === 1 && !claudeConnected ? 'Skip' : step === 2 && !adminApiKey.trim() ? 'Skip' : 'Continue'}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!selectedDisplay || saving}
              style={{ ...primaryBtn, opacity: (!selectedDisplay || saving) ? 0.4 : 1 }}
            >
              {saving ? 'Launching…' : 'Launch Dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
