import type { WokwiComponentAnalysis, WokwiPartChoice } from '../utils/wokwi/nativeAlternatives'
import './LLMSettingsDialog.css'
import './WokwiChoiceDialog.css'

interface WokwiChoiceDialogProps {
  open: boolean
  /** Current item being decided (one at a time) */
  item: WokwiComponentAnalysis | null
  index: number
  total: number
  onChoose: (choice: WokwiPartChoice) => void
  onCancel: () => void
}

export function WokwiChoiceDialog({
  open,
  item,
  index,
  total,
  onChoose,
  onCancel,
}: WokwiChoiceDialogProps) {
  if (!open || !item) return null

  return (
    <div className="llm-settings__backdrop" onClick={onCancel}>
      <div
        className="llm-settings__dialog wokwi-choice__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Scelta parte Wokwi"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="llm-settings__header">
          <h2>
            Export Wokwi — scelta {index}/{total}
          </h2>
          <button type="button" className="llm-settings__close" onClick={onCancel}>
            ×
          </button>
        </div>

        <p className="wokwi-choice__intro">
          Per <strong>{item.label}</strong>
          {item.value ? ` (${item.value})` : ''} esiste sia una parte{' '}
          <strong>nativa Wokwi</strong> sia un <strong>custom chip</strong> generato
          dall&apos;LLM. Quale vuoi usare in questo progetto?
        </p>
        <p className="wokwi-choice__meta">
          Istanza/e: <code>{item.componentIds.join(', ')}</code>
          {' · '}
          chiave: <code>{item.preferenceKey}</code>
        </p>

        <div className="wokwi-choice__options">
          <button
            type="button"
            className="wokwi-choice__option wokwi-choice__option--native"
            onClick={() => onChoose('native')}
          >
            <span className="wokwi-choice__option-title">Parte nativa</span>
            <code>{item.native?.partType}</code>
            <span className="wokwi-choice__option-desc">{item.native?.description}</span>
          </button>
          <button
            type="button"
            className="wokwi-choice__option wokwi-choice__option--custom"
            onClick={() => onChoose('custom')}
          >
            <span className="wokwi-choice__option-title">Custom chip (LLM)</span>
            <code>chip-{item.custom?.slug}</code>
            <span className="wokwi-choice__option-desc">{item.custom?.description}</span>
          </button>
        </div>

        <p className="wokwi-choice__hint">
          La scelta viene ricordata nel progetto (Salva progetto) e non verrà
          riproposta agli export successivi.
        </p>
      </div>
    </div>
  )
}
