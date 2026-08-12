import { toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react'

const EXPORT_PADDING = 0.15
const MIN_ZOOM = 0.1
const MAX_ZOOM = 2
const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080
const BACKGROUND = '#f4f7fb'

export function toSafePngFileName(name: string): string {
  const base = name.trim() || 'circuit'
  const forbidden = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const sanitized = [...base]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (forbidden.has(ch) || code <= 31) return '_'
      return ch
    })
    .join('')
  return `${sanitized.replace(/\s+/g, '_')}.png`
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export interface SchematicPngExportOptions {
  circuitName: string
  nodes: Node[]
  viewportElement: HTMLElement
  width?: number
  height?: number
  backgroundColor?: string
}

/**
 * Captures the React Flow viewport as a PNG covering all nodes (not just the
 * current camera). Controls / MiniMap / Panel sit outside `.react-flow__viewport`
 * and are excluded automatically.
 */
export async function exportSchematicToPng(
  options: SchematicPngExportOptions,
): Promise<void> {
  const {
    circuitName,
    nodes,
    viewportElement,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    backgroundColor = BACKGROUND,
  } = options

  if (nodes.length === 0) {
    throw new Error('Nessun componente da esportare.')
  }

  const bounds = getNodesBounds(nodes)
  const viewport = getViewportForBounds(
    bounds,
    width,
    height,
    MIN_ZOOM,
    MAX_ZOOM,
    EXPORT_PADDING,
  )

  const dataUrl = await toPng(viewportElement, {
    backgroundColor,
    width,
    height,
    pixelRatio: 2,
    // Prefer CSS from <link>/<style> so SVG edge strokes survive the clone.
    cacheBust: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })

  downloadDataUrl(toSafePngFileName(circuitName), dataUrl)
}

type PngExporter = () => Promise<void>

let registeredExporter: PngExporter | null = null

/** Called from inside ReactFlow so the exporter can access live node positions. */
export function registerSchematicPngExporter(exporter: PngExporter | null): void {
  registeredExporter = exporter
}

export async function downloadSchematicPng(): Promise<void> {
  if (!registeredExporter) {
    throw new Error('Canvas non pronto per l\'export PNG.')
  }
  await registeredExporter()
}
