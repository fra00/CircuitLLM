import type { LlmConfig } from '../../types/llm'
import { callLlmText } from '../llm/client'
import { extractJson } from '../llm/validate'
import { PRESETS } from '../../data/providerPresets'
import type { CustomChipFiles, PendingChip, WokwiChipJson } from './types'

/**
 * Wokwi Chips API (see wokwi-api.h / docs):
 * - void chip_init(void);  // NOT void*
 * - timer_init(&timer_config_t) / timer_start(timer, micros, repeat)
 * - pin watches via pin_watch_config_t.user_data
 */
const CHIP_SYSTEM_PROMPT = `You are an expert at writing Wokwi custom chips (C API + chip JSON).
Respond with ONLY a JSON object (no markdown) of this shape:
{
  "chipJson": {
    "name": string,
    "author": "CircuitLLM",
    "pins": string[],
    "controls": optional array of { id, label, type: "range", min, max, step }
  },
  "chipC": string
}

Rules for chipJson.pins:
- Use EXACTLY the pin ids provided by the user, in the same order.
- No spaces in pin names.

Rules for chipC — MUST match the current Wokwi Chips C API:
- Always #include "wokwi-api.h", <stdio.h>, and <stdlib.h> if you use malloc.
- Signature MUST be exactly: void chip_init(void);
  Do NOT return a value from chip_init. Store state with malloc and pass it via user_data.
- pin_init(name, mode) returns pin_t. Modes: INPUT, OUTPUT, INPUT_PULLUP, ANALOG, etc.
- pin_write(pin, value) is DIGITAL only: value must be HIGH or LOW (or 1 / 0). NEVER pass volts like 7.4 or 3.3.
- For analog voltages use pin_dac_write(pin, float_volts) only after pin_init(..., ANALOG). Prefer digital HIGH/LOW for power rails.
- Pin watch example:
  const pin_watch_config_t watch = { .edge = BOTH, .pin_change = my_cb, .user_data = chip };
  pin_watch(pin, &watch);
- Timer example:
  const timer_config_t tcfg = { .callback = my_timer_cb, .user_data = chip };
  timer_t timer = timer_init(&tcfg);
  timer_start(timer, 1000, true);  // micros, repeat — exactly 3 args
- Keep code self-contained and compilable by Wokwi.
- For batteries / power packs: ONLY pin_init + pin_write(POS, HIGH) / pin_write(NEG, LOW). No timers, no floats.
- Do not wrap chipC in markdown fences.`

function buildUserPrompt(chip: PendingChip): string {
  return `Create a Wokwi custom chip for this circuit component:

slug: ${chip.slug}
label: ${chip.label}
type: ${chip.type}
value: ${chip.value ?? '(none)'}
kicad_symbol: ${chip.kicad_symbol ?? '(none)'}
pins (use these exact ids, in order):
${chip.pins.map((p, i) => `  ${i + 1}. id=${p.id} label=${p.label} type=${p.type}`).join('\n')}

Return JSON with chipJson and chipC only. chip_init must be void chip_init(void).`
}

/** Minimal stub that matches wokwi-api.h (void chip_init). */
export function stubChipC(chip: PendingChip): string {
  const isPower =
    chip.type === 'POWER_SUPPLY' ||
    chip.type === 'POWER_RAIL' ||
    /batt|battery|lipo|supply|vcc|power/i.test(`${chip.slug} ${chip.label}`)

  const pinFields = chip.pins
    .map((p) => `  pin_t pin_${sanitizeCIdent(p.id)};`)
    .join('\n')

  const pinInits = chip.pins
    .map((p) => {
      const mode =
        isPower || p.type === 'OUTPUT' || p.type === 'POWER_OUT'
          ? 'OUTPUT'
          : 'INPUT'
      return `  chip->pin_${sanitizeCIdent(p.id)} = pin_init("${p.id}", ${mode});`
    })
    .join('\n')

  const powerWrites = isPower
    ? chip.pins
        .map((p) => {
          const id = p.id.toUpperCase()
          const field = `chip->pin_${sanitizeCIdent(p.id)}`
          if (/NEG|GND|V-|MINUS/.test(id) || (id === '2' && chip.pins.length === 2)) {
            return `  pin_write(${field}, LOW);`
          }
          if (/POS|VCC|V\+|PLUS|OUT|12V|5V|3V3|VIN/.test(id) || id === '1') {
            return `  pin_write(${field}, HIGH);`
          }
          return `  pin_write(${field}, HIGH);`
        })
        .join('\n')
    : ''

  return `// Auto-generated stub for ${chip.label} (${chip.slug})
#include "wokwi-api.h"
#include <stdio.h>
#include <stdlib.h>

typedef struct {
${pinFields || '  pin_t unused;'}
} chip_state_t;

void chip_init(void) {
  chip_state_t *chip = malloc(sizeof(chip_state_t));
${pinInits || '  (void)chip;'}
${powerWrites}
  printf("Chip ${chip.slug} initialized (stub)\\n");
}
`
}

