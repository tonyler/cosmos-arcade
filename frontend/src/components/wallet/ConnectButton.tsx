import { useWalletStore } from '../../store/walletStore'
import { truncate } from '../../lib/format'

function makeIdenticon(address: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')!
  let h = 0
  for (let i = 0; i < address.length; i++)
    h = (Math.imul(31, h) + address.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  ctx.fillStyle = '#1e2d47'
  ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = `hsl(${hue}, 65%, 65%)`
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((h >> (y * 3 + x)) & 1) {
        ctx.fillRect(x * 5 + 3, y * 5 + 3, 4, 4)
        if (x < 2) ctx.fillRect(24 - x * 5, y * 5 + 3, 4, 4)
      }
    }
  }
  return canvas.toDataURL()
}

export default function ConnectButton() {
  const { connected, address, connect, disconnect } = useWalletStore()

  if (connected && address) {
    return (
      <button
        onClick={disconnect}
        className="flex items-center gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2.5
          bg-c-surface2 border border-c-borderhi
          font-mono text-xs font-bold text-slate-300 uppercase tracking-wide
          shadow-[0_2px_0_#08101e] md:shadow-[0_3px_0_#08101e]
          hover:border-violet-500/60 hover:bg-violet-900/20
          active:translate-y-[2px] active:shadow-none
          transition-all duration-75"
      >
        <img
          src={makeIdenticon(address)}
          className="w-5 h-5 md:w-6 md:h-6 block"
          style={{ imageRendering: 'pixelated' }}
          alt="avatar"
        />
        <span className="hidden sm:block text-slate-400 text-xs">{truncate(address)}</span>
      </button>
    )
  }

  return (
    <button
      onClick={connect}
      className="px-3 py-2 md:px-6 md:py-3
        bg-violet-700 text-white
        font-mono text-xs md:text-sm font-bold uppercase tracking-widest
        shadow-[0_3px_0_#3b0f8a] md:shadow-[0_5px_0_#3b0f8a]
        hover:bg-violet-600
        active:translate-y-[3px] active:shadow-none
        transition-all duration-75
        [clip-path:polygon(0_0,calc(100%-6px)_0,100%_6px,100%_100%,6px_100%,0_calc(100%-6px))]
        md:[clip-path:polygon(0_0,calc(100%-8px)_0,100%_8px,100%_100%,8px_100%,0_calc(100%-8px))]"
    >
      <span className="sm:hidden">Connect</span>
      <span className="hidden sm:inline">Connect Wallet</span>
    </button>
  )
}
