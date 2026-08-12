import type { Circuit, Component, Net, Pin, ComponentType, PinType } from '../../types/circuit'

export class CircuitValidationError extends Error {}

const VALID_COMPONENT_TYPES: ComponentType[] = [
  'MICROCONTROLLER', 'RESISTOR', 'CAPACITOR', 'INDUCTOR', 'DIODE', 'LED',
  'TRANSISTOR', 'OPAMP', 'SENSOR', 'MOTOR', 'CONNECTOR', 'POWER_SUPPLY',
  'POWER_RAIL', 'SWITCH', 'OTHER',
]

const VALID_PIN_TYPES: PinType[] = [
  'INPUT', 'OUTPUT', 'BIDIRECTIONAL', 'POWER_IN', 'POWER_OUT', 'PASSIVE', 'NO_CONNECT',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && VALID_COMPONENT_TYPES.includes(value as ComponentType)
}

function isPinType(value: unknown): value is PinType {
  return typeof value === 'string' && VALID_PIN_TYPES.includes(value as PinType)
}

/**
 * Tolerant extraction of the first JSON object found in the LLM text.
 *
 * Small local models (LM Studio etc.) frequently emit JSON that is not
 * strictly valid: trailing commas, missing commas between array elements,
 * single-quoted strings, unquoted keys/values. The direct parse is
 * attempted first; on failure a conservative repair chain runs (structural
 * fixes are applied on a copy with string literals masked so the regexes
 * never touch string contents).
 */
export function extractJson(text: string): unknown {
  const stripped = text
    .replace(/```(?:json)?/gi, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new CircuitValidationError('Nessun oggetto JSON trovato nella risposta dell\'LLM.')
  }
  const slice = stripped.slice(start, end + 1)

  const candidates = [slice, repairJson(slice)]
  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch (error) {
      lastError = error
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new CircuitValidationError(
    `JSON non valido nella risposta: ${message}.${jsonErrorContext(slice, message)}`,
  )
}

function jsonErrorContext(
  slice: string,
  message: string,
): string {
  const match = /\bat position (\d+)(?: \(line (\d+) column (\d+)\))?/.exec(message)
  if (match) {
    const pos = Number(match[1])
    if (pos >= 0 && pos < slice.length) {
      const from = Math.max(0, pos - 60)
      const to = Math.min(slice.length, pos + 60)
      return `\nContesto attorno all'errore: ...${slice.slice(from, to)}...`
    }
  }
  return `\nInizio risposta: ${slice.slice(0, 140)}...`
}

function findClosingQuote(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
      continue
    }
    if (text[i] === "'") return i
  }
  return -1
}

/** Converts plausible single-quoted JSON strings to double-quoted ones */
function convertSingleQuotes(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch !== "'" || (i > 0 && /[A-Za-z0-9_]/.test(text[i - 1]))) {
      out += ch
      i++
      continue
    }
    const end = findClosingQuote(text, i + 1)
    if (end === -1) {
      out += ch
      i++
      continue
    }
    const content = text.slice(i + 1, end)
    if (content.includes("'") || content.includes(':')) {
      out += ch
      i++
      continue
    }
    out += `"${content.replace(/"/g, '\\"')}"`
    i = end + 1
  }
  return out
}

/** Replaces every "..." literal (keys, strings) with a private-use token */
function maskStringLiterals(text: string): { masked: string; literals: string[] } {
  const literals: string[] = []
  const masked = text.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    const token = `\u0000M${literals.length}\u0000`
    literals.push(match)
    return token
  })
  return { masked, literals }
}

function unmaskStringLiterals(masked: string, literals: string[]): string {
  // NUL-delimited private tokens cannot collide with real response content
  // eslint-disable-next-line no-control-regex
  return masked.replace(new RegExp('\\u0000M(\\d+)\\u0000', 'g'), (_, index) => literals[Number(index)] ?? '')
}

/** Inserts commas between values/closures that the model forgot */
function insertMissingCommas(masked: string): string {
  const token = '\\u0000M\\d+\\u0000'
  const valueOrCloser = `([}\\]]|${token})`
  const valueOrOpener = `(?=[\\[{]|${token}|[A-Za-z_$])`
  return masked
    .replace(new RegExp(`}\\s*(?=[\\[{])`, 'g'), '}, ')
    .replace(new RegExp(`\\]\\s*(?=[\\[{])`, 'g'), '], ')
    .replace(new RegExp(`${valueOrCloser}\\s*${valueOrOpener}`, 'g'), '$1, ')
}

