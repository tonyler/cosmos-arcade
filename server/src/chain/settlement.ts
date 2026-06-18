import { getSigner } from './signer'

const CONTRACT = process.env.CONTRACT_ADDRESS ?? process.env.ESCROW_ADDRESS ?? ''

export async function settleMatch(matchId: string, winner: string): Promise<string> {
  if (!CONTRACT) {
    console.warn('[settlement] ESCROW_ADDRESS not set — skipping on-chain settlement')
    return 'skipped'
  }
  const { client, address } = await getSigner()
  const res = await client.execute(
    address,
    CONTRACT,
    { settle_match: { match_id: matchId, winner } },
    'auto'
  )
  console.log(`[settlement] match=${matchId} winner=${winner} tx=${res.transactionHash}`)
  return res.transactionHash
}
