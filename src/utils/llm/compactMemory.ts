import type { LlmConfig } from '../../types/llm'
import type { SessionTurn } from '../../types/projectMemory'
import { callLlmText, type LlmMessage } from './client'

const COMPACTION_SYSTEM = `Sei un assistente che compatta la memoria di un progetto di schema elettrico.
Produci SOLO una lista di bullet point (8-15 righe max) in italiano, tono tecnico conciso.
Regole:
- Mantieni vincoli e decisioni ancora rilevanti per future modifiche allo schema.
- Se ci sono contraddizioni, la informazione più recente vince.
- NON elencare topologia pin-per-pin (è già nel circuito JSON).
- Includi intent originale, scelte progettuali, valori importanti, esclusioni esplicite.
- Output: solo bullet list, nessun markdown extra, nessun JSON.`

export interface FullCompactionInput {
  goal: string
  sessionTurns: SessionTurn[]
  pendingDeltas: string[]
  circuitName: string
}

export interface IncrementalCompactionInput {
  goal: string
  previousSummary: string
  sessionTurns: SessionTurn[]
  pendingDeltas: string[]
  circuitName: string
}

function formatTurns(turns: SessionTurn[]): string {
  if (turns.length === 0) return '(nessun prompt utente registrato)'
  return turns.map((t) => `- [${new Date(t.at).toISOString()}] ${t.text}`).join('\n')
}

function formatDeltas(deltas: string[]): string {
  if (deltas.length === 0) return '(nessuna modifica canvas pending)'
  return deltas.map((d) => `- ${d}`).join('\n')
}

function buildFullUserPrompt(input: FullCompactionInput): string {
  return `Compatta la memoria del progetto "${input.circuitName}".

OBIETTIVO INIZIALE:
${input.goal || '(non specificato)'}

PROMPT UTENTE DELLA SESSIONE:
${formatTurns(input.sessionTurns)}

MODIFICHE CANVAS PENDING (non ancora compattate):
${formatDeltas(input.pendingDeltas)}

Produci la memoria compatta aggiornata.`
}

function buildIncrementalUserPrompt(input: IncrementalCompactionInput): string {
  return `Aggiorna la memoria compatta del progetto "${input.circuitName}".

OBIETTIVO INIZIALE:
${input.goal || '(non specificato)'}

MEMORIA COMPATTA PRECEDENTE:
${input.previousSummary}

NUOVI PROMPT UTENTE (dall'ultima compaction):
${formatTurns(input.sessionTurns)}

NUOVE MODIFICHE CANVAS PENDING:
${formatDeltas(input.pendingDeltas)}

Integra solo le novità nella memoria precedente. Risolvi contraddizioni a favore delle informazioni più recenti.`
}

function compactionMessages(userContent: string): LlmMessage[] {
  return [
    { role: 'system', content: COMPACTION_SYSTEM },
    { role: 'user', content: userContent },
  ]
}

export async function compactMemoryFull(
  config: LlmConfig,
  input: FullCompactionInput,
): Promise<string> {
  const text = await callLlmText(config, compactionMessages(buildFullUserPrompt(input)))
  return text.trim()
}

export async function compactMemoryIncremental(
  config: LlmConfig,
  input: IncrementalCompactionInput,
): Promise<string> {
  const text = await callLlmText(
    config,
    compactionMessages(buildIncrementalUserPrompt(input)),
  )
  return text.trim()
}
