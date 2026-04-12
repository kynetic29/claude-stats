import { useState, useEffect } from 'react'

export const LAYOUT_VARIANTS = ['tall', 'standard', 'wide-2to1', 'ultrawide', 'superwide']

// Pure function — exported for testing
export function classifyLayout(ratio) {
  if (ratio <= 1.5) return 'tall'
  if (ratio <= 1.9) return 'standard'
  if (ratio <= 2.2) return 'wide-2to1'
  if (ratio <= 3.0) return 'ultrawide'
  return 'superwide'
}

/**
 * Returns the active layout variant based on window aspect ratio.
 *
 * In dev mode (import.meta.env.DEV), Ctrl+Shift+K cycles through all
 * variants regardless of window size — useful for visual QA without
 * physically resizing to target aspect ratios.
 *
 * @returns {{ layout: string, isDevOverride: boolean }}
 */
export function useLayout() {
  const [naturalLayout, setNaturalLayout] = useState(() =>
    classifyLayout(window.innerWidth / window.innerHeight)
  )
  const [devOverride, setDevOverride] = useState(null)

  // Track actual window aspect ratio
  useEffect(() => {
    function onResize() {
      setNaturalLayout(classifyLayout(window.innerWidth / window.innerHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Dev-only keyboard shortcut: Ctrl+Shift+K cycles layout variants
  useEffect(() => {
    if (!import.meta.env.DEV) return

    function onKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        setDevOverride(prev => {
          const base = prev ?? naturalLayout
          const idx = LAYOUT_VARIANTS.indexOf(base)
          return LAYOUT_VARIANTS[(idx + 1) % LAYOUT_VARIANTS.length]
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [naturalLayout])

  return {
    layout: devOverride ?? naturalLayout,
    isDevOverride: devOverride !== null,
  }
}
