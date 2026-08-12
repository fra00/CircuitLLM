import { describe, expect, it } from 'vitest'
import { buildDeltaContext, diffCircuits } from './diff'
import { makeTestCircuit } from '../test/fixtures'

describe('diffCircuits', () => {
  it('returns null when nothing changed', () => {
    const circuit = makeTestCircuit()
    expect(diffCircuits(circuit, circuit)).toBeNull()
  })

  it('detects component value updates', () => {
    const prev = makeTestCircuit()
    const next = makeTestCircuit({
      components: prev.components.map((c) =>
        c.id === 'R1' ? { ...c, value: '4.7k' } : c,
      ),
    })
    const summary = diffCircuits(prev, next)
    expect(summary).toContain("updated component 'R1' value")
    expect(summary).toContain('10k')
    expect(summary).toContain('4.7k')
  })

  it('detects added and removed components', () => {
    const prev = makeTestCircuit()
    const next = makeTestCircuit({
      components: [
        ...prev.components,
        {
          id: 'C1',
          label: 'Filter cap',
          type: 'CAPACITOR',
          value: '100nF',
          pins: [
            { id: '1', label: '1', type: 'PASSIVE' },
            { id: '2', label: '2', type: 'PASSIVE' },
          ],
        },
      ].filter((c) => c.id !== 'U1'),
    })
    const summary = diffCircuits(prev, next)
    expect(summary).toContain("added component 'C1'")
    expect(summary).toContain("removed component 'U1'")
  })

  it('detects net connection changes', () => {
    const prev = makeTestCircuit()
    const next = makeTestCircuit({
      nets: [
        {
          name: 'SIGNAL',
          connections: [
            { component_id: 'U1', pin_id: 'D0' },
            { component_id: 'R1', pin_id: 'A' },
            { component_id: 'R1', pin_id: 'B' },
          ],
        },
      ],
    })
    const summary = diffCircuits(prev, next)
    expect(summary).toContain("connected 'R1.B' to net 'SIGNAL'")
  })
})

describe('buildDeltaContext', () => {
  it('maps notification summaries in order', () => {
    const ctx = buildDeltaContext([
      { timestamp: 1, summary: 'first' },
      { timestamp: 2, summary: 'second' },
    ])
    expect(ctx).toEqual(['first', 'second'])
  })
})