function sanitizeCIdent(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, '_')
  return /^[0-9]/.test(cleaned) ? `p_${cleaned}` : cleaned
}

function stubChipJson(chip: PendingChip): WokwiChipJson {
  return {
    name: chip.label || chip.slug,
    author: 'CircuitLLM',
    pins: chip.pins.map((p) => p.id),
  }
}

/**
 * Fixes common LLM mistakes against the current Wokwi Chips API.
 * Returns null if the code still looks unsalvageable (caller should use stub).
 */
export function sanitizeChipC(source: string): string | null {
  let code = source.trim()
  if (!code) return null

  // Ensure required headers
  if (!/#include\s*"wokwi-api\.h"/.test(code)) {
    code = `#include "wokwi-api.h"\n${code}`
  }
  if (/\bmalloc\s*\(/.test(code) && !/#include\s*<stdlib\.h>/.test(code)) {
    code = code.replace(
      /#include\s*"wokwi-api\.h"/,
      '#include "wokwi-api.h"\n#include <stdlib.h>',
    )
  }
  if (/\bprintf\s*\(/.test(code) && !/#include\s*<stdio\.h>/.test(code)) {
    code = code.replace(
      /#include\s*"wokwi-api\.h"/,
      '#include "wokwi-api.h"\n#include <stdio.h>',
    )
  }

  // void *chip_init(...) → void chip_init(void)
  code = code.replace(
    /\bvoid\s*\*\s*chip_init\s*\([^)]*\)/,
    'void chip_init(void)',
  )
  // Also "void* chip_init"
  code = code.replace(
    /\bvoid\s*\*\s*chip_init\s*\(/,
    'void chip_init(',
  )

  // Drop "return chip;" / "return <ptr>;" inside chip_init bodies (best-effort)
  code = code.replace(
    /(void\s+chip_init\s*\(\s*void\s*\)\s*\{[\s\S]*?)(\breturn\s+[^;]+;\s*)/m,
    '$1',
  )

  // timer_init() → timer_init(&timer_config) is hard to auto-fix; flag bad calls
  if (/\btimer_init\s*\(\s*\)/.test(code)) {
    return null
  }
  // timer_start with 4+ args (old wrong API)
  if (/\btimer_start\s*\([^;]*,[^;]*,[^;]*,/.test(code)) {
    return null
  }

  // pin_write(pin, 7.4) — digital API rejects floats; try rewrite to HIGH/LOW or fail
  if (/\bpin_write\s*\([^)]*,\s*\d+\.\d+\s*\)/.test(code)) {
    // Common LLM mistake: volts into pin_write. Replace float with HIGH (best-effort).
    code = code.replace(
      /\bpin_write\s*\(([^,]+),\s*\d+\.\d+\s*\)/g,
      'pin_write($1, HIGH)',
    )
  }
  // Still reject scientific / other float forms into pin_write
  if (/\bpin_write\s*\([^)]*,\s*[^)]*\d+\.\d+[^)]*\)/.test(code)) {
    return null
  }

  // Must declare chip_init correctly
  if (!/\bvoid\s+chip_init\s*\(\s*(void)?\s*\)/.test(code)) {
    return null
  }
  // Reject remaining void* chip_init
  if (/\bvoid\s*\*\s*chip_init\b/.test(code)) {
    return null
  }

  return code
}

