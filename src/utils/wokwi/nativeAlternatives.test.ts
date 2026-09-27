import { describe, expect, it } from 'vitest'
import { makeTestCircuit } from '../../test/fixtures'
import {
  analyzeCircuitChoices,
  analyzeWokwiComponent,
  pendingWokwiChoices,
  resolveChoice,
} from './nativeAlternatives'

describe('analyzeWokwiComponent', () => {
  it('offers a choice for buzzer (native + custom)', () => {
    const analysis = analyzeWokwiComponent({
      id: 'BZ1',
      label: 'Buzzer',
      type: 'OTHER',
      value: 'Active_Buzzer',
      pins: [
        { id: 'POS', label: 'POS', type: 'PASSIVE' },
        { id: 'NEG', label: 'NEG', type: 'PASSIVE' },
      ],
    })
    expect(analysis.native?.partType).toBe('wokwi-buzzer')
    expect(analysis.custom?.slug).toBeTruthy()
    expect(analysis.autoChoice).toBeNull()
  })

  it('auto-picks native for resistors', () => {
    const analysis = analyzeWokwiComponent({
      id: 'R1',
      label: 'R',
      type: 'RESISTOR',
      value: '10k',
      pins: [
        { id: 'A', label: '1', type: 'PASSIVE' },
        { id: 'B', label: '2', type: 'PASSIVE' },
      ],
    })
    expect(analysis.autoChoice).toBe('native')
    expect(analysis.custom).toBeNull()
  })

  it('auto-picks custom for motors', () => {
    const analysis = analyzeWokwiComponent({
      id: 'M1',
      label: 'Motor_Left',
      type: 'MOTOR',
      pins: [
        { id: 'P1', label: 'P1', type: 'PASSIVE' },
        { id: 'P2', label: 'P2', type: 'PASSIVE' },
      ],
    })
    expect(analysis.autoChoice).toBe('custom')
    expect(analysis.native).toBeNull()
  })
})

describe('pendingWokwiChoices / resolveChoice', () => {
  it('skips items already saved in preferences', () => {
    const circuit = makeTestCircuit({
      components: [
        {
          id: 'BZ1',
          label: 'Buzzer',
          type: 'OTHER',
          pins: [
            { id: 'POS', label: 'POS', type: 'PASSIVE' },
            { id: 'NEG', label: 'NEG', type: 'PASSIVE' },
          ],
        },
        {
          id: 'DISP1',
          label: '7_Segment_Display',
          type: 'OTHER',
          value: 'TM1637',
          pins: [
            { id: 'CLK', label: 'CLK', type: 'INPUT' },
            { id: 'DIO', label: 'DIO', type: 'BIDIRECTIONAL' },
            { id: 'VCC', label: 'VCC', type: 'POWER_IN' },
            { id: 'GND', label: 'GND', type: 'POWER_IN' },
          ],
        },
      ],
      nets: [],
    })
    const analyses = analyzeCircuitChoices(circuit.components)
    const pendingAll = pendingWokwiChoices(analyses, {})
    expect(pendingAll.length).toBe(2)

    const buzzerKey = pendingAll.find((a) => a.label.includes('Buzzer'))!.preferenceKey
    const pendingSaved = pendingWokwiChoices(analyses, { [buzzerKey]: 'native' })
    expect(pendingSaved).toHaveLength(1)
    expect(pendingSaved[0].label).toContain('Segment')

    const buzzer = analyses.find((a) => a.preferenceKey === buzzerKey)!
    expect(resolveChoice(buzzer, { [buzzerKey]: 'custom' })).toBe('custom')
    expect(resolveChoice(buzzer, { [buzzerKey]: 'native' })).toBe('native')
  })
})
