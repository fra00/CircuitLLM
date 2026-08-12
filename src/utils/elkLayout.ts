import type { ELK, ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api'
import type { Circuit } from '../types/circuit'
import { estimateNodeSize } from './pinGeometry'

export interface LayoutResult {
  /** Positions keyed by component id */
  positions: Record<string, { x: number; y: number }>
  /** Bounding box of the whole layout, useful for centering the view */
  size: { width: number; height: number }
}

/**
 * Builds the ELK graph WITHOUT ports.
 *
 * We only need node positions out of ELK: React Flow renders the actual
 * wires between pins itself. Port-constrained graphs trigger a crash in
 * elkjs's layered engine for common schematic topologies (e.g. two pins
 * of the same net both on the left side), so the graph stays plain
 * node-to-node and ELK is used purely as a placement engine.
 */
function buildElkGraph(circuit: Circuit): ElkNode {
  const children: ElkNode[] = circuit.components.map((component) => {
    const { width, height } = estimateNodeSize(component)
    return { id: component.id, width, height }
  })

  const edges: ElkExtendedEdge[] = circuit.nets.flatMap((net) =>
    net.connections.slice(0, -1).map((conn, i) => ({
      id: `elk__${net.name}__${i}`,
      sources: [conn.component_id],
      targets: [net.connections[i + 1].component_id],
    })),
  )

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '50',
      'elk.spacing.edgeNode': '30',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children,
    edges,
  }
}

/**
 * ELK is loaded lazily (dynamic import) so the heavy layout engine
 * doesn't bloat the initial bundle: it is only fetched on first
 * layout request, then cached.
 */
let elkPromise: Promise<ELK> | null = null

async function getElk(): Promise<ELK> {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then((mod) => {
    const Ctor = mod.default as new (args?: unknown) => ELK
    return new Ctor()
  })
  return elkPromise
}

/**
 * Runs the ELK layered layout on the circuit topology.
 * The LLM never provides coordinates: this is the only module
 * allowed to decide X/Y positions of the components.
 *
 * ELK only decides node placement here — never how wires are drawn.
 */
export async function runElkLayout(circuit: Circuit): Promise<LayoutResult> {
  const elk = await getElk()
  const graph = buildElkGraph(circuit)
  const layout = await elk.layout(graph)

  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of layout.children ?? []) {
    positions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 }
  }

  return {
    positions,
    size: { width: layout.width ?? 0, height: layout.height ?? 0 },
  }
}