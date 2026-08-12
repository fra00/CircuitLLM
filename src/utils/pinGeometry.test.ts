import { describe, expect, it } from 'vitest'
import { estimateNodeSize, pinSide } from './pinGeometry'
import type { Component } from '../types/circuit'

describe('pinSide', () => {
  it('places OUTPUT pins on the right', () => {
    expect(pinSide('OUTPUT', 0)).toBe('right')
  })

  it('places INPUT pins on the left', () => {
    expect(pinSide('INPUT', 0)).toBe('left')
  })

  it('alternates PASSIVE pins left/right', () => {
    expect(pinSide('PASSIVE', 0)).toBe('left')
    expect(pinSide('PASSIVE', 1)).toBe('right')
    expect(pinSide('PASSIVE', 2)).toBe('left')
  })
})

describe('estimateNodeSize', () => {
  it('grows height with pin count', () => {
    const small: Component = {
      id: 'R1',
      label: 'R',
      type: 'RESISTOR',
      pins: [{ id: '1', label: '1', type: 'PASSIVE' }],
    }
    const large: Component = {
      ...small,
      pins: Array.from({ length: 10 }, (_, i) => ({
        id: `P${i}`,
        label: `P${i}`,
        type: 'PASSIVE' as const,
      })),
    }
    expect(estimateNodeSize(large).height).toBeGreaterThan(estimateNodeSize(small).height)
  })

  it('adds value row height when value is set', () => {
    const base: Component = {
      id: 'R1',
      label: 'R',
      type: 'RESISTOR',
      pins: [{ id: '1', label: '1', type: 'PASSIVE' }],
    }
    const withValue = { ...base, value: '10k' }
    expect(estimateNodeSize(withValue).height).toBeGreaterThan(estimateNodeSize(base).height)
  })
})
