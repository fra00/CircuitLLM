import { describe, expect, it } from 'vitest'
import { SAMPLE_CIRCUIT } from '../../data/sampleCircuit'
import { makeTestCircuit } from '../../test/fixtures'
import { circuitToDiagram, ensurePushbuttonGroundReturns, expandNetConnections } from './circuitToDiagram'
import type { WokwiConnection } from './types'
import { arduinoPinAlias, esp32PinAlias, resolveComponent } from './partMap'

describe('arduinoPinAlias', () => {
  it('maps Dn to numeric Arduino pins', () => {
    expect(arduinoPinAlias('D13')).toBe('13')
    expect(arduinoPinAlias('D0/RX')).toBe('0')
    expect(arduinoPinAlias('A0')).toBe('A0')
    expect(arduinoPinAlias('GND2')).toBe('GND')
    expect(arduinoPinAlias('3V3')).toBe('3.3V')
  })
})

describe('esp32PinAlias', () => {
  it('maps Dx / GPIOx to numeric ESP32 pins and GND to GND.1', () => {
    expect(esp32PinAlias('D2')).toBe('2')
    expect(esp32PinAlias('GPIO22')).toBe('22')
    expect(esp32PinAlias('3V3')).toBe('3V3')
    expect(esp32PinAlias('GND')).toBe('GND.1')
    expect(esp32PinAlias('GND2')).toBe('GND.2')
  })
})

describe('resolveComponent', () => {
  it('maps resistors and Arduino Nano to native Wokwi parts', () => {
    const r = resolveComponent(
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
      { x: 10, y: 20 },
    )
    expect(r.resolved.part.type).toBe('wokwi-resistor')
    expect(r.resolved.part.attrs?.value).toBe('10k')
    expect(r.pending).toBeUndefined()

    const nano = resolveComponent(
      {
        id: 'U1',
        label: 'Arduino Nano',
        type: 'MICROCONTROLLER',
        kicad_symbol: 'MCU_Module:Arduino_Nano',
        pins: [
          { id: 'D13', label: 'D13', type: 'OUTPUT' },
          { id: 'GND', label: 'GND', type: 'POWER_IN' },
        ],
      },
      { x: 0, y: 0 },
    )
    expect(nano.resolved.part.type).toBe('wokwi-arduino-nano')
    expect(nano.resolved.pinMap.D13).toBe('13')
  })

  it('maps HC-SR04 natively and motors to custom chips', () => {
    const sonar = resolveComponent(
      {
        id: 'S1',
        label: 'HC-SR04 Ultrasonic',
        type: 'SENSOR',
        pins: [
          { id: 'VCC', label: 'VCC', type: 'POWER_IN' },
          { id: 'TRIG', label: 'TRIG', type: 'INPUT' },
          { id: 'ECHO', label: 'ECHO', type: 'OUTPUT' },
          { id: 'GND', label: 'GND', type: 'POWER_IN' },
        ],
      },
      { x: 0, y: 0 },
    )
    expect(sonar.resolved.part.type).toBe('wokwi-hc-sr04')

    const motor = resolveComponent(
      {
        id: 'M1',
        label: 'DC Motor w/ Encoder',
        type: 'MOTOR',
        pins: [
          { id: 'PWR1', label: '+', type: 'POWER_IN' },
          { id: 'PWR2', label: '-', type: 'POWER_IN' },
        ],
      },
      { x: 0, y: 0 },
    )
    expect(motor.resolved.part.type).toMatch(/^chip-/)
    expect(motor.pending?.type).toBe('MOTOR')
    expect(motor.resolved.customChipSlug).toBe(motor.pending?.slug)
  })

  it('maps buzzer and 7-segment to native Wokwi parts', () => {
    const buzzer = resolveComponent(
      {
        id: 'BZ1',
        label: 'Buzzer',
        type: 'OTHER',
        pins: [
          { id: 'POS', label: 'POS', type: 'PASSIVE' },
          { id: 'NEG', label: 'NEG', type: 'PASSIVE' },
        ],
      },
      { x: 0, y: 0 },
    )
    expect(buzzer.resolved.part.type).toBe('wokwi-buzzer')
    expect(buzzer.resolved.pinMap.POS).toBe('1')
    expect(buzzer.resolved.pinMap.NEG).toBe('2')

    const disp = resolveComponent(
      {
        id: 'DISP1',
        label: '7-Segment Display',
        type: 'OTHER',
        pins: [
          { id: 'CLK', label: 'CLK', type: 'INPUT' },
          { id: 'DIO', label: 'DIO', type: 'BIDIRECTIONAL' },
          { id: 'VCC', label: 'VCC', type: 'POWER_IN' },
          { id: 'GND', label: 'GND', type: 'POWER_IN' },
        ],
      },
      { x: 0, y: 0 },
    )
    expect(disp.resolved.part.type).toBe('wokwi-tm1637-7segment')
  })
})

