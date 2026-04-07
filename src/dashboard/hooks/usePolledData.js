import { useState, useEffect, useRef } from 'react'

export function usePolledData(intervalMs = 3000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    let mounted = true

    async function poll() {
      try {
        const result = await window.electronAPI.getDashboardData()
        if (mounted) {
          setData(result)
          setError(null)
        }
      } catch (e) {
        if (mounted) setError(e.message)
      }
    }

    poll()
    timerRef.current = setInterval(poll, intervalMs)

    return () => {
      mounted = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [intervalMs])

  return { data, error }
}
