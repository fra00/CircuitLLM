import type { LlmProviderId } from '../types/llm'
import { useLlmStore } from '../store/llmStore'
import { PRESETS } from '../data/providerPresets'
import './LLMSettingsDialog.css'

interface LLMSettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function LLMSettingsDialog({ open, onClose }: LLMSettingsDialogProps) {
  const config = useLlmStore((state) => state.config)
  const setConfig = useLlmStore((state) => state.setConfig)

  if (!open) return null

  const preset = PRESETS[config.provider]

  const onProviderChange = (provider: LlmProviderId) => {
    const next = PRESETS[provider]
    setConfig({
      provider,
      model: config.model || next.defaultModel,
      baseUrl: '',
      apiKey: next.requiresKey ? config.apiKey : '',
    })
  }

  return (
    <div className="llm-settings__backdrop" onClick={onClose}>
      <div
        className="llm-settings__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="LLM settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="llm-settings__header">
          <h2>LLM settings</h2>
          <button type="button" className="llm-settings__close" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="llm-settings__field">
          <span>Provider</span>
          <select
            value={config.provider}
            onChange={(event) => onProviderChange(event.target.value as LlmProviderId)}
          >
            {Object.values(PRESETS).map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>

        <label className="llm-settings__field">
          <span>API Key</span>
          <input
            type="password"
            value={config.apiKey}
            placeholder={preset.keyPlaceholder}
            disabled={!preset.requiresKey}
            onChange={(event) => setConfig({ apiKey: event.target.value.trim() })}
          />
        </label>

        <label className="llm-settings__field">
          <span>Base URL (opzionale)</span>
          <input
            type="text"
            value={config.baseUrl}
            placeholder={preset.endpoint}
            onChange={(event) => setConfig({ baseUrl: event.target.value.trim() })}
          />
        </label>

        <label className="llm-settings__field">
          <span>Modello</span>
          <input
            type="text"
            value={config.model}
            placeholder={preset.defaultModel}
            onChange={(event) => setConfig({ model: event.target.value.trim() })}
          />
        </label>

        <p className="llm-settings__hint">
          {preset.hint}
          <br />
          La chiave resta solo nel browser (localStorage) ed e&apos; inviata direttamente
          al provider.
        </p>

        <div className="llm-settings__footer">
          <button type="button" className="llm-settings__done" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
