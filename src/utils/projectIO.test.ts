import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PROJECT_FILE_VERSION,
  PROJECT_KIND,
  buildProjectFile,
  downloadProjectFile,
  parseProjectFile,
  readProjectFile,
} from './projectIO'
import { makeTestCircuit } from '../test/fixtures'

describe('buildProjectFile', () => {
  it('builds v2 project wrapper', () => {
    const circuit = makeTestCircuit()
    const project = buildProjectFile(circuit)
    expect(project.version).toBe(PROJECT_FILE_VERSION)
    expect(project.kind).toBe(PROJECT_KIND)
    expect(project.circuit).toBe(circuit)
    expect(project.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('includes memory when provided', () => {
    const memory = {
      goal: 'Robot',
      summary: '- vincolo test',
      compactedAt: '2026-01-01T00:00:00.000Z',
      sourceFingerprint: 'fp_abc',
    }
    const project = buildProjectFile(makeTestCircuit(), memory)
    expect(project.memory).toEqual(memory)
  })
})

describe('parseProjectFile', () => {
  it('parses v2 project with memory', () => {
    const circuit = makeTestCircuit()
    const raw = JSON.stringify({
      version: 2,
      kind: PROJECT_KIND,
      savedAt: '2026-01-01T00:00:00.000Z',
      circuit,
      memory: {
        goal: 'Test goal',
        summary: 'Summary line',
        compactedAt: '2026-01-01T00:00:00.000Z',
        sourceFingerprint: 'fp_test',
      },
    })
    const loaded = parseProjectFile(raw)
    expect(loaded.circuit.circuit_name).toBe('Test Circuit')
    expect(loaded.memory?.goal).toBe('Test goal')
    expect(loaded.memory?.summary).toBe('Summary line')
  })

  it('parses raw circuit object (legacy)', () => {
    const circuit = makeTestCircuit()
    const loaded = parseProjectFile(JSON.stringify(circuit))
    expect(loaded.circuit.components).toHaveLength(2)
    expect(loaded.memory).toBeUndefined()
  })

  it('parses v1-style wrapper with circuit field', () => {
    const circuit = makeTestCircuit()
    const loaded = parseProjectFile(JSON.stringify({ version: 1, circuit }))
    expect(loaded.circuit.circuit_name).toBe('Test Circuit')
  })

  it('ignores memory block without summary', () => {
    const circuit = makeTestCircuit()
    const raw = JSON.stringify({
      version: 2,
      kind: PROJECT_KIND,
      circuit,
      memory: { goal: 'x', summary: '  ', compactedAt: '', sourceFingerprint: '' },
    })
    const loaded = parseProjectFile(raw)
    expect(loaded.memory).toBeUndefined()
  })

  it('throws on invalid JSON', () => {
    expect(() => parseProjectFile('{not json')).toThrow(/JSON progetto non valido/)
  })

  it('throws when root JSON is not an object', () => {
    expect(() => parseProjectFile('[]')).toThrow(/non è un oggetto JSON/)
  })
})

describe('downloadProjectFile / readProjectFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('downloadProjectFile creates a sanitized filename and triggers click', () => {
    const click = vi.fn()
    const remove = vi.fn()
    const append = vi.fn()
    const revoke = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:test')
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

    downloadProjectFile(makeTestCircuit({ circuit_name: 'Bad:Name?/File' }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('Bad_Name__File.circuitllm.json')
    expect(append).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:test')
  })

  it('readProjectFile parses a File text payload', async () => {
    const circuit = makeTestCircuit()
    const file = {
      text: async () => JSON.stringify(buildProjectFile(circuit)),
    } as File
    const loaded = await readProjectFile(file)
    expect(loaded.circuit.circuit_name).toBe('Test Circuit')
  })
})
