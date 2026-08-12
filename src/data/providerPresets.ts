import type { LlmProviderId } from '../types/llm'

export interface ProviderPreset {
  id: LlmProviderId
  label: string
  /** Endpoint used for plain HTTP calls; LM Studio is OpenAI-compatible */
  endpoint: string
  /** Default model placeholder shown in the config form */
  defaultModel: string
  /** Whether an API key is required to call this provider */
  requiresKey: boolean
  keyPlaceholder: string
  hint: string
  /**
   * How the provider enforces JSON output:
   * - 'json_object': OpenAI-style response_format (supported by OpenAI API)
   * - 'json_schema': strict JSON Schema response_format
   * - 'none': no enforced mode; relies on the system prompt + client-side parsing
   */
  jsonMode: 'json_object' | 'json_schema' | 'none'
}

export const PRESETS: Record<LlmProviderId, ProviderPreset> = {
  openai: {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    requiresKey: true,
    keyPlaceholder: 'sk-...',
    hint: 'API key di OpenAI (platform.openai.com/api-keys).',
    jsonMode: 'json_object',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    requiresKey: true,
    keyPlaceholder: 'sk-ant-...',
    hint: 'API key di Anthropic (console.anthropic.com).',
    jsonMode: 'none',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini (Google)',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    defaultModel: 'gemini-3-flash-preview',
    requiresKey: true,
    keyPlaceholder: 'AIza...',
    hint: 'API key di Google AI Studio (aistudio.google.com).',
    jsonMode: 'none',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (locale)',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    defaultModel: 'llama-3.1-8b-instruct',
    requiresKey: false,
    keyPlaceholder: 'non richiesta',
    hint: 'Server locale: in LM Studio attiva "Serve on Local Network" e "Enable CORS". Nessuna chiave. Il JSON è richiesto dal prompt di sistema.',
    jsonMode: 'none',
  },
}