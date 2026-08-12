import { create } from 'zustand'
import type { Circuit, Component, NetConnection, PinType } from '../types/circuit'
import type { DeltaNotification } from '../types/canvas'
import { SAMPLE_CIRCUIT } from '../data/sampleCircuit'
import { diffCircuits } from '../utils/diff'

interface CircuitState {
  circuit: Circuit
  notifications: DeltaNotification[]

  loadCircuit: (circuit: Circuit) => void
  updateComponentValue: (componentId: string, value: string) => void
  /**
   * Updates component id (reference code) and/or label.
   * If id changes, all net connections are remapped accordingly.
   */
  updateComponentIdentity: (
    componentId: string,
    nextId: string,
    nextLabel: string,
  ) => void
  /** Adds a component to the circuit (id collisions are ignored) */
  addComponent: (component: Component) => void
  /** Removes a component and any dangling nets left with < 2 pins */
  removeComponent: (componentId: string) => void
  /** Appends a new pin to a component; name sanitized and made unique */
  addPin: (componentId: string, label: string, pinType?: PinType) => void
  /**
   * Removes a pin from a component and strips all its net connections;
   * nets left with fewer than 2 pins are dropped.
   */
  removePin: (componentId: string, pinId: string) => void
  /** Registers a net created by drawing a wire on the canvas */
  addConnectionNet: (
    netName: string,
    connectionA: NetConnection,
    connectionB: NetConnection,
  ) => void
  /** Removes one pin from a net; drops the net when fewer than 2 pins remain */
  removeConnection: (netName: string, connection: NetConnection) => void
  /**
   * Connects two pins, committing the wire into the Circuit model.
   * Smart-joins existing nets: same net -> no-op, one pin already on a net
   * -> pin appended, two different nets -> merged, neither -> new net.
   */
  connectPins: (connectionA: NetConnection, connectionB: NetConnection) => void
  /**
   * Removes both ends of a wire from its net atomically, producing a
   * single delta notification; drops the net when fewer than 2 pins remain.
   */
  disconnectEdge: (
    netName: string,
    connectionA: NetConnection,
    connectionB: NetConnection,
  ) => void
  /** Moves one pin of a net to another pin (edge reconnection) */
  reconnectConnection: (
    netName: string,
    oldConnection: NetConnection,
    newConnection: NetConnection,
  ) => void
  recordNotification: (summary: string) => void
  clearNotifications: () => void
}

const MAX_NOTIFICATIONS = 40

const pinKey = (conn: NetConnection): string => `${conn.component_id}.${conn.pin_id}`

function withConnectionReplaced(
  connections: NetConnection[],
  oldConnection: NetConnection,
  newConnection: NetConnection,
): NetConnection[] {
  const oldKey = pinKey(oldConnection)
  let replaced = false
  const next = connections.map((conn) => {
    if (!replaced && pinKey(conn) === oldKey) {
      replaced = true
      return newConnection
    }
    return conn
  })
  return next
}

