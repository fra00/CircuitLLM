import type { Component, ComponentType, PinType } from '../types/circuit'

interface PalettePin {
  label: string
  type: PinType
}

const REF_PREFIX: Record<ComponentType, string> = {
  MICROCONTROLLER: 'U',
  RESISTOR: 'R',
  CAPACITOR: 'C',
  INDUCTOR: 'L',
  DIODE: 'D',
  LED: 'LED',
  TRANSISTOR: 'Q',
  OPAMP: 'U',
  SENSOR: 'S',
  MOTOR: 'M',
  CONNECTOR: 'J',
  POWER_SUPPLY: 'PS',
  POWER_RAIL: 'RAIL',
  SWITCH: 'SW',
  OTHER: 'X',
}

const DEFAULT_PINS: Record<ComponentType, PalettePin[]> = {
  MICROCONTROLLER: [
    { label: 'A0', type: 'BIDIRECTIONAL' },
    { label: 'D0', type: 'BIDIRECTIONAL' },
    { label: 'D1', type: 'BIDIRECTIONAL' },
    { label: '5V', type: 'POWER_OUT' },
    { label: 'GND', type: 'POWER_IN' },
  ],
  RESISTOR: [
    { label: '1', type: 'PASSIVE' },
    { label: '2', type: 'PASSIVE' },
  ],
  CAPACITOR: [
    { label: '1', type: 'PASSIVE' },
    { label: '2', type: 'PASSIVE' },
  ],
  INDUCTOR: [
    { label: '1', type: 'PASSIVE' },
    { label: '2', type: 'PASSIVE' },
  ],
  DIODE: [
    { label: 'A', type: 'PASSIVE' },
    { label: 'K', type: 'PASSIVE' },
  ],
  LED: [
    { label: 'A', type: 'PASSIVE' },
    { label: 'K', type: 'PASSIVE' },
  ],
  TRANSISTOR: [
    { label: 'B', type: 'PASSIVE' },
    { label: 'C', type: 'PASSIVE' },
    { label: 'E', type: 'PASSIVE' },
  ],
  OPAMP: [
    { label: 'IN-', type: 'INPUT' },
    { label: 'IN+', type: 'INPUT' },
    { label: 'OUT', type: 'OUTPUT' },
    { label: 'V+', type: 'POWER_IN' },
    { label: 'V-', type: 'POWER_IN' },
  ],
  SENSOR: [
    { label: 'VCC', type: 'POWER_IN' },
    { label: 'GND', type: 'POWER_IN' },
    { label: 'OUT', type: 'OUTPUT' },
  ],
  MOTOR: [
    { label: 'PWR1', type: 'POWER_IN' },
    { label: 'PWR2', type: 'POWER_IN' },
    { label: 'ENC_A', type: 'OUTPUT' },
    { label: 'ENC_B', type: 'OUTPUT' },
  ],
  CONNECTOR: [
    { label: '1', type: 'PASSIVE' },
    { label: '2', type: 'PASSIVE' },
    { label: '3', type: 'PASSIVE' },
    { label: '4', type: 'PASSIVE' },
  ],
  POWER_SUPPLY: [
    { label: 'VCC', type: 'POWER_OUT' },
    { label: 'GND', type: 'POWER_IN' },
  ],
  POWER_RAIL: [{ label: 'OUT', type: 'POWER_OUT' }],
  SWITCH: [
    { label: '1', type: 'PASSIVE' },
    { label: '2', type: 'PASSIVE' },
  ],
  OTHER: [
    { label: '1', type: 'PASSIVE' },
    { label: '2', type: 'PASSIVE' },
  ],
}

const DEFAULT_VALUE: Partial<Record<ComponentType, string>> = {
  RESISTOR: '10k',
  CAPACITOR: '100nF',
  INDUCTOR: '10uH',
  LED: 'red',
  POWER_SUPPLY: '5V',
  POWER_RAIL: '5V',
}

/** Human readable labels for the palette buttons, keyed by type */
export const PALETTE_LABELS: Record<ComponentType, string> = {
  MICROCONTROLLER: 'Microcontrollore',
  RESISTOR: 'Resistore',
  CAPACITOR: 'Condensatore',
  INDUCTOR: 'Induttore',
  DIODE: 'Diodo',
  LED: 'LED',
  TRANSISTOR: 'Transistor',
  OPAMP: 'OpAmp',
  SENSOR: 'Sensore',
  MOTOR: 'Motore DC',
  CONNECTOR: 'Connettore',
  POWER_SUPPLY: 'Alimentatore',
  POWER_RAIL: 'Rail di potenza',
  SWITCH: 'Interruttore',
  OTHER: 'Altro',
}

export const PALETTE_ORDER: ComponentType[] = [
  'MICROCONTROLLER',
  'RESISTOR',
  'CAPACITOR',
  'LED',
  'DIODE',
  'TRANSISTOR',
  'OPAMP',
  'SENSOR',
  'MOTOR',
  'SWITCH',
  'CONNECTOR',
  'POWER_SUPPLY',
  'POWER_RAIL',
  'INDUCTOR',
  'OTHER',
]

/** Returns the next free reference (R4, C2, U3...) for a component type */
export function nextComponentRef(
  type: ComponentType,
  existingComponents: Component[],
): string {
  const prefix = REF_PREFIX[type]
  const taken = new Set(existingComponents.map((c) => c.id))
  let n = 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/** Builds a new component with a sensible pinout and value for its type */
export function createComponent(
  type: ComponentType,
  existingComponents: Component[],
): Component {
  const id = nextComponentRef(type, existingComponents)
  return {
    id,
    label: PALETTE_LABELS[type],
    type,
    value: DEFAULT_VALUE[type],
    pins: DEFAULT_PINS[type].map((pin) => ({
      id: pin.label,
      label: pin.label,
      type: pin.type,
      number: /^\d+$/.test(pin.label) ? Number(pin.label) : undefined,
    })),
  }
}