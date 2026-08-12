import type { Circuit } from './circuit'

export type LlmProviderId = 'openai' | 'anthropic' | 'gemini' | 'lmstudio'

export interface LlmConfig {
  provider: LlmProviderId
  apiKey: string
  baseUrl: string
  model: string
}

export type LlmStatus = 'idle' | 'loading' | 'done' | 'error'

export interface LlmGenerationResult {
  status: LlmStatus
  circuit?: Circuit
  rawText?: string
  error?: string
  /** Latency of the last request in milliseconds */
  latencyMs?: number
}