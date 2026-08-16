import { useRef, useState } from 'react'
import './App.css'
import { CircuitCanvas } from './components/CircuitCanvas'
import { LLMPanel } from './components/LLMPanel'
import { LLMSettingsDialog } from './components/LLMSettingsDialog'
import { useCircuitStore } from './store/circuitStore'
import { useLlmStore } from './store/llmStore'
import { buildDeltaContext } from './utils/diff'
import { downloadKiCadNetlist } from './utils/kicadExport'
import { downloadKicadSchematic } from './utils/kicadSchExport'
import { downloadLlmCircuitMarkdown } from './utils/llmExport'
import { downloadSchematicPng } from './utils/pngExport'
import { downloadProjectFile, readProjectFile } from './utils/projectIO'
import {
  PALETTE_LABELS,
  PALETTE_ORDER,
  createComponent,
  nextComponentRef,
} from './data/componentPalette'

type SidebarTab = 'llm' | 'delta' | 'parts'

const INCLUDE_CONTEXT_KEY = 'circuitllm.include-context'

function loadIncludeContextPreference(): boolean {
  try {
    const raw = localStorage.getItem(INCLUDE_CONTEXT_KEY)
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

function App() {
  const [tab, setTab] = useState<SidebarTab>('llm')
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false)
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false)
  const [projectMessage, setProjectMessage] = useState<string | null>(null)
  const [includeContext, setIncludeContext] = useState(loadIncludeContextPreference)
  const [savingProject, setSavingProject] = useState(false)
  const [exportingPng, setExportingPng] = useState(false)
  const [exportingSch, setExportingSch] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notifications = useCircuitStore((state) => state.notifications)
  const circuit = useCircuitStore((state) => state.circuit)
  const addComponent = useCircuitStore((state) => state.addComponent)
  const loadCircuit = useCircuitStore((state) => state.loadCircuit)
  const updateComponentValue = useCircuitStore((state) => state.updateComponentValue)
  const clearNotifications = useCircuitStore((state) => state.clearNotifications)
  const setConversationActive = useLlmStore((state) => state.setConversationActive)
  const loadMemory = useLlmStore((state) => state.loadMemory)
  const resetSessionMemory = useLlmStore((state) => state.resetSessionMemory)
  const prepareMemoryForSave = useLlmStore((state) => state.prepareMemoryForSave)
  const memory = useLlmStore((state) => state.memory)
  const goal = useLlmStore((state) => state.goal)

  const pendingContext = buildDeltaContext(notifications)

  const handleIncludeContextChange = (checked: boolean) => {
    setIncludeContext(checked)
    try {
      localStorage.setItem(INCLUDE_CONTEXT_KEY, String(checked))
    } catch {
      // ignore
    }
  }

  const handleSaveProject = async () => {
    setSavingProject(true)
    setProjectMessage(null)
    try {
      if (includeContext) {
        setProjectMessage('Compacting context...')
        const { memory, skipped } = await prepareMemoryForSave(circuit)
        downloadProjectFile(circuit, memory)
        setProjectMessage(
          skipped
            ? `Progetto salvato (contesto invariato): ${circuit.circuit_name}`
            : `Progetto salvato con contesto: ${circuit.circuit_name}`,
        )
      } else {
        downloadProjectFile(circuit)
        setProjectMessage(`Progetto salvato: ${circuit.circuit_name}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setProjectMessage(`Errore salvataggio: ${message}`)
    } finally {
      setSavingProject(false)
    }
  }

  const handleExportKicadSch = async () => {
    setExportingSch(true)
    setProjectMessage(null)
    try {
      await downloadKicadSchematic(circuit)
      setProjectMessage(`Schema KiCad esportato: ${circuit.circuit_name}.kicad_sch`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setProjectMessage(`Errore export KiCad schema: ${message}`)
    } finally {
      setExportingSch(false)
    }
  }

  const handleExportPng = async () => {
    setExportingPng(true)
    setProjectMessage(null)
    try {
      await downloadSchematicPng()
      setProjectMessage(`PNG esportato: ${circuit.circuit_name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setProjectMessage(`Errore export PNG: ${message}`)
    } finally {
      setExportingPng(false)
    }
  }

  const handleLoadProjectClick = () => {
    fileInputRef.current?.click()
  }

  const handleLoadProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const loaded = await readProjectFile(file)
      loadCircuit(loaded.circuit)
      if (loaded.memory) {
        loadMemory(loaded.memory, loaded.circuit)
      } else {
        resetSessionMemory()
        setConversationActive(true)
      }
      setProjectMessage(
        loaded.memory
          ? `Progetto caricato con contesto: ${loaded.circuit.circuit_name}`
          : `Progetto caricato: ${loaded.circuit.circuit_name} (${loaded.circuit.components.length} componenti, ${loaded.circuit.nets.length} reti)`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setProjectMessage(`Errore caricamento: ${message}`)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-main">
          <h1>CircuitLLM — Schematic Editor</h1>
          <span>Phases 1-4: Canvas + Auto-Layout + LLM + Diff Engine</span>
        </div>
        <div className="app-shell__toolbar">
          <label className="app-shell__include-context">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(event) => handleIncludeContextChange(event.target.checked)}
            />
            Includi contesto
          </label>
          <button
            type="button"
            className="app-shell__export"
            onClick={() => void handleSaveProject()}
            disabled={savingProject}
            title="Salva circuito, componenti e connessioni"
          >
            {savingProject ? 'Salvataggio...' : 'Salva progetto'}
          </button>
          <button
            type="button"
            className="app-shell__export"
            onClick={handleLoadProjectClick}
            title="Carica un progetto salvato"
          >
            Carica progetto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.circuitllm.json,application/json"
            className="app-shell__file-input"
            onChange={(event) => void handleLoadProjectFile(event)}
          />
          <button
            type="button"
            className="app-shell__export"
            onClick={() => void handleExportKicadSch()}
            disabled={exportingSch}
            title="Esporta bozza schema KiCad (.kicad_sch) con tasselli generici"
          >
            {exportingSch ? 'Export schema...' : 'Export KiCad (.kicad_sch)'}
          </button>
          <button
            type="button"
            className="app-shell__export"
            onClick={() => downloadKiCadNetlist(circuit)}
            title="Netlist XML (legacy / PCB) — non apre lo schematic editor"
          >
            Export KiCad (.net)
          </button>
          <button
            type="button"
            className="app-shell__export"
            onClick={() =>
              downloadLlmCircuitMarkdown(circuit, {
                goal: memory?.goal || goal,
                memorySummary: memory?.summary,
              })
            }
            title="Esporta descrizione topologica Markdown pensata per LLM / firmware"
          >
            Export LLM (.md)
          </button>
          <button
            type="button"
            className="app-shell__export"
            onClick={() => void handleExportPng()}
            disabled={exportingPng}
            title="Esporta lo schema completo come immagine PNG"
          >
            {exportingPng ? 'Export PNG...' : 'Export PNG'}
          </button>
          <div className="app-shell__menu-wrap">
            <button
              type="button"
              className="app-shell__gear"
              title="Settings"
              onClick={() => setToolbarMenuOpen((open) => !open)}
            >
              ⚙
            </button>
            {toolbarMenuOpen && (
              <div className="app-shell__menu">
                <button
                  type="button"
                  className="app-shell__menu-item"
                  onClick={() => {
                    setToolbarMenuOpen(false)
                    setLlmSettingsOpen(true)
                  }}
                >
                  LLM settings
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {projectMessage && (
        <div className="app-shell__status" role="status">
          <span>{projectMessage}</span>
          <button type="button" onClick={() => setProjectMessage(null)}>
            ×
          </button>
        </div>
      )}
      <main className="app-shell__main">
        <section className="app-shell__canvas">
          <CircuitCanvas />
        </section>
        <aside className="app-shell__side">
          <nav className="app-shell__tabs">
            <button
              type="button"
              className={tab === 'llm' ? 'active' : ''}
              onClick={() => setTab('llm')}
            >
              LLM
            </button>
            <button
              type="button"
              className={tab === 'parts' ? 'active' : ''}
              onClick={() => setTab('parts')}
            >
              Componenti
            </button>
            <button
              type="button"
              className={tab === 'delta' ? 'active' : ''}
              onClick={() => setTab('delta')}
            >
              Contesto LLM
              {pendingContext.length > 0 && ` (${pendingContext.length})`}
            </button>
          </nav>

          {tab === 'llm' ? (
            <LLMPanel />
          ) : tab === 'parts' ? (
            <div className="app-shell__palette">
              {PALETTE_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="app-shell__palette-item"
                  onClick={() =>
                    addComponent(createComponent(type, circuit.components))
                  }
                >
                  <span>{PALETTE_LABELS[type]}</span>
                  <code>
                    {nextComponentRef(type, circuit.components)}
                  </code>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => updateComponentValue('R1', '4.7k')}
              >
                Simula modifica manuale: R1 10k &rarr; 4.7k
              </button>
              <button
                type="button"
                className="app-shell__ghost"
                onClick={clearNotifications}
              >
                Svuota il contesto
              </button>

              {pendingContext.length > 0 && (
                <div className="app-shell__delta-preview">
                  <strong>Prossima generazione LLM</strong>
                  <pre>{pendingContext.join('\n')}</pre>
                </div>
              )}

              <ul className="app-shell__notifications">
                {notifications.length === 0 && (
                  <li className="app-shell__empty">
                    Nessuna modifica manuale. Disegna un filo tra due pin per
                    creare una net.
                  </li>
                )}
                {notifications.map((n) => (
                  <li key={n.timestamp}>
                    <time>{new Date(n.timestamp).toLocaleTimeString()}</time>
                    <span>{n.summary}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </main>
      <LLMSettingsDialog
        open={llmSettingsOpen}
        onClose={() => {
          setLlmSettingsOpen(false)
          setToolbarMenuOpen(false)
        }}
      />
    </div>
  )
}

export default App