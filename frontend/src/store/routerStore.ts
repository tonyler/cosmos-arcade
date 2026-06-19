import { create } from 'zustand'

interface RouterState {
  currentGame: string | null
  settingsOpen: boolean
  navigate: (slug: string | null) => void
  toggleSettings: () => void
}

export const useRouterStore = create<RouterState>((set) => ({
  currentGame: null,
  settingsOpen: false,
  navigate: (slug) => set({ currentGame: slug }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
}))
