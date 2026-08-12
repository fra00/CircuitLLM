import type { Circuit } from '../types/circuit'
import type { ProjectMemory } from '../types/projectMemory'
import { CircuitValidationError, normalizeCircuit } from './llm/validate'

export const PROJECT_FILE_VERSION = 2
export const PROJECT_KIND = 'circuitllm-project'

export interface CircuitProjectFile {
  version: number
  kind: typeof PROJECT_KIND
  savedAt: string
  circuit: Circuit
  memory?: ProjectMemory
}

export interface LoadedProject {
  circuit: Circuit
  memory?: ProjectMemory
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMemory(raw: unknown): ProjectMemory | undefined {
  if (!isRecord(raw)) return undefined
  const goal = typeof raw.goal === 'string' ? raw.goal : ''
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  const compactedAt = typeof raw.compactedAt === 'string' ? raw.compactedAt : ''
  const sourceFingerprint =
    typeof raw.sourceFingerprint === 'string' ? raw.sourceFingerprint : ''
  if (!summary) return undefined
  return { goal, summary, compactedAt, sourceFingerprint }
}

function toSafeFileName(name: string): string {
  const base = name.trim() || 'circuit'
  const forbidden = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const sanitized = [...base]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (forbidden.has(ch) || code <= 31) return '_'
      return ch
    })
    .join('')
  return sanitized.replace(/\s+/g, '_')
}

/** Builds a portable CircuitLLM project document from the current circuit. */
export function buildProjectFile(
  circuit: Circuit,
  memory?: ProjectMemory,
): CircuitProjectFile {
  const project: CircuitProjectFile = {
    version: PROJECT_FILE_VERSION,
    kind: PROJECT_KIND,
    savedAt: new Date().toISOString(),
    circuit,
  }
  if (memory) project.memory = memory
  return project
}

/**
 * Parses and validates a project JSON document.
 * Accepts v2 wrapper, v1 wrapper, or a raw Circuit object.
 */
export function parseProjectFile(rawText: string): LoadedProject {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CircuitValidationError(`JSON progetto non valido: ${message}`)
  }

  if (!isRecord(parsed)) {
    throw new CircuitValidationError('Il file di progetto non è un oggetto JSON.')
  }

  const circuitRaw =
    parsed.kind === PROJECT_KIND || isRecord(parsed.circuit)
      ? parsed.circuit
      : parsed

  const circuit = normalizeCircuit(circuitRaw, 'Loaded Circuit')
  const memory = parseMemory(parsed.memory)

  return { circuit, memory }
}

/** Downloads the current circuit as a `.circuitllm.json` project file. */
export function downloadProjectFile(circuit: Circuit, memory?: ProjectMemory): void {
  const project = buildProjectFile(circuit, memory)
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${toSafeFileName(circuit.circuit_name)}.circuitllm.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Reads a local project file and returns the normalized project. */
export async function readProjectFile(file: File): Promise<LoadedProject> {
  const text = await file.text()
  return parseProjectFile(text)
}
