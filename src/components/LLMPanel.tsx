import { useState } from 'react'
import { useLlmStore } from '../store/llmStore'
import { useCircuitStore } from '../store/circuitStore'
import { PRESETS } from '../data/providerPresets'
import './LLMPanel.css'

const EXAMPLE_PROMPTS = [
  'Robot mobile con Arduino, 2 motori con encoder e LiDAR',
  'Alimentatore 5V con LM7805, condensatori di filtro e LED di stato',
  'Amplificatore audio con LM386, potenziometro di volume e jack 3.5mm',
]

const EXAMPLE_EDIT_PROMPTS = [
  'Aggiungi un condensatore da 100uF in uscita sull\'alimentazione',
  'Aumenta la resistenza R1 da 10k a 22k',
  'Togli il LED di stato e la sua resistenza',
]

export function LLMPanel() {
  const config = useLlmStore((state) => state.config)
  const busy = useLlmStore((state) => state.busy)
  const result = useLlmStore((state) => state.result)
  const conversationActive = useLlmStore((state) => state.conversationActive)
  const generate = useLlmStore((state) => state.generate)
  const clearResult = useLlmStore((state) => state.clearResult)
  const resetConversation = useLlmStore((state) => state.resetConversation)
  const circuit = useCircuitStore((state) => state.circuit)

  const preset = PRESETS[config.provider]
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0])

  const canGenerate = !busy && (prompt.trim().length > 0) &&
    (preset.requiresKey ? config.apiKey.trim().length > 0 : true)

  const handleGenerate = () => {
    if (canGenerate) void generate(prompt)
  }

  return (
    <div className="llm-panel">
      <p className="llm-panel__hint">
        Provider attivo: <strong>{preset.label}</strong> — Modello:{' '}
        <strong>{config.model || preset.defaultModel}</strong>.
        Le impostazioni LLM sono nella toolbar (icona ingranaggio).
      </p>

      <label className="llm-panel__field">
        <span>Prompt</span>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <div className="llm-panel__examples">
        {(conversationActive ? EXAMPLE_EDIT_PROMPTS : EXAMPLE_PROMPTS).map((example) => (
          <button
            key={example}
            type="button"
            className="llm-panel__chip"
            onClick={() => setPrompt(example)}
          >
            {example}
          </button>
        ))}
      </div>

      {conversationActive && (
        <p className="llm-panel__hint">
          Modalit&agrave; modifica: le richieste verranno applicate allo schema
          attuale ({circuit.components.length} componenti, {circuit.nets.length}{' '}
          reti). Usa &quot;Nuovo schema&quot; per ricominciare da zero.
        </p>
      )}

      <button
        type="button"
        className="llm-panel__generate"
        disabled={!canGenerate}
        onClick={handleGenerate}
      >
        {busy
          ? 'Generazione in corso...'
          : conversationActive
            ? 'Applica richiesta allo schema'
            : 'Genera schema'}
      </button>

      {!canGenerate && preset.requiresKey && config.apiKey.trim().length === 0 && (
        <p className="llm-panel__hint llm-panel__hint--warning">
          Imposta prima la API key in <strong>LLM settings</strong> (toolbar).
        </p>
      )}

      {conversationActive && (
        <button
          type="button"
          className="llm-panel__ghost"
          onClick={() => {
            resetConversation()
            setPrompt(EXAMPLE_PROMPTS[0])
          }}
        >
          Nuovo schema (azzera contesto)
        </button>
      )}

      {result?.status === 'done' && result.circuit && (
        <div className="llm-panel__result">
          <strong>Schema generato:</strong> {result.circuit.circuit_name}
          <br />
          {result.circuit.components.length} componenti, {result.circuit.nets.length} reti
          {result.latencyMs !== undefined && ` — ${result.latencyMs} ms`}
        </div>
      )}

      {result?.status === 'error' && (
        <div className="llm-panel__result llm-panel__result--error">
          <strong>Errore:</strong> {result.error}
          {result.rawText && (
            <details className="llm-panel__raw">
              <summary>Risposta grezza dell&apos;LLM</summary>
              <pre>{result.rawText}</pre>
            </details>
          )}
        </div>
      )}

      {result && (
        <button
          type="button"
          className="llm-panel__ghost"
          onClick={clearResult}
        >
          Chiudi risultato
        </button>
      )}
    </div>
  )
}