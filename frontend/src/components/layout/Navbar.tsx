import ConnectButton from '../wallet/ConnectButton'

export default function Navbar() {
  return (
    <header className="h-[66px] min-h-[66px] flex items-center justify-between px-6
      bg-c-panel border-b border-c-border relative z-10 flex-shrink-0">
      <div className="font-px text-[11px] text-slate-100 tracking-wide leading-relaxed">
        COSMOS<span className="text-violet-400">ARCADE</span>
      </div>
      <ConnectButton />
    </header>
  )
}
