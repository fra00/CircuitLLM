import type { Circuit, Component, Net, Pin } from '../types/circuit'
import type { ProjectMemory } from '../types/projectMemory'

export interface LlmExportOptions {
  /** Project goal / original user intent, if known */
  goal?: string
  /** Compact project memory summary, if available */
  memorySummary?: string
}

function toSafeFileName(name: string): string {
  const base = name.trim() || 'circuit'
  const forbidden = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const sanitized = [...base]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (forbidden.has(ch) || code <= 31) return '_'
      return ch
    })
    .join('')
  return sanitized.replace(/\s+/g, '_')
}

function pinLookup(circuit: Circuit): Map<string, { component: Component; pin: Pin }> {
  const map = new Map<string, { component: Component; pin: Pin }>()
  for (const component of circuit.components) {
    for (const pin of component.pins) {
      map.set(`${component.id}.${pin.id}`, { component, pin })
    }
  }
  return map
}

function formatPinRef(component: Component, pin: Pin): string {
  const label = pin.label && pin.label !== pin.id ? ` "${pin.label}"` : ''
  return `${component.id}.${pin.id}${label} (${pin.type})`
}

function formatComponentLine(component: Component): string {
  const value = component.value ? `, value=${component.value}` : ''
  const symbol = component.kicad_symbol ? `, symbol=${component.kicad_symbol}` : ''
  return `- ${component.id}: ${component.label} [${component.type}]${value}${symbol}`
}

function formatPinMap(component: Component, netsByPin: Map<string, string[]>): string[] {
  const lines = [`#### ${component.id} (${component.label})`]
  for (const pin of component.pins) {
    const nets = netsByPin.get(`${component.id}.${pin.id}`) ?? []
    const netText = nets.length > 0 ? nets.join(', ') : '(unconnected)'
    lines.push(`- ${pin.id} "${pin.label}" [${pin.type}] → ${netText}`)
  }
  return lines
}

function formatNetSection(net: Net, lookup: Map<string, { component: Component; pin: Pin }>): string[] {
  const endpoints = net.connections.map((conn) => {
    const key = `${conn.component_id}.${conn.pin_id}`
    const hit = lookup.get(key)
    if (!hit) return `- ${key} (MISSING pin in circuit model)`
    return `- ${formatPinRef(hit.component, hit.pin)}`
  })

  const narrative = net.connections
    .map((conn) => {
      const hit = lookup.get(`${conn.component_id}.${conn.pin_id}`)
      if (!hit) return `${conn.component_id}.${conn.pin_id}`
      return `${hit.component.id}.${hit.pin.id}`
    })
    .join(' ↔ ')

  return [
    `### Net \`${net.name}\``,
    `Electrically common: ${narrative}`,
    '',
    'Endpoints:',
    ...endpoints,
    '',
  ]
}

function buildNetsByPin(circuit: Circuit): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const net of circuit.nets) {
    for (const conn of net.connections) {
      const key = `${conn.component_id}.${conn.pin_id}`
      const list = map.get(key) ?? []
      list.push(net.name)
      map.set(key, list)
    }
  }
  return map
}

function findFirmwareTargets(circuit: Circuit): Component[] {
  return circuit.components.filter(
    (c) => c.type === 'MICROCONTROLLER' || /arduino|mcu|esp|pico|stm/i.test(`${c.id} ${c.label}`),
  )
}

/**
 * Builds an LLM-oriented Markdown description of the circuit topology.
 * No coordinates: only components, pin roles, and net connectivity.
 */
export function buildLlmCircuitMarkdown(
  circuit: Circuit,
  options: LlmExportOptions = {},
): string {
  const lookup = pinLookup(circuit)
  const netsByPin = buildNetsByPin(circuit)
  const mcus = findFirmwareTargets(circuit)
  const lines: string[] = [
    `# CircuitLLM export — ${circuit.circuit_name}`,
    '',
    'This document describes an electrical schematic as a **topological graph**',
    '(components, pins, nets). There are no X/Y coordinates.',
    'Use it to understand wiring and to generate firmware / control software.',
    '',
  ]

  if (options.goal?.trim()) {
    lines.push('## Goal / intent', options.goal.trim(), '')
  }
  if (options.memorySummary?.trim()) {
    lines.push('## Project memory (compact)', options.memorySummary.trim(), '')
  }

  lines.push(
    '## How to read this file',
    '- A **net** is an electrically common node: every listed endpoint is connected together.',
    '- Pin types: INPUT / OUTPUT / BIDIRECTIONAL / POWER_IN / POWER_OUT / PASSIVE / NO_CONNECT.',
    '- Unconnected pins are listed in the pin map as `(unconnected)`.',
    '- Prefer MCU OUTPUT/INPUT pins when mapping firmware GPIO.',
    '',
    '## Bill of materials',
  )

  if (circuit.components.length === 0) {
    lines.push('- (no components)')
  } else {
    for (const component of circuit.components) {
      lines.push(formatComponentLine(component))
    }
  }

  lines.push('', '## Firmware targets')
  if (mcus.length === 0) {
    lines.push('- (none detected — no MICROCONTROLLER component)')
  } else {
    for (const mcu of mcus) {
      lines.push(`- ${mcu.id}: ${mcu.label} [${mcu.type}]`)
    }
  }

  lines.push('', '## Pin map (component → nets)')
  if (circuit.components.length === 0) {
    lines.push('(empty)')
  } else {
    for (const component of circuit.components) {
      lines.push(...formatPinMap(component, netsByPin), '')
    }
  }

  lines.push('## Nets (wire connectivity)')
  if (circuit.nets.length === 0) {
    lines.push('(no nets)')
  } else {
    for (const net of circuit.nets) {
      lines.push(...formatNetSection(net, lookup))
    }
  }

  lines.push(
    '## Firmware generation hints',
    '- Identify GPIO nets that touch a firmware target INPUT/OUTPUT/BIDIRECTIONAL pin.',
    '- Treat POWER_* and GND nets as supply rails, not logic signals.',
    '- For motors/encoders/switches, map each signal net to a named constant in code',
    '  (e.g. `MOTOR_LEFT_PWM = D5`).',
    '- Respect pull-ups / polarity implied by resistors and switch wiring when present.',
    '- Do not invent pins that are not listed in the pin map.',
    '',
    '## Machine-readable JSON (same topology)',
    '```json',
    JSON.stringify(
      {
        circuit_name: circuit.circuit_name,
        components: circuit.components,
        nets: circuit.nets,
      },
      null,
      2,
    ),
    '```',
    '',
  )

  return lines.join('\n')
}

export function buildLlmExportFromMemory(
  circuit: Circuit,
  memory?: ProjectMemory | null,
  goalFallback?: string,
): string {
  return buildLlmCircuitMarkdown(circuit, {
    goal: memory?.goal || goalFallback,
    memorySummary: memory?.summary,
  })
}

/** Downloads the LLM-first Markdown description of the circuit. */
export function downloadLlmCircuitMarkdown(
  circuit: Circuit,
  options: LlmExportOptions = {},
): void {
  const content = buildLlmCircuitMarkdown(circuit, options)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${toSafeFileName(circuit.circuit_name)}.llm.md`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
