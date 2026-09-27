import JSZip from 'jszip'
import type { Circuit } from '../../types/circuit'
import type { LlmConfig } from '../../types/llm'
import { runElkLayout } from '../elkLayout'
import { circuitToDiagram } from './circuitToDiagram'
import { canCallLlm, generateCustomChip } from './generateChip'
import type { WokwiPartChoice } from './types'
import type { CustomChipFiles, PositionMap } from './types'

export interface ExportProgress {
  phase: 'mapping' | 'chips' | 'zipping' | 'done' | 'error'
  chipIndex?: number
  chipTotal?: number
  message?: string
}

export interface ExportResult {
  warnings: string[]
  fileName: string
}

export function toSafeWokwiZipName(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'circuit'
  return `${base}-wokwi.zip`
}

function buildReadme(
  circuitName: string,
  chips: CustomChipFiles[],
  warnings: string[],
): string {
  const chipList =
    chips.length === 0
      ? '- (nessun custom chip)'
      : chips
          .map(
            (c) =>
              `- \`${c.slug}.chip.json\` + \`${c.slug}.chip.c\`${c.fromLlm ? ' (LLM)' : ' (stub)'}`,
          )
          .join('\n')

  const warnBlock =
    warnings.length === 0
      ? ''
      : `\n## Avvisi\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n`

  return `# ${circuitName} — export Wokwi

Generato da **CircuitLLM**.

## Contenuto

- \`diagram.json\` — parti e collegamenti
- \`sketch.ino\` — stub Arduino (se presente un MCU nativo)
${chipList}
${warnBlock}
## Come aprire su Wokwi

1. Crea un nuovo progetto su [wokwi.com](https://wokwi.com) (o apri VS Code + estensione Wokwi).
2. Sostituisci / aggiungi \`diagram.json\` con quello di questo ZIP.
3. Per ogni custom chip: nel diagram editor usa **+ → Custom Chip**, oppure copia i file \`*.chip.json\` e \`*.chip.c\` nel progetto.
   Wokwi compilerà il C in WASM automaticamente.
4. Se c'è uno sketch, incolla \`sketch.ino\` nell'editor Arduino.

I pin dei custom chip devono coincidere con quelli usati in \`diagram.json\` (\`chip-<slug>\`).
`
}

function buildSketch(circuitName: string): string {
  return `// Stub sketch for "${circuitName}" — exported from CircuitLLM
void setup() {
  Serial.begin(115200);
}

void loop() {
  // TODO: your firmware
}
`
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Builds the Wokwi project ZIP contents without triggering a download.
 * Useful for tests.
 */
export async function buildWokwiZipBlob(
  circuit: Circuit,
  positions: PositionMap,
  config: LlmConfig,
  onProgress?: (progress: ExportProgress) => void,
  choices: Record<string, WokwiPartChoice> = {},
): Promise<{ blob: Blob; fileName: string; warnings: string[] }> {
  const warnings: string[] = []
  onProgress?.({ phase: 'mapping', message: 'Mapping parti Wokwi…' })

  const { diagram, pendingChips, hasNativeMcu } = circuitToDiagram(
    circuit,
    positions,
    choices,
  )

  if (pendingChips.length > 0 && !canCallLlm(config)) {
    warnings.push(
      'Provider LLM senza API key: i custom chip saranno stub pinout. Apri ⚙ → LLM settings.',
    )
  }

  const chips: CustomChipFiles[] = []
  for (let i = 0; i < pendingChips.length; i++) {
    const pending = pendingChips[i]
    onProgress?.({
      phase: 'chips',
      chipIndex: i + 1,
      chipTotal: pendingChips.length,
      message: `Generazione chip ${i + 1}/${pendingChips.length}: ${pending.slug}`,
    })
    const { files, warning } = await generateCustomChip(config, pending)
    chips.push(files)
    if (warning) warnings.push(warning)
  }

  onProgress?.({ phase: 'zipping', message: 'Creazione ZIP…' })

  const zip = new JSZip()
  zip.file('diagram.json', JSON.stringify(diagram, null, 2))
  if (hasNativeMcu) {
    zip.file('sketch.ino', buildSketch(circuit.circuit_name))
  }
  for (const chip of chips) {
    zip.file(`${chip.slug}.chip.json`, JSON.stringify(chip.chipJson, null, 2))
    zip.file(`${chip.slug}.chip.c`, chip.chipC)
  }
  zip.file('README.md', buildReadme(circuit.circuit_name, chips, warnings))

  const blob = await zip.generateAsync({ type: 'blob' })
  const fileName = toSafeWokwiZipName(circuit.circuit_name)
  return { blob, fileName, warnings }
}

/**
 * Full Wokwi export with explicit positions (e.g. from the live canvas).
 */
export async function exportWokwiZip(
  circuit: Circuit,
  positions: PositionMap,
  config: LlmConfig,
  onProgress?: (progress: ExportProgress) => void,
  choices: Record<string, WokwiPartChoice> = {},
): Promise<ExportResult> {
  const { blob, fileName, warnings } = await buildWokwiZipBlob(
    circuit,
    positions,
    config,
    onProgress,
    choices,
  )
  triggerDownload(blob, fileName)
  onProgress?.({ phase: 'done', message: `Scaricato ${fileName}` })
  return { warnings, fileName }
}

/**
 * Toolbar entry: layout via ELK (like KiCad .kicad_sch), then download ZIP.
 * Custom chips use the configured LLM when available, otherwise stubs.
 */
export async function downloadWokwiProject(
  circuit: Circuit,
  config: LlmConfig,
  onProgress?: (progress: ExportProgress) => void,
  choices: Record<string, WokwiPartChoice> = {},
): Promise<ExportResult> {
  onProgress?.({ phase: 'mapping', message: 'Layout ELK…' })
  let positions: PositionMap = {}
  try {
    const layout = await runElkLayout(circuit)
    positions = layout.positions
  } catch {
    // circuitToDiagram falls back to a grid when positions are missing
  }
  return exportWokwiZip(circuit, positions, config, onProgress, choices)
}