/** Power packs rarely need LLM logic — stubs are safer and always compile. */
export function shouldSkipLlmForChip(chip: PendingChip): boolean {
  if (chip.type === 'POWER_SUPPLY' || chip.type === 'POWER_RAIL') return true
  return /batt|battery|lipo|power.?pack|alimentat/i.test(
    `${chip.slug} ${chip.label} ${chip.value ?? ''}`,
  )
}

function normalizeChipJson(
  raw: unknown,
  chip: PendingChip,
): WokwiChipJson {
  const expected = chip.pins.map((p) => p.id)
  if (!raw || typeof raw !== 'object') {
    return stubChipJson(chip)
  }
  const obj = raw as Record<string, unknown>
  const name =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : chip.label || chip.slug
  let pins: string[] = expected
  if (Array.isArray(obj.pins) && obj.pins.every((p) => typeof p === 'string')) {
    const fromLlm = obj.pins as string[]
    const set = new Set(fromLlm)
    if (expected.every((p) => set.has(p)) && fromLlm.length === expected.length) {
      pins = fromLlm
    } else {
      pins = expected
    }
  }
  const result: WokwiChipJson = {
    name,
    author: 'CircuitLLM',
    pins,
  }
  if (Array.isArray(obj.controls)) {
    result.controls = obj.controls as WokwiChipJson['controls']
  }
  return result
}

function parseChipResponse(
  text: string,
  chip: PendingChip,
): CustomChipFiles {
  const parsed = extractJson(text) as Record<string, unknown>
  const chipJson = normalizeChipJson(parsed.chipJson ?? parsed, chip)
  let chipC =
    typeof parsed.chipC === 'string'
      ? parsed.chipC
      : typeof parsed.chip_c === 'string'
        ? parsed.chip_c
        : ''
  chipC = chipC.replace(/^```(?:c|cpp)?\s*/i, '').replace(/```\s*$/i, '').trim()

  const sanitized = sanitizeChipC(chipC)
  if (!sanitized) {
    return {
      slug: chip.slug,
      chipJson,
      chipC: stubChipC(chip),
      fromLlm: false,
    }
  }

  return {
    slug: chip.slug,
    chipJson,
    chipC: sanitized,
    fromLlm: true,
  }
}

export function canCallLlm(config: LlmConfig): boolean {
  const preset = PRESETS[config.provider]
  if (!preset.requiresKey) return true
  return config.apiKey.trim().length > 0
}

export function buildStubChip(chip: PendingChip): CustomChipFiles {
  return {
    slug: chip.slug,
    chipJson: stubChipJson(chip),
    chipC: stubChipC(chip),
    fromLlm: false,
  }
}

/**
 * Generates chip.json + chip.c for one pending custom chip via LLM.
 * On failure returns a pinout stub so export can still proceed.
 */
export async function generateCustomChip(
  config: LlmConfig,
  chip: PendingChip,
): Promise<{ files: CustomChipFiles; warning?: string }> {
  if (shouldSkipLlmForChip(chip)) {
    return {
      files: buildStubChip(chip),
      warning: `Chip "${chip.slug}": alimentatore/batteria → stub digitale HIGH/LOW (niente LLM).`,
    }
  }

  if (!canCallLlm(config)) {
    return {
      files: buildStubChip(chip),
      warning: `LLM non configurato: stub per chip "${chip.slug}". Apri ⚙ → LLM settings.`,
    }
  }

  try {
    const raw = await callLlmText(config, [
      { role: 'system', content: CHIP_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(chip) },
    ])
    const files = parseChipResponse(raw, chip)
    if (!files.fromLlm) {
      return {
        files,
        warning: `Chip "${chip.slug}": codice LLM non compatibile con wokwi-api.h — usato stub compilabile.`,
      }
    }
    return { files }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      files: buildStubChip(chip),
      warning: `LLM fallito per "${chip.slug}" (${message}): usato stub pinout.`,
    }
  }
}
