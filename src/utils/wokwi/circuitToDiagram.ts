import type { Circuit, NetConnection } from '../../types/circuit'
import {
  analyzeWokwiComponent,
  resolveChoice,
  type WokwiPartChoice,
} from './nativeAlternatives'
import { resolveComponent, wireColor } from './partMap'
import type {
  DiagramBuildResult,
  PendingChip,
  PositionMap,
  ResolvedPart,
  WokwiConnection,
  WokwiDiagram,
  WokwiPart,
} from './types'

function gridPosition(index: number): { x: number; y: number } {
  return { x: (index % 4) * 200, y: Math.floor(index / 4) * 160 }
}

interface NetEndpoint {
  componentId: string
  pinId: string
  endpoint: string
  pinHint: string
}

function isGndHint(text: string): boolean {
  return /(?:^|[^a-z])gnd(?:[^a-z]|$)|ground|0v|neg|cathode|\bk\b/i.test(text)
}

function isVccHint(text: string): boolean {
  return /(?:^|[^a-z])(?:vcc|vdd|vin|5v|3v3|3\.3|12v|pwr|v\+|pos)(?:[^a-z]|$)/i.test(
    text,
  )
}

/**
 * Drop polarity conflicts (e.g. battery VCC sitting on a GND net) before wiring.
 */
export function filterPolarityConflicts(
  netName: string,
  endpoints: NetEndpoint[],
): NetEndpoint[] {
  if (endpoints.length < 2) return endpoints
  const name = netName.toLowerCase()
  const gndScore =
    (isGndHint(name) ? 3 : 0) +
    endpoints.filter((e) => isGndHint(`${e.pinHint} ${e.pinId}`)).length
  const vccScore =
    (isVccHint(name) ? 3 : 0) +
    endpoints.filter((e) => isVccHint(`${e.pinHint} ${e.pinId}`)).length

  if (gndScore >= 2 && gndScore > vccScore) {
    return endpoints.filter((e) => !isVccHint(`${e.pinHint} ${e.pinId}`))
  }
  if (vccScore >= 2 && vccScore > gndScore) {
    return endpoints.filter((e) => !isGndHint(`${e.pinHint} ${e.pinId}`))
  }
  return endpoints
}

function groupByComponent(endpoints: NetEndpoint[]): Map<string, NetEndpoint[]> {
  const groups = new Map<string, NetEndpoint[]>()
  for (const ep of endpoints) {
    const list = groups.get(ep.componentId) ?? []
    list.push(ep)
    groups.set(ep.componentId, list)
  }
  return groups
}

/**
 * Expand a net into Wokwi wires.
 *
 * - Two components with multiple pins each → zip pairwise (fixes collapsed buses
 *   like D2/D4/D5/D18 + IN1..IN4, or OUT1/OUT2 + motor P1/P2).
 * - Otherwise star from a hub, never drawing same-component pin shorts.
 */
export function expandNetConnections(
  netName: string,
  endpoints: NetEndpoint[],
): WokwiConnection[] {
  const filtered = filterPolarityConflicts(netName, endpoints)
  if (filtered.length < 2) return []

  const color = wireColor(
    netName,
    filtered.map((e) => e.pinHint),
  )
  const groups = [...groupByComponent(filtered).entries()]
  const connections: WokwiConnection[] = []
  const seen = new Set<string>()

  const push = (a: NetEndpoint, b: NetEndpoint) => {
    if (a.componentId === b.componentId) return
    if (a.endpoint === b.endpoint) return
    const key = [a.endpoint, b.endpoint].sort().join('|')
    if (seen.has(key)) return
    seen.add(key)
    connections.push([a.endpoint, b.endpoint, color, []])
  }

  if (groups.length === 2) {
    const [, pinsA] = groups[0]
    const [, pinsB] = groups[1]
    if (pinsA.length >= 2 && pinsB.length >= 2) {
      const n = Math.min(pinsA.length, pinsB.length)
      for (let i = 0; i < n; i++) push(pinsA[i], pinsB[i])
      return connections
    }
  }

  // Hub: prefer a GND/VCC pin matching the net, else first endpoint
  let hub = filtered[0]
  if (isGndHint(netName)) {
    hub = filtered.find((e) => isGndHint(`${e.pinHint} ${e.pinId}`)) ?? hub
  } else if (isVccHint(netName)) {
    hub = filtered.find((e) => isVccHint(`${e.pinHint} ${e.pinId}`)) ?? hub
  }

  for (const ep of filtered) {
    push(hub, ep)
  }
  return connections
}