/**
 * Repair chain for common LLM JSON slip-ups. Runs on a copy: if the repaired
 * text still fails to parse, the original error is reported instead, so the
 * user never receives silently corrupted data.
 */
export function repairJson(text: string): string {
  let clean = text.replace(/^\uFEFF/, '')
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g'), '')
  clean = convertSingleQuotes(clean)

  const { masked, literals } = maskStringLiterals(clean)
  let fixed = masked
  fixed = fixed.replace(/,\s*(?=[}\]])/g, '')
  fixed = insertMissingCommas(fixed)
  // bare values like `: 4.7k` / `: GND_BUS`
  fixed = fixed.replace(
    /(:\s*)([\d.]*[A-Za-z_][\w.]*)(?=\s*[,}\]])/g,
    '$1"$2"',
  )
  // unquoted keys like `{ type: "LED" }`
  fixed = fixed.replace(
    /([{,\s])([A-Za-z_$][\w$-]*)(\s*:)/g,
    '$1"$2"$3',
  )
  return unmaskStringLiterals(fixed, literals)
}

function normalizePins(raw: unknown): Pin[] {
  const list = Array.isArray(raw) ? raw : []
  if (list.length === 0) {
    return [
      { id: '1', label: '1', type: 'PASSIVE' },
      { id: '2', label: '2', type: 'PASSIVE' },
    ]
  }
  const seen = new Set<string>()
  return list.map((item, index) => {
    const record = isRecord(item) ? item : {}
    let id = asString(record.id, `P${index + 1}`)
    if (seen.has(id)) id = `${id}_${index + 1}`
    seen.add(id)
    return {
      id,
      label: asString(record.label, id),
      type: isPinType(record.type) ? record.type : 'PASSIVE',
    }
  })
}

function normalizeComponent(raw: unknown, index: number): Component {
  const record = isRecord(raw) ? raw : {}
  return {
    id: asString(record.id, `C${index + 1}`),
    label: asString(record.label, `Componente ${index + 1}`),
    type: isComponentType(record.type) ? record.type : 'OTHER',
    value: typeof record.value === 'string' && record.value !== '' ? record.value : undefined,
    kicad_symbol:
      typeof record.kicad_symbol === 'string' && record.kicad_symbol !== ''
        ? record.kicad_symbol
        : undefined,
    pins: normalizePins(record.pins),
  }
}

function normalizeNet(raw: unknown, circuit: Circuit, index: number): Net | null {
  const record = isRecord(raw) ? raw : {}
  const name = asString(record.name, `NET_${index + 1}`)
  const list = Array.isArray(record.connections) ? record.connections : []
  const seen = new Set<string>()
  const connections = list
    .map((item) => {
      if (!isRecord(item)) return null
      const componentId = asString(item.component_id, '')
      const pinId = asString(item.pin_id, '')
      const component = circuit.components.find((c) => c.id === componentId)
      if (!component || !component.pins.some((p) => p.id === pinId)) return null
      const key = `${componentId}:${pinId}`
      if (seen.has(key)) return null
      seen.add(key)
      return { component_id: componentId, pin_id: pinId }
    })
    .filter((c): c is { component_id: string; pin_id: string } => c !== null)

  if (connections.length < 2) return null
  return { name, connections }
}

/** Validates and normalizes arbitrary LLM output into a strict Circuit */
export function normalizeCircuit(raw: unknown, fallbackName = 'Generated Circuit'): Circuit {
  if (!isRecord(raw)) {
    throw new CircuitValidationError('La risposta non è un oggetto JSON.')
  }

  const components = Array.isArray(raw.components)
    ? raw.components.map(normalizeComponent)
    : []

  if (components.length === 0) {
    throw new CircuitValidationError('La risposta non contiene componenti.')
  }

  const seenIds = new Set<string>()
  for (const component of components) {
    if (seenIds.has(component.id)) {
      throw new CircuitValidationError(`Component id duplicato: ${component.id}.`)
    }
    seenIds.add(component.id)
  }

  const nets = Array.isArray(raw.nets)
    ? raw.nets
        .map((net, i) => normalizeNet(net, { components } as Circuit, i))
        .filter((net): net is Net => net !== null)
    : []

  return {
    circuit_name: asString(
      typeof raw.circuit_name === 'string' ? raw.circuit_name : '',
      fallbackName,
    ),
    components,
    nets,
  }
}