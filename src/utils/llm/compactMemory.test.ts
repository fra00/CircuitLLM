import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmConfig } from '../../types/llm'
import {
  compactMemoryFull,
  compactMemoryIncremental,
} from './compactMemory'

vi.mock('./client', () => ({
  callLlmText: vi.fn(),
}))

import { callLlmText } from './client'

const config: LlmConfig = {
  provider: 'lmstudio',
  apiKey: '',
  baseUrl: '',
  model: 'test-model',
}

describe('compactMemory', () => {
  beforeEach(() => {
    vi.mocked(callLlmText).mockReset()
  })

  it('compactMemoryFull sends goal, turns and deltas to LLM', async () => {
    vi.mocked(callLlmText).mockResolvedValue('  - Memoria full  ')
    const summary = await compactMemoryFull(config, {
      goal: 'Robot',
      sessionTurns: [{ role: 'user', text: 'Aggiungi LED', at: 1_700_000_000_000 }],
      pendingDeltas: ['Added R1'],
      circuitName: 'Demo',
    })

    expect(summary).toBe('- Memoria full')
    expect(callLlmText).toHaveBeenCalledOnce()
    const [, messages] = vi.mocked(callLlmText).mock.calls[0]
    expect(messages[0].role).toBe('system')
    expect(messages[1].content).toContain('Demo')
    expect(messages[1].content).toContain('Robot')
    expect(messages[1].content).toContain('Aggiungi LED')
    expect(messages[1].content).toContain('Added R1')
  })

  it('compactMemoryFull uses placeholders when turns/deltas empty', async () => {
    vi.mocked(callLlmText).mockResolvedValue('- empty')
    await compactMemoryFull(config, {
      goal: '',
      sessionTurns: [],
      pendingDeltas: [],
      circuitName: 'Empty',
    })
    const [, messages] = vi.mocked(callLlmText).mock.calls[0]
    expect(messages[1].content).toContain('(non specificato)')
    expect(messages[1].content).toContain('(nessun prompt utente registrato)')
    expect(messages[1].content).toContain('(nessuna modifica canvas pending)')
  })

  it('compactMemoryIncremental includes previous summary', async () => {
    vi.mocked(callLlmText).mockResolvedValue('- Memoria incr')
    const summary = await compactMemoryIncremental(config, {
      goal: 'Robot',
      previousSummary: '- Usa Arduino',
      sessionTurns: [{ role: 'user', text: 'Più sensori', at: Date.now() }],
      pendingDeltas: [],
      circuitName: 'Demo',
    })

    expect(summary).toBe('- Memoria incr')
    const [, messages] = vi.mocked(callLlmText).mock.calls[0]
    expect(messages[1].content).toContain('MEMORIA COMPATTA PRECEDENTE')
    expect(messages[1].content).toContain('- Usa Arduino')
    expect(messages[1].content).toContain('Più sensori')
  })
})
