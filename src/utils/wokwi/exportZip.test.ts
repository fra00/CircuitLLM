import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { makeTestCircuit } from '../../test/fixtures'
import type { LlmConfig } from '../../types/llm'
import { buildStubChip, canCallLlm } from './generateChip'
import { buildWokwiZipBlob, toSafeWokwiZipName } from './exportZip'
import { SAMPLE_CIRCUIT } from '../../data/sampleCircuit'

const stubConfig: LlmConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o-mini',
}

describe('toSafeWokwiZipName', () => {
  it('sanitizes the circuit name', () => {
    expect(toSafeWokwiZipName('Robot: Controller?/v1')).toBe('robot-controller-v1-wokwi.zip')
    expect(toSafeWokwiZipName('   ')).toBe('circuit-wokwi.zip')
  })
})

describe('canCallLlm / buildStubChip', () => {
  it('requires API key for cloud providers', () => {
    expect(canCallLlm(stubConfig)).toBe(false)
    expect(canCallLlm({ ...stubConfig, apiKey: 'sk-test' })).toBe(true)
    expect(
      canCallLlm({
        provider: 'lmstudio',
        apiKey: '',
        baseUrl: '',
        model: 'local',
      }),
    ).toBe(true)
  })

  it('builds a pinout stub with chip_init', () => {
    const stub = buildStubChip({
      slug: 'dc-motor',
      label: 'DC Motor',
      type: 'MOTOR',
      pins: [
        { id: 'PWR1', label: '+', type: 'POWER_IN' },
        { id: 'PWR2', label: '-', type: 'POWER_IN' },
      ],
    })
    expect(stub.fromLlm).toBe(false)
    expect(stub.chipJson.pins).toEqual(['PWR1', 'PWR2'])
    expect(stub.chipC).toContain('chip_init')
    expect(stub.chipC).toContain('PWR1')
  })
})

describe('buildWokwiZipBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('includes diagram.json and custom chip stubs without LLM key', async () => {
    const { blob, fileName, warnings } = await buildWokwiZipBlob(
      SAMPLE_CIRCUIT,
      {},
      stubConfig,
    )
    expect(fileName).toBe('robot-controller-wokwi.zip')
    expect(blob.size).toBeGreaterThan(100)
    expect(warnings.some((w) => /API key|LLM/i.test(w))).toBe(true)

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('diagram.json')).toBeTruthy()
    expect(zip.file('sketch.ino')).toBeTruthy()
    expect(zip.file('README.md')).toBeTruthy()
    const chipFiles = Object.keys(zip.files).filter((n) => n.endsWith('.chip.json'))
    expect(chipFiles.length).toBeGreaterThan(0)
  })

  it('works on the minimal fixture', async () => {
    const circuit = makeTestCircuit({
      circuit_name: 'Mini',
      components: [
        {
          id: 'U1',
          label: 'Arduino Nano',
          type: 'MICROCONTROLLER',
          pins: [
            { id: 'D2', label: 'D2', type: 'OUTPUT' },
            { id: 'GND', label: 'GND', type: 'POWER_IN' },
          ],
        },
        {
          id: 'R1',
          label: 'R',
          type: 'RESISTOR',
          value: '1k',
          pins: [
            { id: 'A', label: '1', type: 'PASSIVE' },
            { id: 'B', label: '2', type: 'PASSIVE' },
          ],
        },
      ],
      nets: [
        {
          name: 'SIG',
          connections: [
            { component_id: 'U1', pin_id: 'D2' },
            { component_id: 'R1', pin_id: 'A' },
          ],
        },
      ],
    })
    const { blob, warnings } = await buildWokwiZipBlob(circuit, {}, {
      provider: 'lmstudio',
      apiKey: '',
      baseUrl: '',
      model: 'local',
    })
    // No custom chips → no LLM warning required
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    const diagram = JSON.parse(await zip.file('diagram.json')!.async('string')) as {
      parts: Array<{ type: string }>
      connections: unknown[]
    }
    expect(diagram.parts.some((p) => p.type === 'wokwi-arduino-nano')).toBe(true)
    expect(diagram.parts.some((p) => p.type === 'wokwi-resistor')).toBe(true)
    expect(diagram.connections.length).toBe(1)
    expect(warnings.filter((w) => /custom chip/i.test(w))).toHaveLength(0)
  })
})
