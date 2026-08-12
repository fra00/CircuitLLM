import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { exportSchematicToPng, registerSchematicPngExporter } from '../utils/pngExport'

interface SchematicPngExportBridgeProps {
  circuitName: string
}

/**
 * Must render as a child of <ReactFlow> so useReactFlow() can read live nodes.
 * Registers a toolbar-callable PNG exporter for the current viewport.
 */
export function SchematicPngExportBridge({ circuitName }: SchematicPngExportBridgeProps) {
  const { getNodes } = useReactFlow()

  useEffect(() => {
    registerSchematicPngExporter(async () => {
      const viewportElement = document.querySelector(
        '.react-flow__viewport',
      ) as HTMLElement | null
      if (!viewportElement) {
        throw new Error('Viewport React Flow non trovato.')
      }
      await exportSchematicToPng({
        circuitName,
        nodes: getNodes(),
        viewportElement,
      })
    })
    return () => registerSchematicPngExporter(null)
  }, [circuitName, getNodes])

  return null
}
