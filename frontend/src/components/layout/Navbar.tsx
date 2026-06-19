import ConnectButton from '../wallet/ConnectButton'

export default function Navbar() {
  return (
    <header className="h-[56px] md:h-[66px] min-h-[56px] md:min-h-[66px] flex items-center justify-between px-4 md:px-6
      bg-c-panel border-b border-c-border relative z-10 flex-shrink-0">

      {/* Logo — visible on mobile (sidebar hidden), hidden on desktop (sidebar shows it) */}
      <div className="font-px text-[9px] md:text-[11px] text-slate-100 tracking-wide leading-relaxed md:hidden">
        COSMOS<span className="text-violet-400">ARCADE</span>
      </div>
      {/* Desktop spacer so ConnectButton stays right-aligned */}
      <div className="hidden md:block" />

      <ConnectButton />
    </header>
  )
}
