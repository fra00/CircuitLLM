import { describe, expect, it } from 'vitest'
import { buildStubChip, sanitizeChipC, shouldSkipLlmForChip, stubChipC } from './generateChip'
import type { PendingChip } from './types'

const battery: PendingChip = {
  slug: 'battery-pack',
  label: 'Battery_Pack',
  type: 'POWER_SUPPLY',
  value: '7.4V_LiPo',
  pins: [
    { id: 'POS', label: 'POS', type: 'POWER_OUT' },
    { id: 'NEG', label: 'NEG', type: 'POWER_OUT' },
  ],
}

describe('stubChipC', () => {
  it('uses void chip_init(void) matching wokwi-api.h', () => {
    const c = stubChipC(battery)
    expect(c).toMatch(/void\s+chip_init\s*\(\s*void\s*\)/)
    expect(c).not.toMatch(/void\s*\*\s*chip_init/)
    expect(c).toContain('#include <stdlib.h>')
    expect(c).toContain('pin_init("POS"')
    expect(c).toContain('pin_init("NEG"')
  })
})

describe('sanitizeChipC', () => {
  it('rewrites void* chip_init to void chip_init', () => {
    const bad = `
#include "wokwi-api.h"
#include <stdlib.h>
typedef struct { pin_t a; } chip_state_t;
void *chip_init(void) {
  chip_state_t *chip = malloc(sizeof(chip_state_t));
  chip->a = pin_init("POS", OUTPUT);
  return chip;
}
`
    const fixed = sanitizeChipC(bad)
    expect(fixed).toBeTruthy()
    expect(fixed!).toMatch(/void\s+chip_init\s*\(\s*void\s*\)/)
    expect(fixed!).not.toMatch(/void\s*\*\s*chip_init/)
    expect(fixed!).not.toMatch(/\breturn\s+chip\s*;/)
  })

  it('rejects timer_init() with no config / 4-arg timer_start', () => {
    const badTimer = `
#include "wokwi-api.h"
#include <stdlib.h>
void chip_init(void) {
  timer_t timer = timer_init();
  timer_start(timer, 100000, chip_timer_event, chip);
}
`
    expect(sanitizeChipC(badTimer)).toBeNull()
  })

  it('rewrites pin_write(..., 7.4) to HIGH', () => {
    const bad = `
#include "wokwi-api.h"
#include <stdlib.h>
typedef struct { pin_t pos; } chip_state_t;
void chip_init(void) {
  chip_state_t *chip = malloc(sizeof(chip_state_t));
  chip->pos = pin_init("POS", OUTPUT);
  pin_write(chip->pos, 7.4);
}
`
    const fixed = sanitizeChipC(bad)
    expect(fixed).toContain('pin_write(chip->pos, HIGH)')
    expect(fixed).not.toContain('7.4')
  })

  it('battery stub uses HIGH/LOW not volts', () => {
    const c = stubChipC(battery)
    expect(c).toContain('pin_write(chip->pin_POS, HIGH)')
    expect(c).toContain('pin_write(chip->pin_NEG, LOW)')
    expect(c).not.toMatch(/\d+\.\d+/)
  })
})

describe('buildStubChip', () => {
  it('returns compilable stub metadata', () => {
    const files = buildStubChip(battery)
    expect(files.fromLlm).toBe(false)
    expect(files.chipJson.pins).toEqual(['POS', 'NEG'])
    expect(files.chipC).toContain('void chip_init(void)')
  })
})

describe('shouldSkipLlmForChip', () => {
  it('skips LLM for batteries / power supplies', () => {
    expect(shouldSkipLlmForChip(battery)).toBe(true)
  })
})
