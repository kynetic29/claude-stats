import { useState, useEffect } from 'react'

export function useCountdown(targetMs) {
  const [remaining, setRemaining] = useState(targetMs || 0)

  useEffect(() => {
    setRemaining(targetMs || 0)
    if (!targetMs || targetMs <= 0) return

    const timer = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [targetMs])

  return remaining
}
