import { describe, expect, it } from 'vitest'
import { PRESETS } from './providerPresets'

describe('providerPresets', () => {
  it('defines all four supported providers', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([
      'anthropic',
      'gemini',
      'lmstudio',
      'openai',
    ])
  })

  it('uses gemini-3-flash-preview as Gemini default', () => {
    expect(PRESETS.gemini.defaultModel).toBe('gemini-3-flash-preview')
  })

  it('requires API keys only for cloud providers', () => {
    expect(PRESETS.openai.requiresKey).toBe(true)
    expect(PRESETS.anthropic.requiresKey).toBe(true)
    expect(PRESETS.gemini.requiresKey).toBe(true)
    expect(PRESETS.lmstudio.requiresKey).toBe(false)
  })

  it('points LM Studio to local OpenAI-compatible endpoint', () => {
    expect(PRESETS.lmstudio.endpoint).toContain('localhost:1234')
    expect(PRESETS.lmstudio.jsonMode).toBe('none')
  })
})
