import type { Circuit } from '../types/circuit'

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
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

export function buildKiCadNetlistXml(circuit: Circuit): string {
  const now = new Date().toISOString()

  const pinByComponent = new Map(
    circuit.components.map((component) => [
      component.id,
      new Map(component.pins.map((pin) => [pin.id, pin])),
    ]),
  )

  const componentsXml = circuit.components
    .map((component) => {
      const value = component.value?.trim() || component.label
      const symbol = component.kicad_symbol?.trim() || 'Device:Unknown'
      const [lib, part] = symbol.includes(':') ? symbol.split(':', 2) : ['Device', symbol]
      return [
        `    <comp ref="${xmlEscape(component.id)}">`,
        `      <value>${xmlEscape(value)}</value>`,
        `      <fields>`,
        `        <field name="Label">${xmlEscape(component.label)}</field>`,
        `        <field name="Type">${xmlEscape(component.type)}</field>`,
        `      </fields>`,
        `      <libsource lib="${xmlEscape(lib)}" part="${xmlEscape(part)}"/>`,
        `    </comp>`,
      ].join('\n')
    })
    .join('\n')

  const netsXml = circuit.nets
    .map((net, netIndex) => {
      const nodesXml = net.connections
        .map((connection) => {
          const pin = pinByComponent.get(connection.component_id)?.get(connection.pin_id)
          const pinValue = pin?.number !== undefined ? String(pin.number) : connection.pin_id
          return `      <node ref="${xmlEscape(connection.component_id)}" pin="${xmlEscape(pinValue)}"/>`
        })
        .join('\n')
      return [
        `    <net code="${netIndex + 1}" name="${xmlEscape(net.name)}">`,
        nodesXml,
        '    </net>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<export version="E">',
    '  <design>',
    `    <source>${xmlEscape(circuit.circuit_name)}</source>`,
    `    <date>${xmlEscape(now)}</date>`,
    '    <tool>CircuitLLM</tool>',
    '  </design>',
    '  <components>',
    componentsXml,
    '  </components>',
    '  <nets>',
    netsXml,
    '  </nets>',
    '</export>',
    '',
  ].join('\n')
}

export function downloadKiCadNetlist(circuit: Circuit): void {
  const content = buildKiCadNetlistXml(circuit)
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${toSafeFileName(circuit.circuit_name)}.net`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
