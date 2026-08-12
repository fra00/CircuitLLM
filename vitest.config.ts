import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: [
        'src/utils/**',
        'src/store/**',
        'src/data/componentPalette.ts',
        'src/data/providerPresets.ts',
        'src/data/sampleCircuit.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 55,
      },
    },
  },
})
