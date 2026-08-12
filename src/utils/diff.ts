import type { Circuit } from '../types/circuit'
import type { DeltaNotification } from '../types/canvas'

function connectionKey(componentId: string, pinId: string): string {
  return `${componentId}.${pinId}`
}

/**
 * Compares two circuit states and produces the synthetic notification
 * consumed by the LLM context. Returns null when nothing changed.
 */
export function diffCircuits(previous: Circuit, next: Circuit): string | null {
  const changes: string[] = []

  const prevComps = new Map(previous.components.map((c) => [c.id, c]))
  const nextComps = new Map(next.components.map((c) => [c.id, c]))

  for (const component of nextComps.values()) {
    const prev = prevComps.get(component.id)
    if (!prev) {
      changes.push(
        `added component '${component.id}' ('${component.label}')`,
      )
      continue
    }
    if (prev.value !== component.value) {
      changes.push(
        `updated component '${component.id}' value from '${prev.value ?? 'none'}' to '${component.value ?? 'none'}'`,
      )
    }
    if (prev.label !== component.label) {
      changes.push(
        `renamed component '${component.id}' from '${prev.label}' to '${component.label}'`,
      )
    }
    const prevPinIds = new Set(prev.pins.map((p) => p.id))
    const nextPinIds = new Set(component.pins.map((p) => p.id))
    for (const pinId of nextPinIds) {
      if (!prevPinIds.has(pinId)) {
        changes.push(`added pin '${component.id}.${pinId}' to component`)
      }
    }
    for (const pinId of prevPinIds) {
      if (!nextPinIds.has(pinId)) {
        changes.push(`removed pin '${component.id}.${pinId}' from component`)
      }
    }
  }
  for (const component of prevComps.values()) {
    if (!nextComps.has(component.id)) {
      changes.push(`removed component '${component.id}' ('${component.label}')`)
    }
  }

  const prevNets = new Map(previous.nets.map((n) => [n.name, n]))
  const nextNets = new Map(next.nets.map((n) => [n.name, n]))

  for (const net of nextNets.values()) {
    const prev = prevNets.get(net.name)
    if (!prev) {
      changes.push(
        `added net '${net.name}' connecting ${net.connections
          .map((c) => connectionKey(c.component_id, c.pin_id))
          .join(', ')}`,
      )
      continue
    }
    const prevKeys = new Set(prev.connections.map((c) => connectionKey(c.component_id, c.pin_id)))
    const nextKeys = new Set(net.connections.map((c) => connectionKey(c.component_id, c.pin_id)))
    for (const key of nextKeys) {
      if (!prevKeys.has(key)) {
        changes.push(`connected '${key}' to net '${net.name}'`)
      }
    }
    for (const key of prevKeys) {
      if (!nextKeys.has(key)) {
        changes.push(`disconnected '${key}' from net '${net.name}'`)
      }
    }
  }
  for (const net of prevNets.values()) {
    if (!nextNets.has(net.name)) {
      changes.push(`removed net '${net.name}'`)
    }
  }

  if (changes.length === 0) return null
  return `[SYSTEM NOTIFICATION]: User modified the canvas: ${changes.join('; ')}.`
}

/**
 * Builds the context block injected into the next LLM generation: the
 * [SYSTEM NOTIFICATION] summaries recorded since the last generation.
 * This closes the bidirectional loop Canvas -> LLM context.
 */
export function buildDeltaContext(notifications: DeltaNotification[]): string[] {
  return notifications.map((n) => n.summary)
}