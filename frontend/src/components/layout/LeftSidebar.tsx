import { useRouterStore } from '../../store/routerStore'

export default function LeftSidebar() {
  const settingsOpen = useRouterStore((s) => s.settingsOpen)
  const publicGamesOpen = useRouterStore((s) => s.publicGamesOpen)
  const togglePublicGames = useRouterStore((s) => s.togglePublicGames)
  const toggleSettings = useRouterStore((s) => s.toggleSettings)
  const navigate = useRouterStore((s) => s.navigate)

  const isHome = !settingsOpen && !publicGamesOpen

  return (
    <aside className="hidden md:flex w-56 min-w-56 flex-col bg-c-panel border-r border-c-border relative z-20">
      {/* Logo */}
      <div className="px-5 pt-7 pb-6 border-b border-c-border">
        <p className="font-px text-[11px] text-slate-100 leading-loose tracking-wide">
          COSMOS<br />
          <span className="text-violet-400">ARCADE</span>
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {/* Home */}
        <SidebarItem
          icon="⊞"
          label="Home"
          active={isHome}
          onClick={() => navigate(null)}
        />

        {/* Public Games */}
        <SidebarItem
          icon="🌐"
          label="Public Games"
          active={publicGamesOpen}
          onClick={togglePublicGames}
        />

        {/* Profile */}
        <SidebarItem
          icon="👤"
          label="Profile"
          active={settingsOpen}
          onClick={toggleSettings}
        />

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

function SidebarItem({ icon, label, active, onClick }: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-3 px-5 py-4 cursor-pointer
        font-mono text-sm font-bold uppercase tracking-wide transition-colors
        ${active
          ? 'bg-violet-900/20 text-slate-100'
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
        }`}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500" />}
      <span className="text-base w-5 text-center">{icon}</span>
      {label}
    </div>
  )
}
