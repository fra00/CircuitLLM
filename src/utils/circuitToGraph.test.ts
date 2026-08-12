import { describe, expect, it } from 'vitest'
import { buildInitialGraph, buildNetEdges } from './circuitToGraph'
import { makeTestCircuit } from '../test/fixtures'

describe('circuitToGraph', () => {
  it('creates one node per component at origin', () => {
    const circuit = makeTestCircuit()
    const { nodes } = buildInitialGraph(circuit)
    expect(nodes).toHaveLength(circuit.components.length)
    for (const node of nodes) {
      expect(node.position).toEqual({ x: 0, y: 0 })
      expect(node.type).toBe('schematic')
    }
  })

  it('maps pin nets onto node data', () => {
    const circuit = makeTestCircuit()
    const { nodes } = buildInitialGraph(circuit)
    const u1 = nodes.find((n) => n.id === 'U1')
    expect(u1?.data.pinNets.D0).toContain('SIGNAL')
  })

  it('creates chain edges for multi-pin nets', () => {
    const circuit = makeTestCircuit({
      nets: [
        {
          name: 'BUS',
          connections: [
            { component_id: 'U1', pin_id: 'D0' },
            { component_id: 'R1', pin_id: 'A' },
            { component_id: 'R1', pin_id: 'B' },
          ],
        },
      ],
    })
    const edges = buildNetEdges(circuit)
    expect(edges).toHaveLength(2)
    expect(edges.every((e) => e.data?.netName === 'BUS')).toBe(true)
    expect(edges[0].sourceHandle).toBe('pin:D0')
  })
})
