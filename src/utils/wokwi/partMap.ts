import type { Component, ComponentType } from '../../types/circuit'
import type { PendingChip, ResolvedPart, WokwiPart, WokwiPartChoice } from './types'

function haystack(component: Component): string {
  return [component.label, component.kicad_symbol, component.value, component.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** kebab-case slug for custom chip filenames and diagram types */
export function chipSlug(component: Component): string {
  const base = (component.label || component.type || 'chip')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'custom-chip'
}

function identityPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    map[pin.id] = pin.id
  }
  return map
}

/** Arduino Nano / Uno style: D13 → 13, keep A0, GND, 5V, 3V3, VIN, RST, REF */
export function arduinoPinAlias(pinId: string): string {
  const raw = pinId.replace(/^pin:/, '')
  const dMatch = /^D(\d+)$/i.exec(raw)
  if (dMatch) return dMatch[1]
  // Labels like D0/RX → take leading Dn
  const dSlash = /^D(\d+)\//i.exec(raw)
  if (dSlash) return dSlash[1]
  if (/^GND\d*$/i.test(raw)) return 'GND'
  if (/^3V3$/i.test(raw) || /^3\.3V$/i.test(raw)) return '3.3V'
  return raw
}

/** ESP32 DevKit: D2/GPIO2 → 2, GND → GND.1 (plain "GND" is invalid on this board) */
export function esp32PinAlias(pinId: string): string {
  const raw = pinId.replace(/^pin:/, '')
  const gpio = /^(?:GPIO|IO|D)?(\d+)$/i.exec(raw)
  if (gpio) return gpio[1]
  const gpioSlash = /^(?:GPIO|IO|D)(\d+)\//i.exec(raw)
  if (gpioSlash) return gpioSlash[1]
  // Multiple GND pads: GND / GND1 → GND.1, GND2 → GND.2
  const gnd = /^GND(\d*)$/i.exec(raw)
  if (gnd) {
    const n = gnd[1] === '' || gnd[1] === '1' ? '1' : gnd[1]
    return `GND.${n}`
  }
  if (/^3V3$/i.test(raw) || /^3\.3V$/i.test(raw)) return '3V3'
  if (/^VIN$/i.test(raw)) return 'VIN'
  if (/^5V$/i.test(raw)) return '5V'
  return raw
}

function arduinoPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    map[pin.id] = arduinoPinAlias(pin.id)
  }
  return map
}

function esp32PinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    map[pin.id] = esp32PinAlias(pin.id)
  }
  return map
}

function passiveABMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  const pins = component.pins
  if (pins.length >= 1) map[pins[0].id] = '1'
  if (pins.length >= 2) map[pins[1].id] = '2'
  // Also accept A/B or 1/2 labels as already correct
  for (const pin of pins) {
    if (pin.id === '1' || pin.id === '2') map[pin.id] = pin.id
    if (pin.id === 'A') map[pin.id] = '1'
    if (pin.id === 'B') map[pin.id] = '2'
  }
  return map
}

function ledPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    const id = pin.id.toUpperCase()
    if (id === 'A' || id === 'ANODE' || id === '1') map[pin.id] = 'A'
    else if (id === 'K' || id === 'C' || id === 'CATHODE' || id === '2') map[pin.id] = 'C'
    else map[pin.id] = pin.id
  }
  return map
}

/**
 * wokwi-pushbutton: contact 1 (1.l/1.r) vs contact 2 (2.l/2.r).
 * 1.l and 1.r are ALWAYS shorted (same contact). Button press joins contact 1↔2.
 * So signal → 1.l and GND return → 2.l (NOT 1.r).
 */
function switchPinMap(component: Component): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pin of component.pins) {
    const key = `${pin.id} ${pin.label}`.trim()
    if (/^1\b/.test(pin.id) || pin.label.trim() === '1') map[pin.id] = '1.l'
    else if (/^2\b/.test(pin.id) || pin.label.trim() === '2') map[pin.id] = '2.l'
    else if (/gnd|neg|0v/i.test(key)) map[pin.id] = '2.l'
    else if (/sig|out|in|gpio/i.test(key)) map[pin.id] = '1.l'
  }
  const pins = component.pins
  if (pins.length >= 1 && !map[pins[0].id]) map[pins[0].id] = '1.l'
  if (pins.length >= 2 && !map[pins[1].id]) map[pins[1].id] = '2.l'
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

