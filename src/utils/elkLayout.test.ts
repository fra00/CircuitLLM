import { describe, expect, it } from 'vitest'
import { makeTestCircuit } from '../test/fixtures'
import { runElkLayout } from './elkLayout'

describe('runElkLayout', () => {
  // ELK is loaded lazily; first call can exceed the default 5s on cold starts.
  it(
    'returns a position for every component',
    async () => {
      const circuit = makeTestCircuit()
      const layout = await runElkLayout(circuit)

      for (const component of circuit.components) {
        expect(layout.positions[component.id]).toEqual(
          expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
          }),
        )
      }
      expect(layout.size.width).toBeGreaterThan(0)
      expect(layout.size.height).toBeGreaterThan(0)
    },
    15_000,
  )

  it(
    'handles circuits with no nets',
    async () => {
      const circuit = makeTestCircuit({ nets: [] })
      const layout = await runElkLayout(circuit)
      expect(Object.keys(layout.positions)).toHaveLength(circuit.components.length)
    },
    15_000,
  )
})