/**
 * A wokwi-pushbutton closes the circuit between contact 1 and contact 2 when pressed.
 * 1.l/1.r are the same contact; GND must go to 2.l (or 2.r), not the other 1.x pin.
 * If only one contact is wired, attach the free contact to a GND hub.
 */
export function ensurePushbuttonGroundReturns(
  parts: WokwiPart[],
  connections: WokwiConnection[],
): WokwiConnection[] {
  const result: WokwiConnection[] = [...connections]

  const endpointUsed = (endpoint: string): boolean =>
    result.some(([a, b]) => a === endpoint || b === endpoint)

  const contactUsed = (id: string, contact: 1 | 2): boolean =>
    endpointUsed(`${id}:${contact}.l`) || endpointUsed(`${id}:${contact}.r`)

  const pairKey = (a: string, b: string) => [a, b].sort().join('|')
  const hasPair = (a: string, b: string) =>
    result.some(([x, y]) => pairKey(x, y) === pairKey(a, b))

  const gndHub =
    result
      .flatMap(([a, b]) => [a, b])
      .find((e) => /:GND(\.\d+)?$/i.test(e)) ??
    (() => {
      const gndPart = parts.find((p) => p.type === 'wokwi-gnd')
      if (gndPart) return `${gndPart.id}:GND`
      const mcu = parts.find(
        (p) =>
          p.type.startsWith('wokwi-arduino') ||
          p.type.startsWith('board-') ||
          p.type === 'wokwi-pi-pico',
      )
      if (!mcu) return null
      // ESP32 boards expose GND.1 / GND.2, not plain GND
      if (mcu.type.includes('esp32')) return `${mcu.id}:GND.1`
      return `${mcu.id}:GND`
    })()

  if (!gndHub) return result

  for (const part of parts) {
    if (part.type !== 'wokwi-pushbutton') continue
    const has1 = contactUsed(part.id, 1)
    const has2 = contactUsed(part.id, 2)
    if (has1 === has2) continue // both or neither
    const free = has1 ? `${part.id}:2.l` : `${part.id}:1.l`
    if (hasPair(gndHub, free)) continue
    result.push([gndHub, free, 'black', []])
  }

  return result
}

/**
 * Builds a Wokwi diagram.json structure from a CircuitLLM circuit.
 * Positions come from the live canvas; missing ones fall back to a grid.
 * Custom chips are listed in `pendingChips` (deduped by slug) for later LLM/stub generation.
 * `choices` maps preferenceKey → native|custom for components that offer both.
 */
export function circuitToDiagram(
  circuit: Circuit,
  positions: PositionMap = {},
  choices: Record<string, WokwiPartChoice> = {},
): DiagramBuildResult {
  const resolvedById = new Map<string, ResolvedPart>()
  const pendingBySlug = new Map<string, PendingChip>()
  let hasNativeMcu = false

  circuit.components.forEach((component, index) => {
    const pos = positions[component.id] ?? gridPosition(index)
    const analysis = analyzeWokwiComponent(component)
    const choice = resolveChoice(analysis, choices)
    const { resolved, pending } = resolveComponent(component, pos, choice)
    resolvedById.set(component.id, resolved)

    if (
      resolved.part.type.startsWith('wokwi-arduino') ||
      resolved.part.type.startsWith('board-') ||
      resolved.part.type === 'wokwi-pi-pico' ||
      resolved.part.type === 'wokwi-attiny85'
    ) {
      hasNativeMcu = true
    }

    if (pending && !pendingBySlug.has(pending.slug)) {
      pendingBySlug.set(pending.slug, pending)
    }
  })

  let connections: WokwiConnection[] = []

  for (const net of circuit.nets) {
    if (net.connections.length < 2) continue

    const endpoints = net.connections
      .map((conn: NetConnection) => {
        const resolved = resolvedById.get(conn.component_id)
        if (!resolved) return null
        const wokwiPin = resolved.pinMap[conn.pin_id] ?? conn.pin_id
        return {
          componentId: conn.component_id,
          pinId: conn.pin_id,
          endpoint: `${conn.component_id}:${wokwiPin}`,
          pinHint: wokwiPin,
        } satisfies NetEndpoint
      })
      .filter((e): e is NetEndpoint => e !== null)

    connections.push(...expandNetConnections(net.name, endpoints))
  }

  const parts = [...resolvedById.values()].map((r) => r.part)
  connections = ensurePushbuttonGroundReturns(parts, connections)

  const diagram: WokwiDiagram = {
    version: 1,
    author: 'CircuitLLM',
    editor: 'circuitllm',
    parts,
    connections,
  }

  return {
    diagram,
    pendingChips: [...pendingBySlug.values()],
    hasNativeMcu,
  }
}
