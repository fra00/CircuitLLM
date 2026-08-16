import type { Circuit, Component, Pin, PinType } from '../types/circuit'
import { estimateNodeSize, pinSide } from './pinGeometry'
import { runElkLayout } from './elkLayout'

/** KiCad schematic units are millimetres. */
const GRID = 1.27
const PIN_LENGTH = 2.54
const SCALE = 0.25 // ELK pixels → mm (compact but readable)

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID
}

function sexpString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
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

function kicadPinElectrical(type: PinType): string {
  switch (type) {
    case 'INPUT':
      return 'input'
    case 'OUTPUT':
      return 'output'
    case 'BIDIRECTIONAL':
      return 'bidirectional'
    case 'POWER_IN':
      return 'power_in'
    case 'POWER_OUT':
      return 'power_out'
    case 'NO_CONNECT':
      return 'no_connect'
    case 'PASSIVE':
    default:
      return 'passive'
  }
}

function symbolLibId(component: Component): string {
  return `CircuitLLM:${component.id}`
}

interface PinPlacement {
  pin: Pin
  number: string
  side: 'left' | 'right'
  /** Offset from symbol origin (mm) */
  ox: number
  oy: number
}

function placePins(component: Component): {
  width: number
  height: number
  pins: PinPlacement[]
} {
  const left: Pin[] = []
  const right: Pin[] = []
  component.pins.forEach((pin, index) => {
    if (pinSide(pin.type, index) === 'right') right.push(pin)
    else left.push(pin)
  })

  const rows = Math.max(left.length, right.length, 1)
  const height = snap(Math.max(10.16, rows * 2.54 + 5.08))
  const width = snap(Math.max(15.24, 12.7 + Math.min(component.label.length, 16) * 0.7))
  const halfW = width / 2
  const halfH = height / 2

  const placeColumn = (pins: Pin[], side: 'left' | 'right'): PinPlacement[] =>
    pins.map((pin, i) => {
      const span = pins.length === 1 ? 0 : halfH - 2.54
      const oy =
        pins.length === 1 ? 0 : snap(halfH - 2.54 - (i * (2 * span)) / (pins.length - 1))
      return {
        pin,
        number: String(
          side === 'left'
            ? left.indexOf(pin) + 1
            : left.length + right.indexOf(pin) + 1,
        ),
        side,
        ox: side === 'left' ? -halfW : halfW,
        oy,
      }
    })

  return {
    width,
    height,
    pins: [...placeColumn(left, 'left'), ...placeColumn(right, 'right')],
  }
}

function propertyBlock(
  name: string,
  value: string,
  x: number,
  y: number,
  hide = false,
): string {
  const hideFlag = hide ? ' yes' : ' no'
  return [
    `    (property ${sexpString(name)} ${sexpString(value)}`,
    `      (at ${x} ${y} 0)`,
    `      (effects (font (size 1.27 1.27))${hide ? ' (hide yes)' : ''})`,
    `    )`,
  ].join('\n')
  // hideFlag kept for clarity if we expand later
  void hideFlag
}

function buildLibSymbol(component: Component): { lib: string; pins: PinPlacement[] } {
  const { width, height, pins } = placePins(component)
  const halfW = width / 2
  const halfH = height / 2
  const libId = symbolLibId(component)
  const bare = component.id

  const pinLines = pins.map((p) => {
    const rotation = p.side === 'left' ? 0 : 180
    const atX = p.side === 'left' ? p.ox - PIN_LENGTH : p.ox + PIN_LENGTH
    return [
      `      (pin ${kicadPinElectrical(p.pin.type)} line (at ${atX} ${p.oy} ${rotation}) (length ${PIN_LENGTH})`,
      `        (name ${sexpString(p.pin.id)} (effects (font (size 1.016 1.016))))`,
      `        (number ${sexpString(p.number)} (effects (font (size 1.016 1.016))))`,
      `      )`,
    ].join('\n')
  })

  const lib = [
    `  (symbol ${sexpString(libId)}`,
    `    (pin_names (offset 1.016))`,
    `    (exclude_from_sim no)`,
    `    (in_bom yes)`,
    `    (on_board yes)`,
    propertyBlock('Reference', component.id.replace(/\d+$/, '') || 'U', 0, halfH + 1.27),
    propertyBlock('Value', component.label || component.id, 0, -(halfH + 1.27)),
    propertyBlock('Footprint', '', 0, 0, true),
    propertyBlock('Datasheet', '', 0, 0, true),
    propertyBlock('Description', component.type, 0, 0, true),
    `    (symbol ${sexpString(`${bare}_0_1`)}`,
    `      (rectangle (start ${-halfW} ${halfH}) (end ${halfW} ${-halfH})`,
    `        (stroke (width 0.254) (type default))`,
    `        (fill (type background))`,
    `      )`,
    `    )`,
    `    (symbol ${sexpString(`${bare}_1_1`)}`,
    ...pinLines,
    `    )`,
    `  )`,
  ].join('\n')

  return { lib, pins }
}

