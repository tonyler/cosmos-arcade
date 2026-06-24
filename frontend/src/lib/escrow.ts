import { SigningCosmWasmClient, CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'
import { CHAIN_ID } from './keplr'

const RPC = import.meta.env.VITE_RPC_URL ?? 'https://rpc.cosmos.network:443'
const GAS_PRICE = GasPrice.fromString('0.025uatom')
export const CONTRACT_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS ?? ''

export type Denom = 'uatom' | 'uusdc'

export interface MatchEscrow {
  matchId: string
  opponent: string | null  // null = public match, address = private
  amount: string           // in uatom / uusdc
  denom: Denom
}

export interface MatchState {
  matchId: string
  challenger: string
  opponent: string | null
  amount: string
  denom: string
  status: 'Pending' | 'Active' | 'Complete' | 'Refunded'
  winner: string | null
}

async function signingClient(): Promise<SigningCosmWasmClient> {
  if (!window.keplr) throw new Error('Keplr not found')
  const signer = window.keplr.getOfflineSigner(CHAIN_ID)
  return SigningCosmWasmClient.connectWithSigner(RPC, signer, { gasPrice: GAS_PRICE })
}

function requireContract() {
  if (!CONTRACT_ADDRESS) throw new Error('VITE_ESCROW_ADDRESS not set')
}

/** Player A — creates the match and locks funds */
export async function lockFunds(from: string, escrow: MatchEscrow): Promise<string> {
  requireContract()
  const client = await signingClient()
  const msg = { create_match: { match_id: escrow.matchId, opponent: escrow.opponent } }
  const funds = [{ denom: escrow.denom, amount: escrow.amount }]
  const res = await client.execute(from, CONTRACT_ADDRESS, msg, 'auto', undefined, funds)
  return res.transactionHash
}

/** Player B — joins match and locks matching funds */
export async function acceptMatch(from: string, matchId: string, amount: string, denom: Denom): Promise<string> {
  requireContract()
  const client = await signingClient()
  const msg = { accept_match: { match_id: matchId } }
  const funds = [{ denom, amount }]
  const res = await client.execute(from, CONTRACT_ADDRESS, msg, 'auto', undefined, funds)
  return res.transactionHash
}

/** Query current match state from chain (read-only, no wallet required) */
export async function queryMatch(matchId: string): Promise<MatchState> {
  requireContract()
  const client = await CosmWasmClient.connect(import.meta.env.VITE_RPC_URL ?? 'https://rpc.cosmos.network:443')
  const res = await client.queryContractSmart(CONTRACT_ADDRESS, { match: { match_id: matchId } })
  return {
    matchId: res.match_id,
    challenger: res.challenger,
    opponent: res.opponent ?? null,
    amount: res.amount,
    denom: res.denom,
    status: res.status,
    winner: res.winner ?? null,
  }
}
