import { create } from 'zustand'
import type { Circuit } from '../types/circuit'
import type { LlmConfig, LlmGenerationResult } from '../types/llm'
import type { ProjectMemory, SessionTurn } from '../types/projectMemory'
import { MAX_SESSION_TURNS } from '../types/projectMemory'
import { generateCircuit } from '../utils/llm/client'
import { compactMemoryFull, compactMemoryIncremental } from '../utils/llm/compactMemory'
import * as diff from '../utils/diff'
import { computeMemoryFingerprint } from '../utils/memoryFingerprint'
import { useCircuitStore } from './circuitStore'

const STORAGE_KEY = 'circuitllm.llm-config'

export const DEFAULT_CONFIG: LlmConfig = {
  provider: 'lmstudio',
  apiKey: '',
  baseUrl: '',
  model: 'llama-3.1-8b-instruct',
}

function loadPersistedConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<LlmConfig>) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export interface MemoryCompactionResult {
  memory: ProjectMemory
  skipped: boolean
}

interface LlmStoreState {
  config: LlmConfig
  busy: boolean
  result: LlmGenerationResult | null
  lastPrompt: string
  conversationActive: boolean
  memory: ProjectMemory | null
  sessionTurns: SessionTurn[]
  goal: string
  contextSaved: boolean
  lastCompactedFingerprint: string

  setConfig: (partial: Partial<LlmConfig>) => void
  generate: (description: string) => Promise<void>
  clearResult: () => void
  setConversationActive: (active: boolean) => void
  resetConversation: () => void
  loadMemory: (memory: ProjectMemory, circuit: Circuit) => void
  resetSessionMemory: () => void
  /** Compacts memory if needed; returns memory block for project save */
  prepareMemoryForSave: (circuit: Circuit) => Promise<MemoryCompactionResult>
  syncBaselineFingerprint: (circuit: Circuit) => void
}

function fingerprintFromState(
  goal: string,
  sessionTurns: SessionTurn[],
  circuit: Circuit,
): string {
  const notifications = useCircuitStore.getState().notifications
  return computeMemoryFingerprint({ goal, sessionTurns, notifications, circuit })
}

export const useLlmStore = create<LlmStoreState>((set, get) => ({
  config: loadPersistedConfig(),
  busy: false,
  result: null,
  lastPrompt: '',
  conversationActive: false,
  memory: null,
  sessionTurns: [],
  goal: '',
  contextSaved: false,
  lastCompactedFingerprint: '',

  setConfig: (partial) => {
    const config = { ...get().config, ...partial }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // ignore storage failures (private mode etc.)
    }
    set({ config })
  },

  generate: async (description) => {
    const { config, memory } = get()
    set({ busy: true, result: null, lastPrompt: description })

    const circuitStore = useCircuitStore.getState()
    const canvasContext = diff.buildDeltaContext(circuitStore.notifications)
    const currentCircuit = get().conversationActive ? circuitStore.circuit : undefined
    const result = await generateCircuit(
      config,
      description,
      canvasContext,
      currentCircuit,
      memory,
    )

    if (result.status === 'done' && result.circuit) {
      const circuit: Circuit = result.circuit
      useCircuitStore.getState().loadCircuit(circuit)
      useCircuitStore.getState().recordNotification(
        `[SYSTEM NOTIFICATION]: LLM ${currentCircuit ? 'updated' : 'generated'} circuit '${circuit.circuit_name}' with ${circuit.components.length} components and ${circuit.nets.length} nets from prompt: "${description}".`,
      )

      const goal = get().goal || description
      const turn: SessionTurn = { role: 'user', text: description, at: Date.now() }
      const sessionTurns = [...get().sessionTurns, turn].slice(-MAX_SESSION_TURNS)

      set({
        conversationActive: true,
        goal,
        sessionTurns,
      })
    }

    set({ busy: false, result })
  },

  clearResult: () => set({ result: null }),

  setConversationActive: (active) => set({ conversationActive: active }),

  resetConversation: () =>
    set({
      conversationActive: false,
      result: null,
      lastPrompt: '',
      memory: null,
      sessionTurns: [],
      goal: '',
      contextSaved: false,
      lastCompactedFingerprint: '',
    }),

  loadMemory: (memory, circuit) => {
    set({
      memory,
      goal: memory.goal,
      sessionTurns: [],
      contextSaved: true,
      conversationActive: true,
      lastCompactedFingerprint: fingerprintFromState(memory.goal, [], circuit),
    })
  },

  resetSessionMemory: () =>
    set({
      memory: null,
      sessionTurns: [],
      goal: '',
      contextSaved: false,
      lastCompactedFingerprint: '',
    }),

  syncBaselineFingerprint: (circuit) => {
    const { goal, sessionTurns } = get()
    set({ lastCompactedFingerprint: fingerprintFromState(goal, sessionTurns, circuit) })
  },

  prepareMemoryForSave: async (circuit) => {
    const state = get()
    const { config, goal, sessionTurns, memory, contextSaved, lastCompactedFingerprint } = state
    const pendingDeltas = diff.buildDeltaContext(useCircuitStore.getState().notifications)
    const currentFingerprint = fingerprintFromState(goal, sessionTurns, circuit)

    if (contextSaved && memory && currentFingerprint === lastCompactedFingerprint) {
      return { memory, skipped: true }
    }

    let summary: string
    if (!contextSaved || !memory?.summary) {
      summary = await compactMemoryFull(config, {
        goal,
        sessionTurns,
        pendingDeltas,
        circuitName: circuit.circuit_name,
      })
    } else {
      summary = await compactMemoryIncremental(config, {
        goal,
        previousSummary: memory.summary,
        sessionTurns,
        pendingDeltas,
        circuitName: circuit.circuit_name,
      })
    }

    const compactedAt = new Date().toISOString()
    const nextMemory: ProjectMemory = {
      goal,
      summary,
      compactedAt,
      sourceFingerprint: currentFingerprint,
    }

    useCircuitStore.getState().clearNotifications()
    set({
      memory: nextMemory,
      sessionTurns: [],
      contextSaved: true,
      lastCompactedFingerprint: currentFingerprint,
    })

    return { memory: nextMemory, skipped: false }
  },
}))
