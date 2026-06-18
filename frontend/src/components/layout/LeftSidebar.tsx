export default function LeftSidebar() {
  return (
    <aside className="w-56 min-w-56 flex flex-col bg-c-panel border-r border-c-border relative z-20">
      {/* Logo */}
      <div className="px-5 pt-7 pb-6 border-b border-c-border">
        <p className="font-px text-[11px] text-slate-100 leading-loose tracking-wide">
          COSMOS<br />
          <span className="text-violet-400">ARCADE</span>
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {/* Home — active */}
        <div className="relative flex items-center gap-3 px-5 py-4 cursor-pointer
          bg-violet-900/20 text-slate-100
          font-mono text-sm font-bold uppercase tracking-wide"
        >
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500" />
          <span className="text-base w-5 text-center">⊞</span>
          Home
        </div>

        {/* Tournaments — disabled */}
        <div className="relative flex items-center gap-3 px-5 py-4
          text-slate-600 pointer-events-none select-none
          font-mono text-sm font-bold uppercase tracking-wide"
        >
          <span className="text-base w-5 text-center opacity-50">⚔</span>
          <span className="opacity-50">Tournaments</span>
          <span className="ml-auto font-mono text-[9px] font-bold text-amber-500
            border border-amber-600/30 bg-amber-500/10 px-1.5 py-0.5 tracking-wider opacity-80">
            SOON
          </span>
        </div>
      </nav>
    </aside>
  )
}
