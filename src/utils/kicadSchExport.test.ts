import { describe, expect, it } from 'vitest'
import { makeTestCircuit } from '../test/fixtures'
import { buildKicadSchematic } from './kicadSchExport'

describe('buildKicadSchematic', () => {
  it('produces a minimal kicad_sch with symbols, wires and net labels', async () => {
    const sch = await buildKicadSchematic(makeTestCircuit())
    expect(sch).toContain('(kicad_sch')
    expect(sch).toContain('(generator "CircuitLLM")')
    expect(sch).toContain('(title "Test Circuit")')
    expect(sch).toContain('(lib_symbols')
    expect(sch).toContain('CircuitLLM:U1')
    expect(sch).toContain('CircuitLLM:R1')
    expect(sch).toContain('(property "Reference" "U1"')
    expect(sch).toContain('(property "Reference" "R1"')
    expect(sch).toContain('(wire (pts')
    expect(sch).toContain('(label "SIGNAL"')
    expect(sch).toContain('(property "Footprint" ""')
  }, 15_000)

  it('embeds one pin per logical pin', async () => {
    const sch = await buildKicadSchematic(makeTestCircuit())
    expect(sch).toContain('(name "D0"')
    expect(sch).toContain('(name "A"')
    expect(sch).toContain('(name "GND"')
  }, 15_000)
})
