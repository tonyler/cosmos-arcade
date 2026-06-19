import { create } from 'zustand'

interface RouterState {
  currentGame: string | null
  settingsOpen: boolean
  publicGamesOpen: boolean
  navigate: (slug: string | null) => void
  toggleSettings: () => void
  togglePublicGames: () => void
}

export const useRouterStore = create<RouterState>((set) => ({
  currentGame: null,
  settingsOpen: false,
  publicGamesOpen: false,
  navigate: (slug) => set({ currentGame: slug, settingsOpen: false, publicGamesOpen: false }),
  toggleSettings: () => set((s) => ({
    settingsOpen: !s.settingsOpen,
    publicGamesOpen: false,
  })),
  togglePublicGames: () => set((s) => ({
    publicGamesOpen: !s.publicGamesOpen,
    settingsOpen: false,
  })),
}))
