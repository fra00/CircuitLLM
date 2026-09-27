import type { Component } from '../../types/circuit'
import { chipSlug } from './partMap'
import type { WokwiPartChoice } from './types'

export type { WokwiPartChoice }

export interface NativeAlternativeInfo {
  partType: string
  /** Short description shown in the choice dialog */
  description: string
  /** Maps CircuitLLM pin id → Wokwi pin name */
  buildPinMap: (component: Component) => Record<string, string>
  attrs?: (component: Component) => Record<string, string> | undefined
}

export interface WokwiComponentAnalysis {
  /** Stable key for remembering the choice (usually chip slug) */
  preferenceKey: string
  componentIds: string[]
  label: string
  type: string
  value?: string
  native: NativeAlternativeInfo | null
  /** Always present when a custom chip can be generated */
  custom: { slug: string; description: string } | null
  /**
   * When set, there is only one sensible option — no dialog.
   * When null, both native and custom are offered.
   */
  autoChoice: WokwiPartChoice | null
}

function identityPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) map[pin.id] = pin.id
  return map
}

function haystack(component: Component): string {
  return [component.label, component.kicad_symbol, component.value, component.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buzzerPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    const u = pin.id.toUpperCase()
    if (/^(POS|A|1|\+|ANODE)$/i.test(u) || /pos|anode/.test(u)) map[pin.id] = '1'
    else if (/^(NEG|K|2|-|CATHODE|GND)$/i.test(u) || /neg|cathode|gnd/.test(u)) {
      map[pin.id] = '2'
    }
  }
  if (component.pins[0] && !map[component.pins[0].id]) map[component.pins[0].id] = '1'
  if (component.pins[1] && !map[component.pins[1].id]) map[component.pins[1].id] = '2'
  return map
}

function tm1637PinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    const u = pin.id.toUpperCase()
    if (u === 'CLK') map[pin.id] = 'CLK'
    else if (u === 'DIO' || u === 'DAT' || u === 'DATA') map[pin.id] = 'DIO'
    else if (u === 'VCC' || u === 'VDD') map[pin.id] = 'VCC'
    else if (u === 'GND') map[pin.id] = 'GND'
    else map[pin.id] = pin.id
  }
  return map
}

function hcSr04PinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    const u = pin.id.toUpperCase()
    if (u === 'VCC' || u === 'VDD') map[pin.id] = 'VCC'
    else if (u === 'GND') map[pin.id] = 'GND'
    else if (u === 'TRIG' || u === 'TRIGGER') map[pin.id] = 'TRIG'
    else if (u === 'ECHO') map[pin.id] = 'ECHO'
    else map[pin.id] = pin.id
  }
  return map
}

function servoPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    const u = pin.id.toUpperCase()
    if (/PWM|SIG|OUT|IN|PULSE/.test(u) || u === '1') map[pin.id] = 'PWM'
    else if (/VCC|V\+|PLUS|PWR/.test(u)) map[pin.id] = 'V+'
    else if (/GND|V-|NEG/.test(u)) map[pin.id] = 'V-'
    else map[pin.id] = pin.id
  }
  return map
}

/**
 * Optional native Wokwi parts for modules that can also be custom chips.
 * Passives / MCU boards are forced native elsewhere (no dialog).
 */
export function findOptionalNative(component: Component): NativeAlternativeInfo | null {
  const text = haystack(component)
  const pinBlob = component.pins.map((p) => p.id).join(' ')

  if (/buzzer|beeper|piezo/.test(text)) {
    return {
      partType: 'wokwi-buzzer',
      description: 'Buzzer nativo Wokwi (simulazione audio integrata)',
      buildPinMap: buzzerPinMap,
    }
  }

  if (
    /tm1637|7-?segment|seven.?segment/.test(text) ||
    (/clk/i.test(pinBlob) && /dio/i.test(pinBlob) && /display|segment|tm1637/i.test(text))
  ) {
    return {
      partType: 'wokwi-tm1637-7segment',
      description: 'Display TM1637 7-segment nativo Wokwi',
      buildPinMap: tm1637PinMap,
    }
  }

  if (/hc-?sr04|ultrasonic/.test(text)) {
    return {
      partType: 'wokwi-hc-sr04',
      description: 'Sensore ultrasonico HC-SR04 nativo Wokwi',
      buildPinMap: hcSr04PinMap,
    }
  }

  if (/servo/.test(text)) {
    return {
      partType: 'wokwi-servo',
      description: 'Servo nativo Wokwi',
      buildPinMap: servoPinMap,
    }
  }

  if (component.type === 'LED' || (/^led\b|\bled\b/.test(text) && component.type !== 'OTHER')) {
    return {
      partType: 'wokwi-led',
      description: 'LED nativo Wokwi',
      buildPinMap: (c) => {
        const map: Record<string, string> = {}
        for (const pin of c.pins) {
          const id = pin.id.toUpperCase()
          if (id === 'A' || id === 'ANODE' || id === '1') map[pin.id] = 'A'
          else if (id === 'K' || id === 'C' || id === 'CATHODE' || id === '2') map[pin.id] = 'C'
          else map[pin.id] = pin.id
        }
        return map
      },
      attrs: (c) => {
        for (const color of ['red', 'green', 'blue', 'yellow', 'orange', 'white', 'purple']) {
          if (haystack(c).includes(color)) return { color }
        }
        return { color: 'red' }
      },
    }
  }

  return null
}

