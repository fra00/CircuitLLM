export type PinType =
  | 'INPUT'
  | 'OUTPUT'
  | 'BIDIRECTIONAL'
  | 'POWER_IN'
  | 'POWER_OUT'
  | 'PASSIVE'
  | 'NO_CONNECT'

export type ComponentType =
  | 'MICROCONTROLLER'
  | 'RESISTOR'
  | 'CAPACITOR'
  | 'INDUCTOR'
  | 'DIODE'
  | 'LED'
  | 'TRANSISTOR'
  | 'OPAMP'
  | 'SENSOR'
  | 'MOTOR'
  | 'CONNECTOR'
  | 'POWER_SUPPLY'
  | 'POWER_RAIL'
  | 'SWITCH'
  | 'OTHER'

export interface Pin {
  id: string
  label: string
  type: PinType
  /** Physical pin number, if applicable (e.g. "1", "2" for connectors) */
  number?: number
}

export interface Component {
  id: string
  label: string
  type: ComponentType
  /** KiCad symbol library reference, e.g. "MCU_Module:Arduino_Nano" */
  kicad_symbol?: string
  /** Human readable value, e.g. "10k", "4.7uF", "5V" */
  value?: string
  pins: Pin[]
}

export interface NetConnection {
  component_id: string
  pin_id: string
}

export interface Net {
  name: string
  connections: NetConnection[]
}

/**
 * Circuit data model. This is the canonical graph exchanged between the
 * LLM engine and the editor. It MUST NOT contain spatial coordinates:
 * the auto-layout engine (ELK.js) is the only system that decides X/Y.
 */
export interface Circuit {
  circuit_name: string
  components: Component[]
  nets: Net[]
}
