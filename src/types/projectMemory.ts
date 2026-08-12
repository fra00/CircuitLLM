/** Compact project memory persisted in .circuitllm.json when "Includi contesto" is ON */
export interface ProjectMemory {
  goal: string
  summary: string
  compactedAt: string
  sourceFingerprint: string
}

/** User prompt recorded during the current session (for compaction input) */
export interface SessionTurn {
  role: 'user'
  text: string
  at: number
}

export const MAX_SESSION_TURNS = 20
