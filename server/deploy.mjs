/**
 * Deploy the CosmosArcade escrow contract.
 *
 * Usage:
 *   node deploy.mjs
 *
 * Required env vars (in server/.env or export):
 *   SERVER_MNEMONIC   — wallet that pays gas AND becomes the game_server authority
 *   RPC_URL           — chain RPC endpoint
 *   CHAIN_PREFIX      — bech32 prefix  (cosmos / neutron / etc.)
 *   GAS_DENOM         — gas fee denom  (uatom / untrn / etc.)
 *
 * Chain presets (copy the block you want into server/.env):
 *
 *   # Cosmos Hub testnet (theta-testnet-001) — cosmos1 addresses, uatom
 *   RPC_URL=https://rpc.sentry-01.theta-testnet.polypore.xyz
 *   CHAIN_PREFIX=cosmos
 *   GAS_DENOM=uatom
 *
 *   # Neutron testnet (pion-1) — neutron1 addresses, untrn
 *   RPC_URL=https://rpc-palvus.pion.rs
 *   CHAIN_PREFIX=neutron
 *   GAS_DENOM=untrn
 *
 *   # Cosmos Hub mainnet — cosmos1 addresses, uatom (permissioned; governance needed)
 *   RPC_URL=https://rpc.cosmos.network:443
 *   CHAIN_PREFIX=cosmos
 *   GAS_DENOM=uatom
 *
 * After deploy, add to frontend/.env:
 *   VITE_ESCROW_ADDRESS=<contract address printed below>
 * And to server/.env:
 *   CONTRACT_ADDRESS=<contract address>
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dir = dirname(fileURLToPath(import.meta.url))

// Load .env from server dir
require('dotenv').config({ path: join(__dir, '.env') })

const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing')
const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate')

const MNEMONIC     = process.env.SERVER_MNEMONIC
const RPC          = process.env.RPC_URL          || 'https://rpc.sentry-01.theta-testnet.polypore.xyz'
const PREFIX       = process.env.CHAIN_PREFIX     || 'cosmos'
const GAS_DENOM    = process.env.GAS_DENOM        || 'uatom'
const GAS_PRICE    = process.env.GAS_PRICE        || '0.025'

const WASM = join(__dir, '../contracts/target/wasm32-unknown-unknown/release/cosmos_arcade_escrow_opt.wasm')

if (!MNEMONIC) {
  console.error('ERROR: SERVER_MNEMONIC not set')
  console.error('Generate one with: node -e "const {Bip39,Random}=require(\'@cosmjs/crypto\'); console.log(Bip39.encode(Random.getBytes(32)).toString())"')
  process.exit(1)
}

const wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: PREFIX })
const [account] = await wallet.getAccounts()

console.log('Deployer :', account.address)
console.log('RPC      :', RPC)

const client = await SigningCosmWasmClient.connectWithSigner(RPC, wallet)

const bal = await client.getBalance(account.address, GAS_DENOM)
console.log('Balance  :', bal.amount, bal.denom)

if (BigInt(bal.amount) === 0n) {
  console.error(`\nERROR: ${account.address} has no ${GAS_DENOM}.`)
  console.error('Fund it from a faucet first, then re-run.')
  process.exit(1)
}

// Conservative explicit fees (avoids auto-gas version mismatch)
const uploadFee   = { amount: [{ denom: GAS_DENOM, amount: '500000' }], gas: '20000000' }
const instantiateFee = { amount: [{ denom: GAS_DENOM, amount: '100000' }], gas: '500000' }

// ── 1. Upload ─────────────────────────────────────────────────────────────────
console.log('\nUploading wasm…')
const wasm = readFileSync(WASM)
const upload = await client.upload(account.address, wasm, uploadFee)
console.log('Code ID  :', upload.codeId)
console.log('TX       :', upload.transactionHash)

// ── 2. Instantiate ────────────────────────────────────────────────────────────
console.log('\nInstantiating…')
const { contractAddress } = await client.instantiate(
  account.address,
  upload.codeId,
  { game_server: account.address },
  'CosmosArcade Escrow v1',
  instantiateFee
)

console.log('\n✅  Done!')
console.log('Contract :', contractAddress)
console.log('\nAdd to frontend/.env:')
console.log(`  VITE_ESCROW_ADDRESS=${contractAddress}`)
console.log('\nAdd to server/.env:')
console.log(`  CONTRACT_ADDRESS=${contractAddress}`)
