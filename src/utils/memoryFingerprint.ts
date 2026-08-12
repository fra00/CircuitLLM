import type { Circuit } from '../types/circuit'
import type { DeltaNotification } from '../types/canvas'
import type { SessionTurn } from '../types/projectMemory'

export interface FingerprintInput {
  goal: string
  sessionTurns: SessionTurn[]
  notifications: DeltaNotification[]
  circuit: Circuit
}

/** Deterministic fingerprint to decide whether memory needs re-compaction */
export function computeMemoryFingerprint(input: FingerprintInput): string {
  const lastNotifTs =
    input.notifications.length > 0
      ? input.notifications[input.notifications.length - 1].timestamp
      : 0

  const payload = JSON.stringify({
    goal: input.goal,
    turns: input.sessionTurns.map((t) => ({ text: t.text, at: t.at })),
    notifCount: input.notifications.length,
    lastNotifTs,
    circuitName: input.circuit.circuit_name,
    componentCount: input.circuit.components.length,
    netCount: input.circuit.nets.length,
  })

  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0
  }
  return `fp_${Math.abs(hash).toString(36)}`
}