function manhattanWires(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Array<[number, number, number, number]> {
  const ax = snap(x1)
  const ay = snap(y1)
  const bx = snap(x2)
  const by = snap(y2)
  if (ax === bx || ay === by) return [[ax, ay, bx, by]]
  const mx = snap((ax + bx) / 2)
  return [
    [ax, ay, mx, ay],
    [mx, ay, mx, by],
    [mx, by, bx, by],
  ]
}

/**
 * Builds a minimal KiCad schematic (.kicad_sch) with generic rectangular
 * symbols (tiles), pin stubs, and orthogonal wires. Footprints are left empty
 * on purpose: the user replaces symbols/footprints in KiCad.
 */
export async function buildKicadSchematic(circuit: Circuit): Promise<string> {
  const layout = await runElkLayout(circuit)
  const libBlocks: string[] = []
  const instanceBlocks: string[] = []
  const wireBlocks: string[] = []
  const labelBlocks: string[] = []

  const pinAbs = new Map<string, { x: number; y: number; number: string }>()

  for (const component of circuit.components) {
    const { lib, pins } = buildLibSymbol(component)
    libBlocks.push(lib)

    const size = estimateNodeSize(component)
    const pos = layout.positions[component.id] ?? { x: 0, y: 0 }
    const sx = snap(pos.x * SCALE + (size.width * SCALE) / 2)
    const sy = snap(-(pos.y * SCALE + (size.height * SCALE) / 2))

    for (const p of pins) {
      const absX = sx + p.ox + (p.side === 'left' ? -PIN_LENGTH : PIN_LENGTH)
      const absY = sy + p.oy
      pinAbs.set(`${component.id}.${p.pin.id}`, {
        x: absX,
        y: absY,
        number: p.number,
      })
    }

    const pinInstances = pins
      .map(
        (p) =>
          `    (pin ${sexpString(p.number)} (uuid ${sexpString(uuid())}))`,
      )
      .join('\n')

    instanceBlocks.push(
      [
        `  (symbol (lib_id ${sexpString(symbolLibId(component))}) (at ${sx} ${sy} 0) (unit 1)`,
        `    (exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no)`,
        `    (uuid ${sexpString(uuid())})`,
        propertyBlock('Reference', component.id, snap(sx), snap(sy + 8)),
        propertyBlock(
          'Value',
          component.value?.trim() || component.label,
          snap(sx),
          snap(sy - 8),
        ),
        propertyBlock('Footprint', '', sx, sy, true),
        propertyBlock('Datasheet', '', sx, sy, true),
        `    (property "CircuitLLM_Type" ${sexpString(component.type)}`,
        `      (at ${sx} ${sy} 0)`,
        `      (effects (font (size 1.27 1.27)) (hide yes))`,
        `    )`,
        pinInstances,
        `  )`,
      ].join('\n'),
    )
  }

  for (const net of circuit.nets) {
    const points = net.connections
      .map((c) => pinAbs.get(`${c.component_id}.${c.pin_id}`))
      .filter((p): p is { x: number; y: number; number: string } => Boolean(p))

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      for (const [x1, y1, x2, y2] of manhattanWires(a.x, a.y, b.x, b.y)) {
        if (x1 === x2 && y1 === y2) continue
        wireBlocks.push(
          [
            `  (wire (pts (xy ${x1} ${y1}) (xy ${x2} ${y2}))`,
            `    (stroke (width 0) (type default))`,
            `    (uuid ${sexpString(uuid())})`,
            `  )`,
          ].join('\n'),
        )
      }
    }

    if (points.length >= 2) {
      const mid = points[0]
      labelBlocks.push(
        [
          `  (label ${sexpString(net.name)} (at ${snap(mid.x + 1.27)} ${snap(mid.y + 1.27)} 0)`,
          `    (effects (font (size 1.27 1.27)) (justify left bottom))`,
          `    (uuid ${sexpString(uuid())})`,
          `  )`,
        ].join('\n'),
      )
    }
  }

  return [
    `(kicad_sch`,
    `  (version 20250114)`,
    `  (generator "CircuitLLM")`,
    `  (generator_version "0.0.0")`,
    `  (uuid ${sexpString(uuid())})`,
    `  (paper "A3")`,
    `  (title_block`,
    `    (title ${sexpString(circuit.circuit_name)})`,
    `    (comment 1 ${sexpString('Minimal schematic tiles from CircuitLLM — replace symbols/footprints in KiCad')})`,
    `  )`,
    `  (lib_symbols`,
    ...libBlocks,
    `  )`,
    ...instanceBlocks,
    ...wireBlocks,
    ...labelBlocks,
    `  (sheet_instances`,
    `    (path "/" (page "1"))`,
    `  )`,
    `)`,
    '',
  ].join('\n')
}

export async function downloadKicadSchematic(circuit: Circuit): Promise<void> {
  const content = await buildKicadSchematic(circuit)
  const blob = new Blob([content], { type: 'application/x-kicad-schematic;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${toSafeFileName(circuit.circuit_name)}.kicad_sch`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
