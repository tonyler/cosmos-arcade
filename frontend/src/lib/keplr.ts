import type { Window as KeplrWindow } from '@keplr-wallet/types'

declare global { interface Window extends KeplrWindow {} }

export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID ?? 'cosmoshub-4'

export async function connectKeplr(): Promise<{ address: string }> {
  if (!window.keplr) throw new Error('Keplr extension not found. Install it from keplr.app')
  await window.keplr.enable(CHAIN_ID)
  const key = await window.keplr.getKey(CHAIN_ID)
  return { address: key.bech32Address }
}

export async function signArbitrary(address: string, data: string): Promise<string> {
  if (!window.keplr) throw new Error('Keplr not found')
  const sig = await window.keplr.signArbitrary(CHAIN_ID, address, data)
  return JSON.stringify(sig)
}
