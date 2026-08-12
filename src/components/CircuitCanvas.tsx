import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type NodeTypes,
  type EdgeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnReconnect,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SchematicNode } from './nodes/SchematicNode'
import { SchematicEdge } from './edges/SchematicEdge'
import { buildInitialGraph } from '../utils/circuitToGraph'
import { runElkLayout } from '../utils/elkLayout'
import { useCircuitStore } from '../store/circuitStore'
import {
  PALETTE_LABELS,
  PALETTE_ORDER,
  createComponent,
} from '../data/componentPalette'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ComponentType, NetConnection } from '../types/circuit'
import './Canvas.css'

const nodeTypes: NodeTypes = { schematic: SchematicNode }
const edgeTypes: EdgeTypes = { schematic: SchematicEdge }

function connectionFromHandles(
  componentId: string,
  handle: string | null | undefined,
): NetConnection {
  return { component_id: componentId, pin_id: handle?.replace(/^pin:/, '') ?? '' }
}

export function CircuitCanvas() {
  const circuit = useCircuitStore((state) => state.circuit)
  const addComponent = useCircuitStore((state) => state.addComponent)
  const connectPins = useCircuitStore((state) => state.connectPins)
  const disconnectEdge = useCircuitStore((state) => state.disconnectEdge)
  const reconnectConnection = useCircuitStore((state) => state.reconnectConnection)

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([])
  const [layoutError, setLayoutError] = useState<string | null>(null)
  const [componentType, setComponentType] = useState<ComponentType>('RESISTOR')

  /**
   * Ids already seen on the canvas. ELK is manual: it only runs on mount and
   * when brand-new components appear (e.g. an LLM generation), never on wire
   * edits, reconnections or value changes.
   */
  const knownNodeIdsRef = useRef<Set<string>>(new Set())

  const relayout = useCallback(async () => {
    try {
      setLayoutError(null)
      const { positions } = await runElkLayout(circuit)
      setNodes((ns) =>
        ns.map((node) => ({
          ...node,
          position: positions[node.id] ?? node.position,
        })),
      )
    } catch (error) {
      /*
       * Safety net: elkjs's layered engine can crash on exotic graph
       * topologies. Fall back to a plain grid so the canvas is never
       * left without a usable layout.
       */
      const message = error instanceof Error ? error.message : String(error)
      console.error('[ELK layout failed, falling back to grid]', message)
      setLayoutError(`ELK failed (${message}) — using grid layout`)
      setNodes((ns) =>
        ns.map((node, index) => ({
          ...node,
          position: { x: (index % 3) * 320, y: Math.floor(index / 3) * 220 },
        })),
      )
    }
  }, [circuit, setNodes])

  useEffect(() => {
    const graph = buildInitialGraph(circuit)
    const graphIds = new Set(graph.nodes.map((n) => n.id))
    const hasNewNodes = [...graphIds].some((id) => !knownNodeIdsRef.current.has(id))
    knownNodeIdsRef.current = graphIds

    setNodes((ns) => {
      const positionById = new Map(ns.map((n) => [n.id, n.position]))
      return graph.nodes.map((n) => ({
        ...n,
        position: positionById.get(n.id) ?? n.position ?? { x: 0, y: 0 },
      }))
    })
    setEdges(graph.edges)
    if (hasNewNodes) void relayout()
  }, [circuit, setNodes, setEdges, relayout])

  const onConnect: OnConnect = (connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return
    connectPins(
      connectionFromHandles(connection.source, connection.sourceHandle),
      connectionFromHandles(connection.target, connection.targetHandle),
    )
  }

  const handleEdgesChange: OnEdgesChange<CanvasEdge> = (changes) => {
    for (const change of changes) {
      if (change.type !== 'remove') continue
      const edge = edges.find((e) => e.id === change.id)
      if (!edge?.data?.netName) continue
      disconnectEdge(
        edge.data.netName,
        connectionFromHandles(edge.source, edge.sourceHandle),
        connectionFromHandles(edge.target, edge.targetHandle),
      )
    }
    onEdgesChange(changes)
  }

  const onReconnect: OnReconnect<CanvasEdge> = (oldEdge, newConnection) => {
    if (!oldEdge.data?.netName) return
    const oldSource = `${oldEdge.source}.${oldEdge.sourceHandle ?? ''}`
    const oldTarget = `${oldEdge.target}.${oldEdge.targetHandle ?? ''}`
    const newSource = `${newConnection.source}.${newConnection.sourceHandle ?? ''}`
    const newTarget = `${newConnection.target}.${newConnection.targetHandle ?? ''}`
    if (newSource !== oldSource) {
      const previous = connectionFromHandles(oldEdge.source, oldEdge.sourceHandle)
      const updated = connectionFromHandles(newConnection.source, newConnection.sourceHandle)
      if (updated.pin_id) reconnectConnection(oldEdge.data.netName, previous, updated)
    } else if (newTarget !== oldTarget) {
      const previous = connectionFromHandles(oldEdge.target, oldEdge.targetHandle)
      const updated = connectionFromHandles(newConnection.target, newConnection.targetHandle)
      if (updated.pin_id) reconnectConnection(oldEdge.data.netName, previous, updated)
    }
  }

  return (
    <div className="canvas-shell">
      <ReactFlow<CanvasNode, CanvasEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left">
          <div className="canvas-panel__controls">
            <button
              type="button"
              className="canvas-panel__button"
              onClick={() => void relayout()}
            >
              Re-layout (ELK)
            </button>
            <div className="canvas-panel__add">
              <select
                className="canvas-panel__select"
                value={componentType}
                onChange={(event) => setComponentType(event.target.value as ComponentType)}
              >
                {PALETTE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {PALETTE_LABELS[type]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="canvas-panel__button"
                onClick={() => addComponent(createComponent(componentType, circuit.components))}
              >
                Aggiungi componente
              </button>
            </div>
          </div>
          {layoutError && (
            <div className="canvas-panel__error">{layoutError}</div>
          )}
        </Panel>
        <Background gap={24} size={1} color="#c9d4e0" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}