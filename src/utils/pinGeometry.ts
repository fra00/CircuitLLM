import type { Component, PinType } from '../types/circuit'

export type PinSide = 'left' | 'right'

const LEFT_TYPES: PinType[] = ['INPUT', 'POWER_IN', 'PASSIVE']
const RIGHT_TYPES: PinType[] = ['OUTPUT', 'POWER_OUT', 'BIDIRECTIONAL', 'NO_CONNECT']

export function pinSide(type: PinType, index: number): PinSide {
  if (RIGHT_TYPES.includes(type)) return 'right'
  if (LEFT_TYPES.includes(type)) {
    // PASSIVE pins alternate to keep the symbol balanced
    if (type === 'PASSIVE') return index % 2 === 0 ? 'left' : 'right'
    return 'left'
  }
  return 'left'
}

/**
 * Approximate the rendered size of a SchematicNode so ELK can
 * compute a layout without overlaps. Refined by measured sizes
 * once the node is rendered, if precision is needed.
 */
export function estimateNodeSize(component: Component): {
  width: number
  height: number
} {
  const header = 22
  const labelRow = 18
  const valueRow = component.value ? 16 : 0
  const pinsPadding = 10
  const pinRow = 18
  const height = header + labelRow + valueRow + pinsPadding + component.pins.length * pinRow

  const maxLabel = Math.max(
    component.label.length,
    ...component.pins.map((p) => p.label.length),
  )
  const width = Math.max(180, 84 + maxLabel * 7)

  return { width, height }
}