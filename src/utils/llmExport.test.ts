import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTestCircuit } from '../test/fixtures'
import {
  buildLlmCircuitMarkdown,
  buildLlmExportFromMemory,
  downloadLlmCircuitMarkdown,
} from './llmExport'

describe('buildLlmCircuitMarkdown', () => {
  it('describes components, pin map and net endpoints', () => {
    const md = buildLlmCircuitMarkdown(makeTestCircuit())
    expect(md).toContain('# CircuitLLM export — Test Circuit')
    expect(md).toContain('- U1: MCU [MICROCONTROLLER]')
    expect(md).toContain('- R1: Pull-up [RESISTOR], value=10k')
    expect(md).toContain('#### U1 (MCU)')
    expect(md).toContain('- D0 "D0" [OUTPUT] → SIGNAL')
    expect(md).toContain('- GND "GND" [POWER_IN] → (unconnected)')
    expect(md).toContain('### Net `SIGNAL`')
    expect(md).toContain('Electrically common: U1.D0 ↔ R1.A')
    expect(md).toContain('- U1.D0 (OUTPUT)')
    expect(md).toContain('- R1.A "1" (PASSIVE)')
    expect(md).toContain('## Firmware targets')
    expect(md).toContain('- U1: MCU [MICROCONTROLLER]')
    expect(md).toContain('```json')
  })

  it('includes goal and memory when provided', () => {
    const md = buildLlmCircuitMarkdown(makeTestCircuit(), {
      goal: 'Robot con Arduino',
      memorySummary: '- Usa encoder\n- Switch anteriori',
    })
    expect(md).toContain('## Goal / intent')
    expect(md).toContain('Robot con Arduino')
    expect(md).toContain('## Project memory (compact)')
    expect(md).toContain('Usa encoder')
  })

  it('buildLlmExportFromMemory maps ProjectMemory fields', () => {
    const md = buildLlmExportFromMemory(makeTestCircuit(), {
      goal: 'From memory',
      summary: '- summary line',
      compactedAt: '2026-01-01T00:00:00.000Z',
      sourceFingerprint: 'fp',
    })
    expect(md).toContain('From memory')
    expect(md).toContain('summary line')
  })
})

describe('downloadLlmCircuitMarkdown', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('downloads a sanitized .llm.md file', () => {
    const click = vi.fn()
    const remove = vi.fn()
    const append = vi.fn()
    const revoke = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:llm')
    const anchor = { href: '', download: '', click, remove }

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: revoke })
    vi.stubGlobal(
      'Blob',
      class {
        constructor(
          public parts: unknown[],
          public options?: unknown,
        ) {}
      },
    )
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { append, appendChild: append },
    })

    downloadLlmCircuitMarkdown(makeTestCircuit({ circuit_name: 'Robot: R4' }), {
      goal: 'demo',
    })

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('Robot__R4.llm.md')
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:llm')
  })
})