export const useCircuitStore = create<CircuitState>((set, get) => ({
  circuit: SAMPLE_CIRCUIT,
  notifications: [],

  loadCircuit: (circuit) =>
    set({ circuit, notifications: [] }),

  updateComponentValue: (componentId, value) => {
    const circuit = get().circuit
    const component = circuit.components.find((c) => c.id === componentId)
    if (!component) return

    let summary: string | null = null
    const next = {
      ...circuit,
      components: circuit.components.map((c) => {
        if (c.id !== componentId) return c
        if (c.value !== value) {
          summary = `[SYSTEM NOTIFICATION]: User updated component '${componentId}' value from '${c.value ?? 'none'}' to '${value}'.`
        }
        return { ...c, value }
      }),
    }
    set({ circuit: next })
    if (summary) get().recordNotification(summary)
  },

  updateComponentIdentity: (componentId, nextId, nextLabel) => {
    const circuit = get().circuit
    const component = circuit.components.find((c) => c.id === componentId)
    if (!component) return

    const targetId = nextId.trim() || component.id
    const targetLabel = nextLabel.trim() || component.label

    if (
      targetId !== componentId &&
      circuit.components.some((c) => c.id === targetId)
    ) {
      return
    }

    const next = {
      ...circuit,
      components: circuit.components.map((c) =>
        c.id === componentId ? { ...c, id: targetId, label: targetLabel } : c,
      ),
      nets:
        targetId === componentId
          ? circuit.nets
          : circuit.nets.map((net) => ({
              ...net,
              connections: net.connections.map((conn) =>
                conn.component_id === componentId
                  ? { ...conn, component_id: targetId }
                  : conn,
              ),
            })),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  addComponent: (component) => {
    const circuit = get().circuit
    if (circuit.components.some((c) => c.id === component.id)) return
    const next = { ...circuit, components: [...circuit.components, component] }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  removeComponent: (componentId) => {
    const circuit = get().circuit
    if (!circuit.components.some((c) => c.id === componentId)) return
    const next = {
      ...circuit,
      components: circuit.components.filter((c) => c.id !== componentId),
      nets: circuit.nets
        .map((net) => ({
          ...net,
          connections: net.connections.filter((conn) => conn.component_id !== componentId),
        }))
        .filter((net) => net.connections.length >= 2),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  addPin: (componentId, label, pinType = 'PASSIVE') => {
    const circuit = get().circuit
    const component = circuit.components.find((c) => c.id === componentId)
    if (!component) return
    const userLabel = label.trim()
    const base = userLabel.replace(/\s+/g, '_') || `P${component.pins.length + 1}`
    const existing = new Set(component.pins.map((p) => p.id))
    let pinId = base
    let suffix = 2
    while (existing.has(pinId)) {
      pinId = `${base}_${suffix++}`
    }
    const next = {
      ...circuit,
      components: circuit.components.map((c) =>
        c.id === componentId
          ? {
              ...c,
              pins: [
                ...c.pins,
                { id: pinId, label: userLabel || pinId, type: pinType },
              ],
            }
          : c,
      ),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  removePin: (componentId, pinId) => {
    const circuit = get().circuit
    const component = circuit.components.find((c) => c.id === componentId)
    if (!component || component.pins.length <= 1) return
    const key = pinKey({ component_id: componentId, pin_id: pinId })
    const next = {
      ...circuit,
      components: circuit.components.map((c) =>
        c.id === componentId
          ? { ...c, pins: c.pins.filter((p) => p.id !== pinId) }
          : c,
      ),
      nets: circuit.nets
        .map((net) => ({
          ...net,
          connections: net.connections.filter((conn) => pinKey(conn) !== key),
        }))
        .filter((net) => net.connections.length >= 2),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  addConnectionNet: (netName, connectionA, connectionB) => {
    const circuit = get().circuit
    if (circuit.nets.some((net) => net.name === netName)) return
    const next = {
      ...circuit,
      nets: [...circuit.nets, { name: netName, connections: [connectionA, connectionB] }],
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  removeConnection: (netName, connection) => {
    const circuit = get().circuit
    const net = circuit.nets.find((n) => n.name === netName)
    if (!net) return
    const key = pinKey(connection)
    const remaining = net.connections.filter(
      (c) => pinKey(c) !== key,
    )
    const next = {
      ...circuit,
      nets: remaining.length >= 2
        ? circuit.nets.map((n) => (n.name === netName ? { ...n, connections: remaining } : n))
        : circuit.nets.filter((n) => n.name !== netName),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  connectPins: (connectionA, connectionB) => {
    const circuit = get().circuit
    const netOfA = circuit.nets.find((net) =>
      net.connections.some((c) => pinKey(c) === pinKey(connectionA)),
    )
    const netOfB = circuit.nets.find((net) =>
      net.connections.some((c) => pinKey(c) === pinKey(connectionB)),
    )

    const addToNet = (name: string) => (conn: NetConnection) =>
      ({ ...circuit, nets: circuit.nets.map((n) => {
        if (n.name !== name) return n
        const connections = n.connections.some((c) => pinKey(c) === pinKey(conn))
          ? n.connections
          : [...n.connections, conn]
        return { ...n, connections }
      }) })

    let next: Circuit
    if (netOfA && netOfB && netOfA.name === netOfB.name) {
      return
    }
    if (netOfA && !netOfB) {
      next = addToNet(netOfA.name)(connectionB)
    } else if (netOfB && !netOfA) {
      next = addToNet(netOfB.name)(connectionA)
    } else if (netOfA && netOfB) {
      const merged = [
        ...netOfB.connections,
        ...netOfA.connections.filter(
          (c) => !netOfB.connections.some((existing) => pinKey(existing) === pinKey(c)),
        ),
      ]
      next = {
        ...circuit,
        nets: circuit.nets
          .filter((n) => n.name !== netOfA.name)
          .map((n) => (n.name === netOfB.name ? { ...n, connections: merged } : n)),
      }
    } else {
      const netName = `NET_${Date.now().toString(36).toUpperCase()}`
      next = {
        ...circuit,
        nets: [...circuit.nets, { name: netName, connections: [connectionA, connectionB] }],
      }
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  disconnectEdge: (netName, connectionA, connectionB) => {
    const circuit = get().circuit
    const net = circuit.nets.find((n) => n.name === netName)
    if (!net) return
    const keys = new Set([pinKey(connectionA), pinKey(connectionB)])
    const remaining = net.connections.filter((c) => !keys.has(pinKey(c)))
    const next = {
      ...circuit,
      nets: remaining.length >= 2
        ? circuit.nets.map((n) => (n.name === netName ? { ...n, connections: remaining } : n))
        : circuit.nets.filter((n) => n.name !== netName),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  reconnectConnection: (netName, oldConnection, newConnection) => {
    const circuit = get().circuit
    const net = circuit.nets.find((n) => n.name === netName)
    if (!net) return
    const next = {
      ...circuit,
      nets: circuit.nets.map((n) =>
        n.name === netName
          ? { ...n, connections: withConnectionReplaced(n.connections, oldConnection, newConnection) }
          : n,
      ),
    }
    set({ circuit: next })
    const summary = diffCircuits(circuit, next)
    if (summary) get().recordNotification(summary)
  },

  recordNotification: (summary) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { timestamp: Date.now(), summary },
      ].slice(-MAX_NOTIFICATIONS),
    })),

  clearNotifications: () => set({ notifications: [] }),
}))