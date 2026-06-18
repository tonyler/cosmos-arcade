import { useWalletStore } from '../store/walletStore'
import { signArbitrary } from '../lib/keplr'

export function useUsername() {
  const { address, username, setUsername } = useWalletStore()

  async function registerUsername(name: string) {
    if (!address) throw new Error('Wallet not connected')
    const sig = await signArbitrary(address, `register:${name}`)
    const res = await fetch('/api/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, username: name, sig }),
    })
    if (!res.ok) throw new Error('Registration failed')
    setUsername(name)
  }

  return { username, registerUsername }
}
