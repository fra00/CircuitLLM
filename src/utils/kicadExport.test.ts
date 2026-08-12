import { describe, expect, it } from 'vitest'
import { buildKiCadNetlistXml } from './kicadExport'
import { makeTestCircuit } from '../test/fixtures'

describe('buildKiCadNetlistXml', () => {
  it('produces KiCad export XML with components and nets', () => {
    const xml = buildKiCadNetlistXml(makeTestCircuit())
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<export version="E">')
    expect(xml).toContain('<comp ref="R1">')
    expect(xml).toContain('<libsource lib="Device" part="Unknown"/>')
    expect(xml).toContain('<net code="1" name="SIGNAL">')
    expect(xml).toContain('<node ref="U1" pin="D0"/>')
  })

  it('escapes XML special characters', () => {
    const xml = buildKiCadNetlistXml(
      makeTestCircuit({
        circuit_name: 'Test & Demo <v1>',
        components: [
          {
            id: 'R1',
            label: 'Pull "up"',
            type: 'RESISTOR',
            value: '10k',
            pins: [
              { id: 'A', label: '1', type: 'PASSIVE' },
              { id: 'B', label: '2', type: 'PASSIVE' },
            ],
          },
        ],
        nets: [],
      }),
    )
    expect(xml).toContain('Test &amp; Demo &lt;v1&gt;')
    expect(xml).toContain('Pull &quot;up&quot;')
  })

  it('uses kicad_symbol lib:part when provided', () => {
    const xml = buildKiCadNetlistXml(
      makeTestCircuit({
        components: [
          {
            id: 'R1',
            label: 'R',
            type: 'RESISTOR',
            kicad_symbol: 'Device:R',
            pins: [
              { id: 'A', label: '1', type: 'PASSIVE' },
              { id: 'B', label: '2', type: 'PASSIVE' },
            ],
          },
        ],
        nets: [],
      }),
    )
    expect(xml).toContain('<libsource lib="Device" part="R"/>')
  })
})
