import { describe, it, expect } from 'vitest'
import { classifyLayout, LAYOUT_VARIANTS } from './useLayout'

describe('classifyLayout', () => {
  it('classifies portrait and near-square ratios as tall (≤1.5)', () => {
    expect(classifyLayout(0.75)).toBe('tall')   // portrait 3:4
    expect(classifyLayout(1.0)).toBe('tall')    // square
    expect(classifyLayout(1.33)).toBe('tall')   // 4:3
    expect(classifyLayout(1.5)).toBe('tall')    // exact boundary → tall
  })

  it('classifies 16:10 and 16:9 as standard (1.5–1.9)', () => {
    expect(classifyLayout(1.51)).toBe('standard')
    expect(classifyLayout(1.6)).toBe('standard')  // 16:10
    expect(classifyLayout(1.78)).toBe('standard') // 16:9
    expect(classifyLayout(1.9)).toBe('standard')  // exact boundary → standard
  })

  it('classifies 2:1 as wide-2to1 (1.9–2.2)', () => {
    expect(classifyLayout(1.91)).toBe('wide-2to1')
    expect(classifyLayout(2.0)).toBe('wide-2to1')
    expect(classifyLayout(2.2)).toBe('wide-2to1') // exact boundary → wide-2to1
  })

  it('classifies 21:9 as ultrawide (2.2–3.0)', () => {
    expect(classifyLayout(2.21)).toBe('ultrawide')
    expect(classifyLayout(2.37)).toBe('ultrawide') // 21:9
    expect(classifyLayout(3.0)).toBe('ultrawide')  // exact boundary → ultrawide
  })

  it('classifies 32:9 and wider as superwide (>3.0)', () => {
    expect(classifyLayout(3.01)).toBe('superwide')
    expect(classifyLayout(3.56)).toBe('superwide') // 32:9
    expect(classifyLayout(5.0)).toBe('superwide')
  })

  it('returns a value that is always in LAYOUT_VARIANTS', () => {
    const ratios = [0.5, 1.0, 1.5, 1.78, 2.0, 2.5, 3.5]
    for (const r of ratios) {
      expect(LAYOUT_VARIANTS).toContain(classifyLayout(r))
    }
  })
})
