import type { Edge, Node } from '@xyflow/react'
import type { Circuit } from '../types/circuit'
import type { CanvasEdge, CanvasNode } from '../types/canvas'

/**
 * Maps the canonical Circuit graph to React Flow nodes and edges.
 *
 * IMPORTANT: this function only wires topology — it never assigns
 * real positions. ELK.js (see elkLayout.ts) computes X/Y afterwards;
 * nodes initially start at the origin and are moved by the layout pass.
 */

/** Net names per pin, keyed by pin id within each component */
function buildPinNetsForComponent(
  circuit: Circuit,
  componentId: string,
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const net of circuit.nets) {
    for (const conn of net.connections) {
      if (conn.component_id !== componentId) continue
      map[conn.pin_id] ??= []
      map[conn.pin_id].push(net.name)
    }
  }
  return map
}

export function buildComponentNodes(
  circuit: Circuit,
  positions: Record<string, { x: number; y: number }>,
): CanvasNode[] {
  return circuit.components.map((component) => ({
    id: component.id,
    type: 'schematic',
    position: positions[component.id] ?? { x: 0, y: 0 },
    data: {
      component,
      pinNets: buildPinNetsForComponent(circuit, component.id),
    },
  }))
}

export function buildNetEdges(circuit: Circuit): CanvasEdge[] {
  const edges: CanvasEdge[] = []
  for (const net of circuit.nets) {
    const conns = net.connections
    for (let i = 1; i < conns.length; i++) {
      const source = conns[i - 1]
      const target = conns[i]
      edges.push({
        id: `${net.name}__${source.component_id}.${source.pin_id}__${target.component_id}.${target.pin_id}`,
        source: source.component_id,
        sourceHandle: `pin:${source.pin_id}`,
        target: target.component_id,
        targetHandle: `pin:${target.pin_id}`,
        type: 'schematic',
        data: { netName: net.name },
      })
    }
  }
  return edges
}

export function buildInitialGraph(circuit: Circuit): {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
} {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const component of circuit.components) {
    positions[component.id] = { x: 0, y: 0 }
  }
  return {
    nodes: buildComponentNodes(circuit, positions),
    edges: buildNetEdges(circuit),
  }
}

export type { Node, Edge }
