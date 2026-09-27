import { create } from 'zustand'
import type { WokwiPartChoice } from '../utils/wokwi/types'

interface WokwiStoreState {
  /** preferenceKey → native | custom (remembered for this project session + file) */
  choices: Record<string, WokwiPartChoice>
  setChoice: (key: string, choice: WokwiPartChoice) => void
  setChoices: (choices: Record<string, WokwiPartChoice>) => void
  clearChoices: () => void
}

export const useWokwiStore = create<WokwiStoreState>((set) => ({
  choices: {},

  setChoice: (key, choice) =>
    set((state) => ({ choices: { ...state.choices, [key]: choice } })),

  setChoices: (choices) => set({ choices: { ...choices } }),

  clearChoices: () => set({ choices: {} }),
}))
