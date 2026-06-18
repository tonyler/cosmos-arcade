import { StargateClient } from '@cosmjs/stargate'

const RPC = import.meta.env.VITE_RPC_URL ?? 'https://rpc.cosmos.network:443'

let _client: StargateClient | null = null

async function client(): Promise<StargateClient> {
  if (!_client) _client = await StargateClient.connect(RPC)
  return _client
}

export async function getBalances(address: string) {
  return (await client()).getAllBalances(address)
}

export async function getBalance(address: string, denom: string) {
  return (await client()).getBalance(address, denom)
}