describe('circuitToDiagram', () => {
  it('builds parts and star connections for the sample circuit', () => {
    const { diagram, pendingChips, hasNativeMcu } = circuitToDiagram(SAMPLE_CIRCUIT)
    expect(hasNativeMcu).toBe(true)
    expect(diagram.version).toBe(1)
    expect(diagram.editor).toBe('circuitllm')
    expect(diagram.parts.some((p) => p.type === 'wokwi-arduino-nano')).toBe(true)
    expect(diagram.parts.some((p) => p.type === 'wokwi-hc-sr04')).toBe(true)
    expect(diagram.parts.some((p) => p.type === 'wokwi-resistor')).toBe(true)
    expect(diagram.connections.length).toBeGreaterThan(0)
    expect(pendingChips.some((c) => c.slug.includes('motor') || c.type === 'MOTOR')).toBe(true)
  })

  it('dedupes pending chips by slug', () => {
    const circuit = makeTestCircuit({
      components: [
        {
          id: 'M1',
          label: 'DC Motor',
          type: 'MOTOR',
          pins: [
            { id: 'PWR1', label: '+', type: 'POWER_IN' },
            { id: 'PWR2', label: '-', type: 'POWER_IN' },
          ],
        },
        {
          id: 'M2',
          label: 'DC Motor',
          type: 'MOTOR',
          pins: [
            { id: 'PWR1', label: '+', type: 'POWER_IN' },
            { id: 'PWR2', label: '-', type: 'POWER_IN' },
          ],
        },
      ],
      nets: [],
    })
    const { pendingChips } = circuitToDiagram(circuit)
    expect(pendingChips).toHaveLength(1)
  })

  it('zips multi-pin buses between two components instead of shorting them', () => {
    const circuit = makeTestCircuit({
      components: [
        {
          id: 'U1',
          label: 'ESP32',
          type: 'MICROCONTROLLER',
          pins: [
            { id: 'D2', label: 'D2', type: 'OUTPUT' },
            { id: 'D4', label: 'D4', type: 'OUTPUT' },
            { id: 'D5', label: 'D5', type: 'OUTPUT' },
            { id: 'D18', label: 'D18', type: 'OUTPUT' },
            { id: 'GND', label: 'GND', type: 'POWER_IN' },
          ],
        },
        {
          id: 'H1',
          label: 'L298N Driver',
          type: 'OTHER',
          pins: [
            { id: 'IN1', label: 'IN1', type: 'INPUT' },
            { id: 'IN2', label: 'IN2', type: 'INPUT' },
            { id: 'IN3', label: 'IN3', type: 'INPUT' },
            { id: 'IN4', label: 'IN4', type: 'INPUT' },
          ],
        },
      ],
      nets: [
        {
          name: 'MOTOR_CTRL',
          connections: [
            { component_id: 'U1', pin_id: 'D2' },
            { component_id: 'U1', pin_id: 'D4' },
            { component_id: 'U1', pin_id: 'D5' },
            { component_id: 'U1', pin_id: 'D18' },
            { component_id: 'H1', pin_id: 'IN1' },
            { component_id: 'H1', pin_id: 'IN2' },
            { component_id: 'H1', pin_id: 'IN3' },
            { component_id: 'H1', pin_id: 'IN4' },
          ],
        },
      ],
    })
    const { diagram } = circuitToDiagram(circuit)
    const wires = diagram.connections.map(([a, b]) => [a, b].sort().join('--'))
    expect(wires).toContain(['H1:IN1', 'U1:2'].sort().join('--'))
    expect(wires).toContain(['H1:IN2', 'U1:4'].sort().join('--'))
    expect(wires).toContain(['H1:IN3', 'U1:5'].sort().join('--'))
    expect(wires).toContain(['H1:IN4', 'U1:18'].sort().join('--'))
    expect(wires.some((w) => /^U1:.*--U1:/.test(w))).toBe(false)
    expect(wires.some((w) => /^H1:.*--H1:/.test(w))).toBe(false)
  })
})