function ledColor(component: Component): string {
  const text = haystack(component)
  for (const color of ['red', 'green', 'blue', 'yellow', 'orange', 'white', 'purple']) {
    if (text.includes(color)) return color
  }
  return 'red'
}

function asPending(component: Component, slug: string): PendingChip {
  return {
    slug,
    label: component.label,
    type: component.type,
    value: component.value,
    kicad_symbol: component.kicad_symbol,
    pins: component.pins.map((p) => ({
      id: p.id,
      label: p.label,
      type: p.type,
    })),
  }
}

/**
 * Resolves a CircuitLLM component to a Wokwi part.
 * Returns customChipSlug when a native part is not available.
 * `choice` forces native vs custom when both are possible (buzzer, TM1637, …).
 */
export function resolveComponent(
  component: Component,
  position: { x: number; y: number },
  choice: WokwiPartChoice = 'native',
): { resolved: ResolvedPart; pending?: PendingChip } {
  const text = haystack(component)
  const base: Pick<WokwiPart, 'id' | 'left' | 'top'> = {
    id: component.id,
    left: position.x,
    top: position.y,
  }
  const preferCustom = choice === 'custom'

  const asCustom = () => {
    const slug = chipSlug(component)
    return {
      resolved: {
        part: { ...base, type: `chip-${slug}` },
        pinMap: identityPinMap(component),
        customChipSlug: slug,
      },
      pending: asPending(component, slug),
    }
  }

  const type: ComponentType = component.type

  // --- Microcontrollers ---
  if (type === 'MICROCONTROLLER') {
    if (/nano/.test(text) || /arduino_nano/.test(text)) {
      return {
        resolved: {
          part: { ...base, type: 'wokwi-arduino-nano' },
          pinMap: arduinoPinMap(component),
        },
      }
    }
    if (/uno/.test(text) && !/nano/.test(text)) {
      return {
        resolved: {
          part: { ...base, type: 'wokwi-arduino-uno' },
          pinMap: arduinoPinMap(component),
        },
      }
    }
    if (/mega/.test(text)) {
      return {
        resolved: {
          part: { ...base, type: 'wokwi-arduino-mega' },
          pinMap: arduinoPinMap(component),
        },
      }
    }
    if (/pico|rp2040/.test(text)) {
      return {
        resolved: {
          part: { ...base, type: 'wokwi-pi-pico' },
          pinMap: identityPinMap(component),
        },
      }
    }
    if (/esp32/.test(text)) {
      return {
        resolved: {
          part: { ...base, type: 'board-esp32-devkit-c-v4' },
          pinMap: esp32PinMap(component),
        },
      }
    }
    return asCustom()
  }

  if (type === 'RESISTOR') {
    const attrs: Record<string, string> = {}
    if (component.value) attrs.value = component.value
    return {
      resolved: {
        part: { ...base, type: 'wokwi-resistor', attrs },
        pinMap: passiveABMap(component),
      },
    }
  }

  if (type === 'LED') {
    if (preferCustom) return asCustom()
    return {
      resolved: {
        part: {
          ...base,
          type: 'wokwi-led',
          attrs: { color: ledColor(component) },
        },
        pinMap: ledPinMap(component),
      },
    }
  }

  if (type === 'SWITCH') {
    if (/slide|spdt|toggle/.test(text)) {
      return {
        resolved: {
          part: { ...base, type: 'wokwi-slide-switch' },
          pinMap: identityPinMap(component),
        },
      }
    }
    return {
      resolved: {
        part: { ...base, type: 'wokwi-pushbutton' },
        pinMap: switchPinMap(component),
      },
    }
  }

  if (type === 'SENSOR' && /hc-?sr04|ultrasonic/.test(text)) {
    if (preferCustom) return asCustom()
    return {
      resolved: {
        part: { ...base, type: 'wokwi-hc-sr04' },
        pinMap: hcSr04PinMap(component),
      },
    }
  }

  // Native Wokwi buzzer (before generic OTHER/custom fallback)
  if (/buzzer|beeper|piezo/.test(text)) {
    if (preferCustom) return asCustom()
    const map: Record<string, string> = {}
    for (const pin of component.pins) {
      const u = pin.id.toUpperCase()
      if (/^(POS|A|1|\+|ANODE)$/i.test(u) || /pos|anode/.test(u)) map[pin.id] = '1'
      else if (/^(NEG|K|2|-|CATHODE|GND)$/i.test(u) || /neg|cathode|gnd/.test(u)) {
        map[pin.id] = '2'
      }
    }
    if (component.pins.length >= 1 && !map[component.pins[0].id]) {
      map[component.pins[0].id] = '1'
    }
    if (component.pins.length >= 2 && !map[component.pins[1].id]) {
      map[component.pins[1].id] = '2'
    }
    return {
      resolved: {
        part: { ...base, type: 'wokwi-buzzer' },
        pinMap: map,
      },
    }
  }

  // TM1637 7-segment
  {
    const pinBlob = component.pins.map((p) => p.id).join(' ')
    if (
      /tm1637|7-?segment|seven.?segment/.test(text) ||
      (/clk/i.test(pinBlob) && /dio/i.test(pinBlob) && /display|segment|tm1637/i.test(text))
    ) {
      if (preferCustom) return asCustom()
      const map: Record<string, string> = {}
      for (const pin of component.pins) {
        const u = pin.id.toUpperCase()
        if (u === 'CLK') map[pin.id] = 'CLK'
        else if (u === 'DIO' || u === 'DAT' || u === 'DATA') map[pin.id] = 'DIO'
        else if (u === 'VCC' || u === 'VDD') map[pin.id] = 'VCC'
        else if (u === 'GND') map[pin.id] = 'GND'
        else map[pin.id] = pin.id
      }
      return {
        resolved: {
          part: { ...base, type: 'wokwi-tm1637-7segment' },
          pinMap: map,
        },
      }
    }
  }

  if (type === 'CAPACITOR' || type === 'INDUCTOR' || type === 'DIODE' ||
      type === 'TRANSISTOR' || type === 'OPAMP' || type === 'MOTOR' ||
      type === 'CONNECTOR' || type === 'OTHER' || type === 'SENSOR') {
    return asCustom()
  }

  if (type === 'POWER_SUPPLY' || type === 'POWER_RAIL') {
    const isGnd =
      /gnd|ground|0v/.test(text) ||
      (component.value ?? '').trim() === '0V'
    if (isGnd) {
      return {
        resolved: {
          part: { ...base, type: 'wokwi-gnd' },
          pinMap: Object.fromEntries(
            component.pins.map((p) => [p.id, 'GND']),
          ),
        },
      }
    }
    // Battery with POS+NEG: keep custom so both terminals stay addressable
    const hasPos = component.pins.some((p) => /pos|\+|vcc|vout/i.test(p.id))
    const hasNeg = component.pins.some((p) => /neg|-|gnd/i.test(p.id))
    if (hasPos && hasNeg && component.pins.length >= 2) {
      return asCustom()
    }
    const voltage = component.value?.replace(/[^0-9.]/g, '') || '5'
    return {
      resolved: {
        part: {
          ...base,
          type: 'wokwi-vcc',
          attrs: { value: `${voltage}V` },
        },
        pinMap: Object.fromEntries(
          component.pins.map((p) => [p.id, 'VCC']),
        ),
      },
    }
  }

  return asCustom()
}

/** Heuristic wire color from net name / pin labels */
export function wireColor(netName: string, pinHints: string[]): string {
  const text = [netName, ...pinHints].join(' ').toLowerCase()
  if (/gnd|ground|0v/.test(text)) return 'black'
  if (/vcc|5v|3v3|3\.3|vin|vdd|pwr|power/.test(text)) return 'red'
  if (/scl|sda|i2c/.test(text)) return 'blue'
  if (/tx|rx|uart/.test(text)) return 'orange'
  return 'green'
}
