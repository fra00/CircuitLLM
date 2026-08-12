import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  downloadDataUrl,
  downloadSchematicPng,
  registerSchematicPngExporter,
  toSafePngFileName,
} from './pngExport'

describe('toSafePngFileName', () => {
  it('sanitizes forbidden characters and adds .png', () => {
    expect(toSafePngFileName('Robot: Controller?/v1')).toBe('Robot__Controller__v1.png')
  })

  it('falls back when name is empty', () => {
    expect(toSafePngFileName('   ')).toBe('circuit.png')
  })
})

describe('downloadDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('triggers an anchor download with the given filename', () => {
    const click = vi.fn()
    const remove = vi.fn()
    const append = vi.fn()
    const anchor = { href: '', download: '', click, remove }

    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { append, appendChild: append },
    })

    downloadDataUrl('demo.png', 'data:image/png;base64,abc')

    expect(anchor.href).toBe('data:image/png;base64,abc')
    expect(anchor.download).toBe('demo.png')
    expect(append).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
  })
})

describe('registerSchematicPngExporter', () => {
  afterEach(() => {
    registerSchematicPngExporter(null)
  })

  it('invokes the registered exporter', async () => {
    const exporter = vi.fn().mockResolvedValue(undefined)
    registerSchematicPngExporter(exporter)
    await downloadSchematicPng()
    expect(exporter).toHaveBeenCalledOnce()
  })

  it('throws when no exporter is registered', async () => {
    registerSchematicPngExporter(null)
    await expect(downloadSchematicPng()).rejects.toThrow(/Canvas non pronto/)
  })
})
