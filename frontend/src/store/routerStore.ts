import { create } from 'zustand'

interface RouterState {
  currentGame: string | null
  navigate: (slug: string | null) => void
}

export const useRouterStore = create<RouterState>((set) => ({
  currentGame: null,
  navigate: (slug) => set({ currentGame: slug }),
}))
