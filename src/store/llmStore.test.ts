import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTestCircuit } from '../test/fixtures'
import type { ProjectMemory } from '../types/projectMemory'

vi.mock('../utils/llm/client', () => ({
  generateCircuit: vi.fn(),
}))

vi.mock('../utils/llm/compactMemory', () => ({
  compactMemoryFull: vi.fn(),
  compactMemoryIncremental: vi.fn(),
}))

import { generateCircuit } from '../utils/llm/client'
import { compactMemoryFull, compactMemoryIncremental } from '../utils/llm/compactMemory'
import { useCircuitStore } from './circuitStore'
import { DEFAULT_CONFIG, useLlmStore } from './llmStore'

const memoryStub: ProjectMemory = {
  goal: 'Goal',
  summary: '- summary',
  compactedAt: '2026-08-12T12:00:00.000Z',
  sourceFingerprint: 'fp',
}

function installLocalStorage() {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
  })
}

function resetStores() {
  useCircuitStore.setState({
    circuit: makeTestCircuit(),
    notifications: [],
  })
  useLlmStore.setState({
    config: { ...DEFAULT_CONFIG },
    busy: false,
    result: null,
    lastPrompt: '',
    conversationActive: false,
    memory: null,
    sessionTurns: [],
    goal: '',
    contextSaved: false,
    lastCompactedFingerprint: '',
  })
}

describe('llmStore', () => {
  beforeEach(() => {
    installLocalStorage()
    resetStores()
    vi.mocked(generateCircuit).mockReset()
    vi.mocked(compactMemoryFull).mockReset()
    vi.mocked(compactMemoryIncremental).mockReset()
  })

  it('setConfig merges and persists config', () => {
    useLlmStore.getState().setConfig({ provider: 'gemini', model: 'gemini-3-flash-preview' })
    expect(useLlmStore.getState().config.provider).toBe('gemini')
    expect(useLlmStore.getState().config.model).toBe('gemini-3-flash-preview')
    expect(localStorage.getItem('circuitllm.llm-config')).toContain('gemini')
  })

  it('generate loads circuit and records session turn on success', async () => {
    const circuit = makeTestCircuit({ circuit_name: 'Generated' })
    vi.mocked(generateCircuit).mockResolvedValue({
      status: 'done',
      circuit,
      rawText: '{}',
      latencyMs: 10,
    })

    await useLlmStore.getState().generate('Crea un robot')

    expect(useLlmStore.getState().busy).toBe(false)
    expect(useLlmStore.getState().conversationActive).toBe(true)
    expect(useLlmStore.getState().goal).toBe('Crea un robot')
    expect(useLlmStore.getState().sessionTurns).toHaveLength(1)
    expect(useCircuitStore.getState().circuit.circuit_name).toBe('Generated')
    expect(useCircuitStore.getState().notifications.length).toBeGreaterThan(0)
  })

  it('generate keeps conversation inactive on error', async () => {
    vi.mocked(generateCircuit).mockResolvedValue({
      status: 'error',
      error: 'boom',
      latencyMs: 1,
    })

    await useLlmStore.getState().generate('fail')
    expect(useLlmStore.getState().result?.status).toBe('error')
    expect(useLlmStore.getState().conversationActive).toBe(false)
    expect(useLlmStore.getState().sessionTurns).toHaveLength(0)
  })

  it('loadMemory restores goal and baseline fingerprint', () => {
    const circuit = makeTestCircuit()
    useLlmStore.getState().loadMemory(memoryStub, circuit)
    expect(useLlmStore.getState().memory).toEqual(memoryStub)
    expect(useLlmStore.getState().goal).toBe('Goal')
    expect(useLlmStore.getState().contextSaved).toBe(true)
    expect(useLlmStore.getState().lastCompactedFingerprint).toBeTruthy()
  })

  it('prepareMemoryForSave skips when fingerprint unchanged', async () => {
    const circuit = makeTestCircuit()
    useLlmStore.getState().loadMemory(memoryStub, circuit)

    const result = await useLlmStore.getState().prepareMemoryForSave(circuit)
    expect(result.skipped).toBe(true)
    expect(compactMemoryFull).not.toHaveBeenCalled()
    expect(compactMemoryIncremental).not.toHaveBeenCalled()
  })

  it('prepareMemoryForSave runs full compaction on first save', async () => {
    vi.mocked(compactMemoryFull).mockResolvedValue('- full summary')
    useLlmStore.setState({ goal: 'First', sessionTurns: [] })

    const result = await useLlmStore.getState().prepareMemoryForSave(makeTestCircuit())
    expect(result.skipped).toBe(false)
    expect(result.memory.summary).toBe('- full summary')
    expect(compactMemoryFull).toHaveBeenCalledOnce()
    expect(useLlmStore.getState().contextSaved).toBe(true)
  })

  it('prepareMemoryForSave runs incremental compaction after changes', async () => {
    const circuit = makeTestCircuit()
    useLlmStore.getState().loadMemory(memoryStub, circuit)
    useCircuitStore.getState().recordNotification('[SYSTEM NOTIFICATION]: Added C1')
    vi.mocked(compactMemoryIncremental).mockResolvedValue('- incr summary')

    const result = await useLlmStore.getState().prepareMemoryForSave(circuit)
    expect(result.skipped).toBe(false)
    expect(result.memory.summary).toBe('- incr summary')
    expect(compactMemoryIncremental).toHaveBeenCalledOnce()
  })

  it('resetConversation clears memory and turns', () => {
    useLlmStore.setState({
      conversationActive: true,
      goal: 'x',
      sessionTurns: [{ role: 'user', text: 'a', at: 1 }],
      memory: memoryStub,
      contextSaved: true,
    })
    useLlmStore.getState().resetConversation()
    expect(useLlmStore.getState().conversationActive).toBe(false)
    expect(useLlmStore.getState().memory).toBeNull()
    expect(useLlmStore.getState().sessionTurns).toHaveLength(0)
  })
})
