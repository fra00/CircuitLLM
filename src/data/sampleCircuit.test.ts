import { describe, expect, it } from 'vitest'
import { SAMPLE_CIRCUIT } from './sampleCircuit'

describe('SAMPLE_CIRCUIT', () => {
  it('has a stable name and non-empty topology', () => {
    expect(SAMPLE_CIRCUIT.circuit_name).toBe('Robot Controller')
    expect(SAMPLE_CIRCUIT.components.length).toBeGreaterThan(0)
    expect(SAMPLE_CIRCUIT.nets.length).toBeGreaterThan(0)
  })

  it('references only existing component/pin ids in nets', () => {
    const pinIds = new Map(
      SAMPLE_CIRCUIT.components.map((c) => [c.id, new Set(c.pins.map((p) => p.id))]),
    )

    for (const net of SAMPLE_CIRCUIT.nets) {
      expect(net.connections.length).toBeGreaterThanOrEqual(2)
      for (const conn of net.connections) {
        expect(pinIds.has(conn.component_id)).toBe(true)
        expect(pinIds.get(conn.component_id)?.has(conn.pin_id)).toBe(true)
      }
    }
  })

  it('does not embed spatial coordinates', () => {
    const raw = JSON.stringify(SAMPLE_CIRCUIT)
    expect(raw).not.toMatch(/"x"\s*:/)
    expect(raw).not.toMatch(/"y"\s*:/)
    expect(raw).not.toMatch(/"position"\s*:/)
  })
})