/** Types that never offer a custom chip (always native Wokwi). */
const NATIVE_ONLY_TYPES = new Set([
  'RESISTOR',
  'SWITCH',
  'MICROCONTROLLER',
  'POWER_SUPPLY',
  'POWER_RAIL',
])

/**
 * Analyzes whether a component can be exported as native Wokwi, custom chip, or both.
 */
export function analyzeWokwiComponent(component: Component): WokwiComponentAnalysis {
  const preferenceKey = chipSlug(component)
  const native = findOptionalNative(component)
  const forcedNative =
    NATIVE_ONLY_TYPES.has(component.type) ||
    (component.type === 'MICROCONTROLLER' && /arduino|esp32|pico|attiny/i.test(haystack(component)))

  // Resistor / MCU / power / switch → native path handled by partMap (auto native)
  if (forcedNative && component.type === 'RESISTOR') {
    return {
      preferenceKey,
      componentIds: [component.id],
      label: component.label,
      type: component.type,
      value: component.value,
      native: {
        partType: 'wokwi-resistor',
        description: 'Resistore nativo Wokwi',
        buildPinMap: identityPinMap,
        attrs: (c) => (c.value ? { value: c.value } : undefined),
      },
      custom: null,
      autoChoice: 'native',
    }
  }

  if (forcedNative && !native) {
    // MCU / switch / power — resolved only via partMap; treat as auto native
    return {
      preferenceKey,
      componentIds: [component.id],
      label: component.label,
      type: component.type,
      value: component.value,
      native: {
        partType: '(mapped)',
        description: 'Parte nativa Wokwi (mapping automatico)',
        buildPinMap: identityPinMap,
      },
      custom: null,
      autoChoice: 'native',
    }
  }

  const custom = {
    slug: preferenceKey,
    description: `Custom chip LLM (\`chip-${preferenceKey}\`) con pinout del progetto`,
  }

  if (native && !forcedNative) {
    return {
      preferenceKey,
      componentIds: [component.id],
      label: component.label,
      type: component.type,
      value: component.value,
      native,
      custom,
      autoChoice: null, // ask user
    }
  }

  if (native && forcedNative) {
    return {
      preferenceKey,
      componentIds: [component.id],
      label: component.label,
      type: component.type,
      value: component.value,
      native,
      custom: null,
      autoChoice: 'native',
    }
  }

  // Pure custom (motor, L298N, opamp, …)
  return {
    preferenceKey,
    componentIds: [component.id],
    label: component.label,
    type: component.type,
    value: component.value,
    native: null,
    custom,
    autoChoice: 'custom',
  }
}

/**
 * Dedupes analyses by preferenceKey, merging component ids that share the same slug.
 */
export function analyzeCircuitChoices(components: Component[]): WokwiComponentAnalysis[] {
  const byKey = new Map<string, WokwiComponentAnalysis>()
  for (const component of components) {
    const analysis = analyzeWokwiComponent(component)
    const existing = byKey.get(analysis.preferenceKey)
    if (existing) {
      existing.componentIds.push(component.id)
    } else {
      byKey.set(analysis.preferenceKey, { ...analysis, componentIds: [component.id] })
    }
  }
  return [...byKey.values()]
}

/** Analyses that need a user decision (both options, no saved preference). */
export function pendingWokwiChoices(
  analyses: WokwiComponentAnalysis[],
  saved: Record<string, WokwiPartChoice>,
): WokwiComponentAnalysis[] {
  return analyses.filter(
    (a) => a.autoChoice === null && a.native && a.custom && !saved[a.preferenceKey],
  )
}

export function resolveChoice(
  analysis: WokwiComponentAnalysis,
  saved: Record<string, WokwiPartChoice>,
): WokwiPartChoice {
  if (analysis.autoChoice) return analysis.autoChoice
  const pref = saved[analysis.preferenceKey]
  if (pref) return pref
  // Fallback if dialog was skipped: prefer native when available
  return analysis.native ? 'native' : 'custom'
}
