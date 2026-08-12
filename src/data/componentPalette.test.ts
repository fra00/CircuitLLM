import { describe, expect, it } from 'vitest'
import { createComponent, nextComponentRef } from './componentPalette'
import { makeTestCircuit } from '../test/fixtures'

describe('nextComponentRef', () => {
  it('returns first free ref for type', () => {
    const circuit = makeTestCircuit()
    expect(nextComponentRef('RESISTOR', circuit.components)).toBe('R2')
    expect(nextComponentRef('CAPACITOR', circuit.components)).toBe('C1')
  })

  it('skips taken refs', () => {
    const circuit = makeTestCircuit({
      components: [
        ...makeTestCircuit().components,
        {
          id: 'R2',
          label: 'R2',
          type: 'RESISTOR',
          pins: [
            { id: '1', label: '1', type: 'PASSIVE' },
            { id: '2', label: '2', type: 'PASSIVE' },
          ],
        },
      ],
    })
    expect(nextComponentRef('RESISTOR', circuit.components)).toBe('R3')
  })
})

describe('createComponent', () => {
  it('creates resistor with default value and two passive pins', () => {
    const component = createComponent('RESISTOR', [])
    expect(component.id).toBe('R1')
    expect(component.value).toBe('10k')
    expect(component.pins).toHaveLength(2)
    expect(component.pins[0].type).toBe('PASSIVE')
  })

  it('assigns unique id against existing components', () => {
    const existing = makeTestCircuit().components
    const cap = createComponent('CAPACITOR', existing)
    expect(cap.id).toBe('C1')
    expect(existing.some((c) => c.id === cap.id)).toBe(false)
  })
})
