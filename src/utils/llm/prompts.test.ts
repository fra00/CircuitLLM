import { describe, expect, it } from 'vitest'
import { makeTestCircuit } from '../../test/fixtures'
import type { ProjectMemory } from '../../types/projectMemory'
import {
  COMPONENT_TYPES,
  buildMessages,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompts'

const memory: ProjectMemory = {
  goal: 'Robot mobile',
  summary: '- Usa Arduino Nano\n- Alimentazione 5V',
  compactedAt: '2026-08-12T12:00:00.000Z',
  sourceFingerprint: 'fp_test',
}

describe('buildSystemPrompt', () => {
  it('includes schema rules and component types', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('Rispondi SOLO con un singolo oggetto JSON')
    expect(prompt).toContain(COMPONENT_TYPES)
    expect(prompt).toContain('circuit_name')
  })

  it('injects canvas context deltas when provided', () => {
    const prompt = buildSystemPrompt(['Added R1', 'Removed net X'])
    expect(prompt).toContain('MODIFICHE MANUALI')
    expect(prompt).toContain('- Added R1')
    expect(prompt).toContain('- Removed net X')
  })

  it('injects project memory when summary is non-empty', () => {
    const prompt = buildSystemPrompt(undefined, memory)
    expect(prompt).toContain('CONTESTO PROGETTO')
    expect(prompt).toContain('Robot mobile')
    expect(prompt).toContain('Usa Arduino Nano')
  })

  it('skips empty memory summary', () => {
    const prompt = buildSystemPrompt(undefined, { ...memory, summary: '   ' })
    expect(prompt).not.toContain('CONTESTO PROGETTO')
  })
})

describe('buildUserPrompt', () => {
  it('builds a fresh design prompt without current circuit', () => {
    const prompt = buildUserPrompt('LED blink')
    expect(prompt).toContain('LED blink')
    expect(prompt).toContain('solo JSON')
    expect(prompt).not.toContain('SCHEMA ATTUALE')
  })

  it('embeds current circuit for multi-turn edits', () => {
    const circuit = makeTestCircuit()
    const prompt = buildUserPrompt('Aggiungi C1', circuit)
    expect(prompt).toContain('SCHEMA ATTUALE (JSON):')
    expect(prompt).toContain('"circuit_name":"Test Circuit"')
    expect(prompt).toContain('Aggiungi C1')
  })
})

describe('buildMessages', () => {
  it('returns system + user messages with memory and context', () => {
    const messages = buildMessages(
      'Modifica schema',
      ['Delta A'],
      makeTestCircuit(),
      memory,
    )
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    expect(messages[0].content).toContain('Delta A')
    expect(messages[0].content).toContain('Robot mobile')
    expect(messages[1].content).toContain('SCHEMA ATTUALE')
  })
})
