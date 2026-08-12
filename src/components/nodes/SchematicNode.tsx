import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { CanvasNode } from '../../types/canvas'
import type { PinType } from '../../types/circuit'
import { pinSide } from '../../utils/pinGeometry'
import { useCircuitStore } from '../../store/circuitStore'
import './schematicNode.css'

function handleClass(type: PinType): string {
  switch (type) {
    case 'POWER_IN':
    case 'POWER_OUT':
      return 'pin--power'
    case 'OUTPUT':
    case 'BIDIRECTIONAL':
      return 'pin--signal-out'
    default:
      return 'pin--signal-in'
  }
}

function SchematicNodeComponent({ data }: { data: CanvasNode['data'] }) {
  const { component, pinNets } = data
  const [addingPin, setAddingPin] = useState(false)
  const [addingPinSide, setAddingPinSide] = useState<'left' | 'right'>('left')
  const [newPinName, setNewPinName] = useState('')
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [draftId, setDraftId] = useState(component.id)
  const [draftLabel, setDraftLabel] = useState(component.label)

  const handleRemovePin = (pinId: string) => (event: React.MouseEvent) => {
    event.stopPropagation()
    useCircuitStore.getState().removePin(component.id, pinId)
  }

  const handleAddPin = (event: React.FormEvent) => {
    event.preventDefault()
    const pinType: PinType = addingPinSide === 'left' ? 'INPUT' : 'OUTPUT'
    useCircuitStore.getState().addPin(component.id, newPinName, pinType)
    setNewPinName('')
    setAddingPin(false)
  }

  const handleRemoveComponent = (event: React.MouseEvent) => {
    event.stopPropagation()
    useCircuitStore.getState().removeComponent(component.id)
  }

  const handleStartIdentityEdit = (event: React.MouseEvent) => {
    event.stopPropagation()
    setDraftId(component.id)
    setDraftLabel(component.label)
    setEditingIdentity(true)
  }

  const handleSaveIdentity = (event: React.FormEvent) => {
    event.preventDefault()
    useCircuitStore.getState().updateComponentIdentity(component.id, draftId, draftLabel)
    setEditingIdentity(false)
  }

  return (
    <div className="schematic-node">
      <div className="schematic-node__header">
        {editingIdentity ? (
          <form className="schematic-node__edit form nodrag" onSubmit={handleSaveIdentity}>
            <input
              value={draftId}
              onChange={(event) => setDraftId(event.target.value)}
              placeholder="Codice (es. C1)"
            />
            <input
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="Nome componente"
            />
            <button type="submit" title="Salva">✓</button>
            <button
              type="button"
              title="Annulla"
              onClick={() => {
                setEditingIdentity(false)
                setDraftId(component.id)
                setDraftLabel(component.label)
              }}
            >
              ×
            </button>
          </form>
        ) : (
          <span className="schematic-node__ref">{component.id}</span>
        )}
        <div className="schematic-node__header-actions">
          <span className="schematic-node__type">{component.type}</span>
          {!editingIdentity && (
            <button
              type="button"
              className="schematic-node__edit-btn nodrag"
              title={`Modifica ${component.id}`}
              onClick={handleStartIdentityEdit}
            >
              Modifica
            </button>
          )}
          <button
            type="button"
            className="schematic-node__remove nodrag"
            title={`Elimina componente ${component.id}`}
            onClick={handleRemoveComponent}
          >
            Elimina
          </button>
        </div>
      </div>
      {!editingIdentity && <div className="schematic-node__label">{component.label}</div>}
      {component.value && (
        <div className="schematic-node__value">{component.value}</div>
      )}
      <div className="schematic-node__pins">
        {component.pins.map((pin, index) => {
          const side = pinSide(pin.type, index)
          const nets = pinNets[pin.id] ?? []
          const netsLabel = nets.length > 0 ? nets.join(' / ') : 'NC'
          return (
            <div
              key={pin.id}
              className={`schematic-node__pin schematic-node__pin--${side}`}
            >
              {side === 'left' && (
                <>
                  <Handle
                    id={`pin:${pin.id}`}
                    type="source"
                    position={Position.Left}
                    className={`schematic-node__handle ${handleClass(pin.type)}`}
                  />
                  <Handle
                    id={`pin:${pin.id}`}
                    type="target"
                    position={Position.Left}
                    className={`schematic-node__handle ${handleClass(pin.type)}`}
                  />
                </>
              )}
              <span
                className="schematic-node__pin-label"
                title={`${component.id}.${pin.id} — ${netsLabel}`}
              >
                {pin.label}
              </span>
              <span className="schematic-node__netname">{netsLabel}</span>
              <button
                type="button"
                className="schematic-node__pin-remove nodrag"
                title={`Rimuovi pin ${component.id}.${pin.id}`}
                onClick={handleRemovePin(pin.id)}
              >
                ×
              </button>
              {side === 'right' && (
                <>
                  <Handle
                    id={`pin:${pin.id}`}
                    type="source"
                    position={Position.Right}
                    className={`schematic-node__handle ${handleClass(pin.type)}`}
                  />
                  <Handle
                    id={`pin:${pin.id}`}
                    type="target"
                    position={Position.Right}
                    className={`schematic-node__handle ${handleClass(pin.type)}`}
                  />
                </>
              )}
            </div>
          )
        })}

        {!addingPin && (
          <div className="schematic-node__addpin-row">
            <button
              type="button"
              className="schematic-node__addpin-side nodrag"
              title="Aggiungi pin a sinistra"
              onClick={() => {
                setAddingPinSide('left')
                setNewPinName('')
                setAddingPin(true)
              }}
            >
              + pin sx
            </button>
            <button
              type="button"
              className="schematic-node__addpin-side nodrag"
              title="Aggiungi pin a destra"
              onClick={() => {
                setAddingPinSide('right')
                setNewPinName('')
                setAddingPin(true)
              }}
            >
              + pin dx
            </button>
          </div>
        )}
      </div>
      {addingPin && (
        <form
          className="schematic-node__addpin form nodrag"
          onSubmit={handleAddPin}
        >
          <input
            autoFocus
            type="text"
            value={newPinName}
            placeholder={`Nome pin (${addingPinSide === 'left' ? 'sx' : 'dx'})`}
            onChange={(event) => setNewPinName(event.target.value)}
          />
          <button type="submit" title="Conferma">✓</button>
          <button
            type="button"
            title="Annulla"
            onClick={() => {
              setAddingPin(false)
              setNewPinName('')
            }}
          >
            ×
          </button>
        </form>
      )}
    </div>
  )
}

export const SchematicNode = memo(SchematicNodeComponent)
