import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { GasPrice } from '@cosmjs/stargate'
import { readFileSync } from 'fs'

const MNEMONIC = 'REDACTED_MNEMONIC'
const RPC = 'https://cosmos-rpc.publicnode.com'
const WASM_PATH = '/home/cosmos-arcade/contracts/target/wasm32-unknown-unknown/release/cosmos_arcade_escrow_opt.wasm'

async function main() {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'cosmos' })
  const [account] = await wallet.getAccounts()
  console.log('Deploying from:', account.address)

  const client = await SigningCosmWasmClient.connectWithSigner(RPC, wallet, {
    gasPrice: GasPrice.fromString('0.025uatom'),
  })

  const balance = await client.getBalance(account.address, 'uatom')
  console.log('Balance:', balance.amount, 'uatom')

  // Upload contract
  console.log('Uploading wasm...')
  const wasm = readFileSync(WASM_PATH)
  const uploadResult = await client.upload(account.address, wasm, 'auto')
  console.log('Code ID:', uploadResult.codeId)
  console.log('Upload tx:', uploadResult.transactionHash)

  // Instantiate contract
  console.log('Instantiating...')
  const initResult = await client.instantiate(
    account.address,
    uploadResult.codeId,
    { game_server: account.address, allowed_denoms: ['uatom'] },
    'Cosmos Arcade Escrow',
    'auto',
  )
  console.log('Contract address:', initResult.contractAddress)
  console.log('Instantiate tx:', initResult.transactionHash)
}

main().catch((e) => { console.error(e); process.exit(1) })
