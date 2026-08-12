import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LlmConfig } from '../../types/llm'
import { callLlmText, generateCircuit } from './client'

function mockFetchOk(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(payload),
    }),
  )
}

function mockFetchHttpError(status = 500, body = 'boom') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText: 'Error',
      text: async () => body,
    }),
  )
}

const validCircuitJson = JSON.stringify({
  circuit_name: 'From LLM',
  components: [
    {
      id: 'R1',
      label: 'R',
      type: 'RESISTOR',
      pins: [
        { id: 'A', label: '1', type: 'PASSIVE' },
        { id: 'B', label: '2', type: 'PASSIVE' },
      ],
    },
  ],
  nets: [],
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('callLlmText', () => {
  it('routes openai-compatible responses', async () => {
    mockFetchOk({ choices: [{ message: { content: 'hello openai' } }] })
    const text = await callLlmText(
      { provider: 'openai', apiKey: 'k', baseUrl: '', model: 'gpt' },
      [{ role: 'user', content: 'hi' }],
    )
    expect(text).toBe('hello openai')
  })

  it('routes anthropic responses', async () => {
    mockFetchOk({ content: [{ type: 'text', text: 'hello claude' }] })
    const text = await callLlmText(
      { provider: 'anthropic', apiKey: 'k', baseUrl: '', model: 'claude' },
      [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }],
    )
    expect(text).toBe('hello claude')
  })

  it('routes gemini responses', async () => {
    mockFetchOk({
      candidates: [{ content: { parts: [{ text: 'hello gemini' }] } }],
    })
    const text = await callLlmText(
      { provider: 'gemini', apiKey: 'k', baseUrl: '', model: 'gemini' },
      [{ role: 'user', content: 'hi' }],
    )
    expect(text).toBe('hello gemini')
  })

  it('routes lmstudio responses', async () => {
    mockFetchOk({ choices: [{ message: { content: 'hello local' } }] })
    const text = await callLlmText(
      { provider: 'lmstudio', apiKey: '', baseUrl: '', model: 'local' },
      [{ role: 'user', content: 'hi' }],
    )
    expect(text).toBe('hello local')
  })
})

describe('generateCircuit', () => {
  const config: LlmConfig = {
    provider: 'lmstudio',
    apiKey: '',
    baseUrl: '',
    model: 'local',
  }

  it('parses provider JSON into a circuit', async () => {
    mockFetchOk({ choices: [{ message: { content: validCircuitJson } }] })
    const result = await generateCircuit(config, 'LED circuit')
    expect(result.status).toBe('done')
    expect(result.circuit?.circuit_name).toBe('From LLM')
    expect(result.circuit?.components).toHaveLength(1)
    expect(result.rawText).toContain('From LLM')
    expect(result.latencyMs).toBeTypeOf('number')
  })

  it('returns error status on HTTP failure', async () => {
    mockFetchHttpError(401, 'unauthorized')
    const result = await generateCircuit(config, 'fail')
    expect(result.status).toBe('error')
    expect(result.error).toContain('HTTP 401')
  })

  it('returns error status on empty provider payload', async () => {
    mockFetchOk({ choices: [{ message: {} }] })
    const result = await generateCircuit(
      { ...config, provider: 'openai', apiKey: 'k' },
      'empty',
    )
    expect(result.status).toBe('error')
    expect(result.error).toContain('vuota')
  })
})
