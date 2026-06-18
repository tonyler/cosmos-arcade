import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'

const MNEMONIC = process.env.SERVER_MNEMONIC ?? ''
const RPC = process.env.RPC_URL ?? 'https://rpc.cosmos.network:443'
const GAS_PRICE = GasPrice.fromString(`${process.env.GAS_PRICE ?? '0.025'}${process.env.GAS_DENOM ?? 'uatom'}`)

let _wallet: DirectSecp256k1HdWallet | null = null
let _client: SigningCosmWasmClient | null = null

export async function getSigner() {
  if (!MNEMONIC) throw new Error('SERVER_MNEMONIC not set')
  if (!_wallet) _wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'cosmos' })
  if (!_client) _client = await SigningCosmWasmClient.connectWithSigner(RPC, _wallet, { gasPrice: GAS_PRICE })
  const [account] = await _wallet.getAccounts()
  return { client: _client, address: account.address }
}