describe('expandNetConnections', () => {
  it('drops VCC pins from a GND-dominated net', () => {
    const wires = expandNetConnections('GND', [
      { componentId: 'U1', pinId: 'GND', endpoint: 'U1:GND', pinHint: 'GND' },
      { componentId: 'H1', pinId: 'GND', endpoint: 'H1:GND', pinHint: 'GND' },
      { componentId: 'BATT1', pinId: 'VCC', endpoint: 'BATT1:VCC', pinHint: 'VCC' },
    ])
    expect(wires.some((w) => w[0].includes('BATT1') || w[1].includes('BATT1'))).toBe(false)
    expect(wires).toEqual([['U1:GND', 'H1:GND', 'black', []]])
  })

  it('zips motor outputs to motor terminals', () => {
    const wires = expandNetConnections('MOTOR_L', [
      { componentId: 'H1', pinId: 'OUT1', endpoint: 'H1:OUT1', pinHint: 'OUT1' },
      { componentId: 'H1', pinId: 'OUT2', endpoint: 'H1:OUT2', pinHint: 'OUT2' },
      { componentId: 'M1', pinId: 'P1', endpoint: 'M1:P1', pinHint: 'P1' },
      { componentId: 'M1', pinId: 'P2', endpoint: 'M1:P2', pinHint: 'P2' },
    ])
    const keys = wires.map(([a, b]) => [a, b].sort().join('--'))
    expect(keys).toContain('H1:OUT1--M1:P1')
    expect(keys).toContain('H1:OUT2--M1:P2')
    expect(keys).not.toContain('H1:OUT1--H1:OUT2')
    expect(keys).not.toContain('M1:P1--M1:P2')
  })
})

describe('pushbutton ground return', () => {
  it('wires signal to 1.l and GND return to 2.l (other contact)', () => {
    const circuit = makeTestCircuit({
      components: [
        {
          id: 'U1',
          label: 'ESP32',
          type: 'MICROCONTROLLER',
          pins: [
            { id: 'D26', label: 'D26', type: 'BIDIRECTIONAL' },
            { id: 'GND', label: 'GND', type: 'POWER_IN' },
          ],
        },
        {
          id: 'SW1',
          label: 'Stop_Button',
          type: 'SWITCH',
          pins: [
            { id: '1', label: '1', type: 'PASSIVE' },
            { id: '2', label: '2', type: 'PASSIVE' },
          ],
        },
      ],
      nets: [
        {
          name: 'GND_BUS',
          connections: [
            { component_id: 'U1', pin_id: 'GND' },
            { component_id: 'SW1', pin_id: '2' },
          ],
        },
        {
          name: 'STOP_BTN_SIGNAL',
          connections: [
            { component_id: 'U1', pin_id: 'D26' },
            { component_id: 'SW1', pin_id: '1' },
          ],
        },
      ],
    })
    const { diagram } = circuitToDiagram(circuit)
    const wires = diagram.connections.map(([a, b]) => [a, b].sort().join('--'))
    expect(wires).toContain(['SW1:1.l', 'U1:26'].sort().join('--'))
    expect(wires).toContain(['SW1:2.l', 'U1:GND.1'].sort().join('--'))
    // Must NOT use 1.r as return (same contact as 1.l)
    expect(wires.some((w) => w.includes('SW1:1.r'))).toBe(false)
  })

  it('auto-adds GND on contact 2 if only contact 1 was exported', () => {
    const parts = [
      { type: 'board-esp32-devkit-c-v4', id: 'U1' },
      { type: 'wokwi-pushbutton', id: 'SW1' },
    ]
    const connections: WokwiConnection[] = [
      ['U1:26', 'SW1:1.l', 'green', []],
      ['U1:GND.1', 'H1:GND', 'black', []],
    ]
    const fixed = ensurePushbuttonGroundReturns(parts, connections)
    const keys = fixed.map(([a, b]) => [a, b].sort().join('--'))
    expect(keys).toContain('SW1:1.l--U1:26')
    expect(keys).toContain('SW1:2.l--U1:GND.1')
  })
})
