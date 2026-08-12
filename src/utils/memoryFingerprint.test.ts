import { describe, expect, it } from 'vitest'
import { computeMemoryFingerprint } from './memoryFingerprint'
import { makeTestCircuit } from '../test/fixtures'

describe('computeMemoryFingerprint', () => {
  const base = {
    goal: 'Robot mobile',
    sessionTurns: [{ role: 'user' as const, text: 'Aggiungi LED', at: 1000 }],
    notifications: [{ timestamp: 2000, summary: 'delta' }],
    circuit: makeTestCircuit(),
  }

  it('is deterministic for the same input', () => {
    const a = computeMemoryFingerprint(base)
    const b = computeMemoryFingerprint(base)
    expect(a).toBe(b)
    expect(a.startsWith('fp_')).toBe(true)
  })

  it('changes when goal changes', () => {
    const a = computeMemoryFingerprint(base)
    const b = computeMemoryFingerprint({ ...base, goal: 'Alimentatore 5V' })
    expect(a).not.toBe(b)
  })

  it('changes when notifications change', () => {
    const a = computeMemoryFingerprint(base)
    const b = computeMemoryFingerprint({
      ...base,
      notifications: [...base.notifications, { timestamp: 3000, summary: 'new' }],
    })
    expect(a).not.toBe(b)
  })

  it('changes when circuit topology changes', () => {
    const a = computeMemoryFingerprint(base)
    const b = computeMemoryFingerprint({
      ...base,
      circuit: makeTestCircuit({ circuit_name: 'Changed' }),
    })
    expect(a).not.toBe(b)
  })
})
