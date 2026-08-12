import type { Edge, Node } from '@xyflow/react'
import type { Component, PinType } from './circuit'

/** Port handle data attached to a node's pin */
export interface PinHandleData {
  componentId: string
  pinId: string
  pinType: PinType
}

/**
 * React Flow node wrapping an electrical component.
 * `position` is managed exclusively by the auto-layout engine.
 */
export type CanvasNode = Node<
  {
    component: Component
    /** Nets that the pins of this component belong to, keyed by pin id */
    pinNets: Record<string, string[]>
  },
  'schematic'
>

/**
 * React Flow edge representing a wire between two pins.
 * Multiple edges sharing a net may be merged visually via net labels.
 */
export type CanvasEdge = Edge<{
  netName: string
  /** true when this edge is a label continuation (net label on the wire) */
  isLabel?: boolean
}>

export interface EdgeConnectionRef {
  componentId: string
  pinId: string
}

/**
 * Synthetic delta sent to the LLM context whenever the user mutates the
 * canvas (reconnect, value change, add/remove component...).
 */
export interface DeltaNotification {
  timestamp: number
  summary: string
}

export interface Junction {
  id: string
  position: { x: number; y: number }
  netName: string
}
