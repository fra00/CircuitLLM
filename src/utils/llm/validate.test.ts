import { describe, expect, it } from 'vitest'
import {
  CircuitValidationError,
  extractJson,
  normalizeCircuit,
  repairJson,
} from './validate'

describe('extractJson', () => {
  it('parses clean JSON object', () => {
    const raw = '{"circuit_name":"X","components":[],"nets":[]}'
    expect(extractJson(raw)).toEqual({
      circuit_name: 'X',
      components: [],
      nets: [],
    })
  })

  it('strips markdown fences', () => {
    const raw = '```json\n{"circuit_name":"X","components":[],"nets":[]}\n```'
    expect(extractJson(raw)).toMatchObject({ circuit_name: 'X' })
  })

  it('throws when no JSON object found', () => {
    expect(() => extractJson('no json here')).toThrow(CircuitValidationError)
  })
})

describe('repairJson', () => {
  it('fixes trailing commas', () => {
    const broken = '{"a": 1,}'
    expect(JSON.parse(repairJson(broken))).toEqual({ a: 1 })
  })

  it('quotes unquoted keys', () => {
    const broken = '{type: "LED"}'
    expect(JSON.parse(repairJson(broken))).toEqual({ type: 'LED' })
  })
})

describe('normalizeCircuit', () => {
  it('normalizes a minimal valid circuit', () => {
    const circuit = normalizeCircuit({
      circuit_name: 'Gen',
      components: [
        {
          id: 'R1',
          label: 'R',
          type: 'RESISTOR',
          value: '10k',
          pins: [{ id: '1', label: '1', type: 'PASSIVE' }],
        },
      ],
      nets: [],
    })
    expect(circuit.circuit_name).toBe('Gen')
    expect(circuit.components).toHaveLength(1)
    expect(circuit.components[0].pins).toHaveLength(1)
  })

  it('rejects empty components list', () => {
    expect(() =>
      normalizeCircuit({ circuit_name: 'Empty', components: [], nets: [] }),
    ).toThrow(CircuitValidationError)
  })

  it('rejects duplicate component ids', () => {
    expect(() =>
      normalizeCircuit({
        circuit_name: 'Dup',
        components: [
          { id: 'R1', label: 'A', type: 'RESISTOR', pins: [{ id: '1', label: '1', type: 'PASSIVE' }] },
          { id: 'R1', label: 'B', type: 'RESISTOR', pins: [{ id: '1', label: '1', type: 'PASSIVE' }] },
        ],
        nets: [],
      }),
    ).toThrow(/duplicato/)
  })

  it('drops nets with invalid pin references', () => {
    const circuit = normalizeCircuit({
      circuit_name: 'Net filter',
      components: [
        {
          id: 'R1',
          label: 'R',
          type: 'RESISTOR',
          pins: [
            { id: 'A', label: 'A', type: 'PASSIVE' },
            { id: 'B', label: 'B', type: 'PASSIVE' },
          ],
        },
      ],
      nets: [
        {
          name: 'BAD',
          connections: [
            { component_id: 'R1', pin_id: 'A' },
            { component_id: 'R1', pin_id: 'MISSING' },
          ],
        },
      ],
    })
    expect(circuit.nets).toHaveLength(0)
  })
})
