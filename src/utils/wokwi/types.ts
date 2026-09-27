/** Wokwi diagram.json types — see https://docs.wokwi.com/diagram-format */

export interface WokwiPart {
  type: string
  id: string
  left?: number
  top?: number
  rotate?: number
  attrs?: Record<string, string>
}

/** Connection: [source, target, color, path] */
export type WokwiConnection = [string, string, string, string[]]

export interface WokwiDiagram {
  version: number
  author?: string
  editor?: string
  parts: WokwiPart[]
  connections: WokwiConnection[]
  dependencies?: Record<string, string>
}

export interface WokwiChipJson {
  name: string
  author: string
  pins: string[]
  controls?: Array<{
    id: string
    label: string
    type: string
    min: number
    max: number
    step: number
  }>
}

export interface CustomChipFiles {
  slug: string
  chipJson: WokwiChipJson
  chipC: string
  /** True when produced by LLM; false for local stub fallback */
  fromLlm: boolean
}

export interface ResolvedPart {
  part: WokwiPart
  /** Maps CircuitLLM pin id → Wokwi pin name used in connections */
  pinMap: Record<string, string>
  /** If set, this part needs a custom chip with this slug */
  customChipSlug?: string
}

export interface DiagramBuildResult {
  diagram: WokwiDiagram
  /** Unique custom-chip prototypes that still need code generation */
  pendingChips: PendingChip[]
  hasNativeMcu: boolean
}

export interface PendingChip {
  slug: string
  label: string
  type: string
  value?: string
  kicad_symbol?: string
  pins: Array<{ id: string; label: string; type: string }>
}

/** User preference when both a native Wokwi part and a custom chip exist */
export type WokwiPartChoice = 'native' | 'custom'

export type PositionMap = Record<string, { x: number; y: number }>
