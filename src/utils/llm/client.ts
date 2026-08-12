import type { LlmConfig, LlmGenerationResult } from '../../types/llm'
import type { Circuit } from '../../types/circuit'
import type { ProjectMemory } from '../../types/projectMemory'
import { buildMessages } from './prompts'
import { extractJson, normalizeCircuit } from './validate'
import { PRESETS } from '../../data/providerPresets'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function fetchText(url: string, init: RequestInit): Promise<string> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${body.slice(0, 300)}`)
  }
  return response.text()
}

async function openAiLikeRaw(
  config: LlmConfig,
  messages: LlmMessage[],
  url: string,
  headers: Record<string, string>,
  jsonMode: 'json_object' | 'json_schema' | 'none',
): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2,
    max_tokens: 8192,
  }
  if (jsonMode === 'json_object') {
    body.response_format = { type: 'json_object' }
  }
  return fetchText(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function parseOpenAi(body: string): string {
  const data = JSON.parse(body) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  if (data.error) throw new Error(data.error.message ?? 'Errore OpenAI')
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Risposta OpenAI vuota.')
  return content
}

async function callOpenAiRaw(
  config: LlmConfig,
  messages: LlmMessage[],
  jsonMode: 'json_object' | 'json_schema' | 'none',
): Promise<string> {
  const preset = PRESETS.openai
  const url = config.baseUrl.trim() || preset.endpoint
  const body = await openAiLikeRaw(config, messages, url, {
    Authorization: `Bearer ${config.apiKey}`,
  }, jsonMode)
  return parseOpenAi(body)
}

async function callAnthropicRaw(config: LlmConfig, messages: LlmMessage[]): Promise<string> {
  const preset = PRESETS.anthropic
  const url = config.baseUrl.trim() || preset.endpoint
  const body = await fetchText(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      temperature: 0.2,
      system: messages.find((m) => m.role === 'system')?.content ?? '',
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  })
  const data = JSON.parse(body) as {
    content?: Array<{ type?: string; text?: string }>
    error?: { message?: string }
  }
  if (data.error) throw new Error(data.error.message ?? 'Errore Anthropic')
  const text = data.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new Error('Risposta Anthropic vuota.')
  return text
}

async function callGeminiRaw(
  config: LlmConfig,
  messages: LlmMessage[],
  jsonMode: boolean,
): Promise<string> {
  const preset = PRESETS.gemini
  const base = config.baseUrl.trim() || preset.endpoint
  const url = `${base}${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const system = messages.find((m) => m.role === 'system')?.content ?? ''
  const user = messages.find((m) => m.role === 'user')?.content ?? ''
  const generationConfig: Record<string, unknown> = { temperature: 0.2 }
  if (jsonMode) generationConfig.responseMimeType = 'application/json'

  const body = await fetchText(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig,
    }),
  })
  const data = JSON.parse(body) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }
  if (data.error) throw new Error(data.error.message ?? 'Errore Gemini')
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Risposta Gemini vuota.')
  return text
}

async function callLmStudioRaw(
  config: LlmConfig,
  messages: LlmMessage[],
  jsonMode: 'json_object' | 'json_schema' | 'none',
): Promise<string> {
  const preset = PRESETS.lmstudio
  const url = config.baseUrl.trim() || preset.endpoint
  const body = await openAiLikeRaw(config, messages, url, {}, jsonMode)
  return parseOpenAi(body)
}

/** Generic text completion across all supported providers (no JSON enforcement). */
export async function callLlmText(config: LlmConfig, messages: LlmMessage[]): Promise<string> {
  switch (config.provider) {
    case 'openai':
      return callOpenAiRaw(config, messages, 'none')
    case 'anthropic':
      return callAnthropicRaw(config, messages)
    case 'gemini':
      return callGeminiRaw(config, messages, false)
    case 'lmstudio':
      return callLmStudioRaw(config, messages, 'none')
  }
}

async function callOpenAi(
  config: LlmConfig,
  description: string,
  canvasContext?: string[],
  currentCircuit?: Circuit,
  projectMemory?: ProjectMemory | null,
): Promise<string> {
  const preset = PRESETS.openai
  const messages = buildMessages(description, canvasContext, currentCircuit, projectMemory)
  return callOpenAiRaw(config, messages, preset.jsonMode)
}

async function callAnthropic(
  config: LlmConfig,
  description: string,
  canvasContext?: string[],
  currentCircuit?: Circuit,
  projectMemory?: ProjectMemory | null,
): Promise<string> {
  const messages = buildMessages(description, canvasContext, currentCircuit, projectMemory)
  return callAnthropicRaw(config, messages)
}

async function callGemini(
  config: LlmConfig,
  description: string,
  canvasContext?: string[],
  currentCircuit?: Circuit,
  projectMemory?: ProjectMemory | null,
): Promise<string> {
  const messages = buildMessages(description, canvasContext, currentCircuit, projectMemory)
  return callGeminiRaw(config, messages, true)
}

async function callLmStudio(
  config: LlmConfig,
  description: string,
  canvasContext?: string[],
  currentCircuit?: Circuit,
  projectMemory?: ProjectMemory | null,
): Promise<string> {
  const preset = PRESETS.lmstudio
  const messages = buildMessages(description, canvasContext, currentCircuit, projectMemory)
  return callLmStudioRaw(config, messages, preset.jsonMode)
}

/**
 * Generates a Circuit from a natural language description via the configured
 * provider. When `currentCircuit` is provided the model APPLIES the request
 * to it (multi-turn editing) instead of generating from scratch. When
 * present, `canvasContext` carries the pending [SYSTEM NOTIFICATION] deltas
 * recorded by the Diff Engine so the model respects manual canvas edits.
 */
export async function generateCircuit(
  config: LlmConfig,
  description: string,
  canvasContext?: string[],
  currentCircuit?: Circuit,
  projectMemory?: ProjectMemory | null,
): Promise<LlmGenerationResult> {
  const startedAt = performance.now()
  let raw: string | undefined
  try {
    switch (config.provider) {
      case 'openai':
        raw = await callOpenAi(config, description, canvasContext, currentCircuit, projectMemory)
        break
      case 'anthropic':
        raw = await callAnthropic(config, description, canvasContext, currentCircuit, projectMemory)
        break
      case 'gemini':
        raw = await callGemini(config, description, canvasContext, currentCircuit, projectMemory)
        break
      case 'lmstudio':
        raw = await callLmStudio(config, description, canvasContext, currentCircuit, projectMemory)
        break
    }
    const circuit = normalizeCircuit(extractJson(raw), description)
    return {
      status: 'done',
      circuit,
      rawText: raw,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      rawText: raw,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}
