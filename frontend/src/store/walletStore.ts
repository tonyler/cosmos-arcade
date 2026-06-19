import { create } from 'zustand'
import { connectKeplr } from '../lib/keplr'
import { getBalances } from '../lib/cosmjs'
import { ws } from '../lib/ws'

const getOrCreateGuestId = (): string => {
  const stored = sessionStorage.getItem('guestId')
  if (stored) return stored
  const id = `guest-${crypto.randomUUID().slice(0, 8)}`
  sessionStorage.setItem('guestId', id)
  return id
}

interface WalletState {
  connected: boolean
  address: string | null
  username: string | null
  balance: string | null
  guestId: string
  connect: () => Promise<void>
  disconnect: () => void
  setUsername: (name: string) => void
  ensureWsConnected: () => void
}

export const useWalletStore = create<WalletState>((set, get) => ({
  connected: false,
  address: null,
  username: null,
  balance: null,
  guestId: getOrCreateGuestId(),
  connect: async () => {
    const { address } = await connectKeplr()
    set({ connected: true, address, username: null })
    ws.reconnect(address)
    fetch(import.meta.env.BASE_URL + `api/username/${address}`)
      .then((r) => r.json())
      .then((d) => { if (d.username) set({ username: d.username }) })
      .catch(() => {})
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
  ensureWsConnected: () => {
    if (ws.connected) return
    const { address, guestId } = get()
    ws.connect(address ?? guestId)
  },
}))
