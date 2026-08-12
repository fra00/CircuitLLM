import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import type { CanvasEdge } from '../../types/canvas'
import { useCircuitStore } from '../../store/circuitStore'
import './schematicEdge.css'

function pinIdFromHandle(handle: string | null | undefined): string {
  return handle?.replace(/^pin:/, '') ?? ''
}

function SchematicEdgeComponent(props: EdgeProps) {
  const {
    selected,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  } = props as EdgeProps & { data?: CanvasEdge['data'] }

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 4,
  })

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!data?.netName) return
    useCircuitStore.getState().disconnectEdge(
      data.netName,
      { component_id: props.source, pin_id: pinIdFromHandle(props.sourceHandleId) },
      { component_id: props.target, pin_id: pinIdFromHandle(props.targetHandleId) },
    )
  }

  return (
    <>
      <BaseEdge
        path={path}
        className={selected ? 'schematic-edge schematic-edge--selected' : 'schematic-edge'}
        markerEnd={props.markerEnd}
        interactionWidth={24}
      />
      {data?.netName && (
        <EdgeLabelRenderer>
          <div
            className={
              selected
                ? 'schematic-edge__label schematic-edge__label--selected'
                : 'schematic-edge__label'
            }
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
            }}
          >
            <span className="schematic-edge__netname">{data.netName}</span>
            <button
              type="button"
              className="schematic-edge__delete nodrag nopan"
              title="Rimuovi filo"
              onClick={handleDelete}
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const SchematicEdge = memo(SchematicEdgeComponent)
