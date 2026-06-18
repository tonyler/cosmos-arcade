import { create } from 'zustand'
import { connectKeplr } from '../lib/keplr'
import { getBalances } from '../lib/cosmjs'
import { ws } from '../lib/ws'

interface WalletState {
  connected: boolean
  address: string | null
  username: string | null
  balance: string | null
  connect: () => Promise<void>
  disconnect: () => void
  setUsername: (name: string) => void
}

export const useWalletStore = create<WalletState>((set) => ({
  connected: false,
  address: null,
  username: null,
  balance: null,
  connect: async () => {
    const { address } = await connectKeplr()
    set({ connected: true, address, username: null })
    ws.connect(address)
    getBalances(address).then((coins) => {
      const atom = coins.find((c) => c.denom === 'uatom')
      if (atom) {
        const amt = (Number(atom.amount) / 1_000_000).toFixed(2)
        set({ balance: `${amt} ATOM` })
      }
    }).catch(() => {})
  },
  disconnect: () => set({ connected: false, address: null, username: null, balance: null }),
  setUsername: (name) => set({ username: name }),
}))
