import type { Circuit } from '../types/circuit'

/** Minimal circuit fixture for unit tests */
export function makeTestCircuit(overrides: Partial<Circuit> = {}): Circuit {
  return {
    circuit_name: 'Test Circuit',
    components: [
      {
        id: 'R1',
        label: 'Pull-up',
        type: 'RESISTOR',
        value: '10k',
        pins: [
          { id: 'A', label: '1', type: 'PASSIVE' },
          { id: 'B', label: '2', type: 'PASSIVE' },
        ],
      },
      {
        id: 'U1',
        label: 'MCU',
        type: 'MICROCONTROLLER',
        pins: [
          { id: 'D0', label: 'D0', type: 'OUTPUT' },
          { id: 'GND', label: 'GND', type: 'POWER_IN' },
        ],
      },
    ],
    nets: [
      {
        name: 'SIGNAL',
        connections: [
          { component_id: 'U1', pin_id: 'D0' },
          { component_id: 'R1', pin_id: 'A' },
        ],
      },
    ],
    ...overrides,
  }
}
