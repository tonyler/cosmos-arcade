import { getSigner } from './signer'

const CONTRACT = process.env.CONTRACT_ADDRESS ?? process.env.ESCROW_ADDRESS ?? ''

async function execContract(msg: object, label: string): Promise<string> {
  if (!CONTRACT) {
    console.warn(`[settlement] ESCROW_ADDRESS not set — skipping ${label}`)
    return 'skipped'
  }
  const { client, address } = await getSigner()
  const res = await client.execute(address, CONTRACT, msg, 'auto')
  console.log(`[settlement] ${label} tx=${res.transactionHash}`)
  return res.transactionHash
}

export async function settleMatch(matchId: string, winner: string): Promise<string> {
  return execContract({ settle_match: { match_id: matchId, winner } }, `settle match=${matchId} winner=${winner}`)
}

export async function cancelMatchOnChain(matchId: string): Promise<string> {
  return execContract({ cancel_match: { match_id: matchId } }, `cancel match=${matchId}`)
}

export async function abortMatchOnChain(matchId: string): Promise<string> {
  return execContract({ abort_match: { match_id: matchId } }, `abort match=${matchId}`)
}
