import { useEffect } from 'react'
import LeftSidebar from './components/layout/LeftSidebar'
import Navbar from './components/layout/Navbar'
import ChatSidebar from './components/layout/ChatSidebar'
import GameGrid from './components/lobby/GameGrid'
import PublicMatchList from './components/lobby/PublicMatchList'
import GamePage from './pages/GamePage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import PacManGame from './games/pacman/PacManGame'
import { useRouterStore } from './store/routerStore'
import { useMatchStore } from './store/matchStore'
import { useChatStore } from './store/chatStore'
import type { Denom } from './lib/escrow'

const IS_ADMIN   = new URLSearchParams(window.location.search).has('admin')
const IS_PACTEST = new URLSearchParams(window.location.search).has('test') &&
                   new URLSearchParams(window.location.search).get('test') === 'pacman'

function MainApp() {
  const currentGame = useRouterStore((s) => s.currentGame)
  const settingsOpen = useRouterStore((s) => s.settingsOpen)
  const publicGamesOpen = useRouterStore((s) => s.publicGamesOpen)
  const navigate = useRouterStore((s) => s.navigate)
  const setJoinTarget = useMatchStore((s) => s.setJoinTarget)
  const { open: chatOpen, toggleOpen: toggleChat } = useChatStore()

  // Handle ?join= invite links on initial load
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const joinId = p.get('join')
    const game = p.get('game')
    const amount = p.get('amount')
    const denom = p.get('denom') as Denom | null
    const isCasual = p.get('casual') === 'true'
    if (joinId && game) {
      setJoinTarget({ matchId: joinId, gameSlug: game, amount: amount ?? '1000000', denom: denom ?? 'uatom', isCasual })
      navigate(game)
      // Clean up URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (currentGame) return <GamePage slug={currentGame} />

  return (
    <div className="desktop-zoom relative flex overflow-hidden font-ui text-slate-200 bg-c-bg">

      {/* ── BACKGROUND LAYERS (fixed, pointer-events-none) ────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">

        {/* 1. Grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
          }}
        />

        {/* 2. Atmospheric light sources */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 18% 0%, rgba(109,40,217,0.18) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 65% 50% at 82% 105%, rgba(29,78,216,0.14) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(30,27,75,0.4) 0%, transparent 70%)',
          }}
        />

        {/* 3. Scanlines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.045) 3px, rgba(0,0,0,0.045) 4px)',
          }}
        />

        {/* 4. Decorative retro text — desktop only to avoid clutter on small screens */}
        <div className="hidden md:block">
          <div
            className="absolute font-px text-violet-400 leading-relaxed tracking-widest"
            style={{ top: '6%', right: '320px', fontSize: '72px', opacity: 0.032, transform: 'rotate(-7deg)', lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            INSERT<br />COIN
          </div>
          <div
            className="absolute font-px text-blue-400 leading-relaxed tracking-widest"
            style={{ bottom: '8%', left: '200px', fontSize: '56px', opacity: 0.03, transform: 'rotate(5deg)', lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            GAME<br />OVER
          </div>
          <div
            className="absolute font-px text-emerald-400"
            style={{ top: '38%', right: '310px', fontSize: '110px', opacity: 0.025, transform: 'rotate(-2deg)' }}
          >
            1UP
          </div>
        </div>

        {/* 5. Floating pixel sprites */}
        <div className="absolute font-px text-violet-300 animate-drift-a" style={{ top: '14%', right: '22%', fontSize: '88px', opacity: 0.045 }}>👾</div>
        <div className="absolute font-px text-blue-300 animate-drift-b" style={{ bottom: '22%', left: '17%', fontSize: '64px', opacity: 0.04 }}>★</div>
        <div className="absolute font-px text-slate-400 animate-drift-c" style={{ top: '55%', right: '18%', fontSize: '52px', opacity: 0.035 }}>🎮</div>

        {/* 6. Top border glow */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5) 50%, transparent)' }} />

        {/* 7. Corner accent brackets */}
        <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-violet-600/20" />
        <div className="absolute top-0 right-0 w-16 h-16 border-r-2 border-t-2 border-violet-600/20" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border-l-2 border-b-2 border-violet-600/20" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-violet-600/20" />
      </div>

      {/* ── LAYOUT ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex w-full h-full">

        {/* Left sidebar — hidden on mobile */}
        <LeftSidebar />

        {/* Main column */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {settingsOpen
              ? <SettingsPage />
              : publicGamesOpen
                ? <div className="px-4 py-5 md:px-7 md:py-7"><PublicMatchList /></div>
                : <GameGrid />
            }
          </main>
          <MobileBottomNav />
        </div>

        {/* Mobile chat backdrop — below navbar, above bottom nav */}
        {chatOpen && (
          <div
            className="fixed top-[56px] bottom-16 inset-x-0 bg-black/60 z-40 md:hidden"
            onClick={toggleChat}
          />
        )}

        {/* Chat sidebar */}
        <ChatSidebar />
      </div>
    </div>
  )
}

function MobileBottomNav() {
  const settingsOpen = useRouterStore((s) => s.settingsOpen)
  const publicGamesOpen = useRouterStore((s) => s.publicGamesOpen)
  const toggleSettings = useRouterStore((s) => s.toggleSettings)
  const togglePublicGames = useRouterStore((s) => s.togglePublicGames)
  const navigate = useRouterStore((s) => s.navigate)
  const { open: chatOpen, toggleOpen } = useChatStore()

  const closeChat = () => { if (chatOpen) toggleOpen() }
  const isHome = !settingsOpen && !publicGamesOpen

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30
      bg-c-panel border-t border-c-border
      flex items-stretch h-16">

      {/* Home */}
      <NavBtn
        icon="⊞"
        label="Home"
        active={isHome}
        onClick={() => { closeChat(); navigate(null) }}
      />

      {/* Public Games */}
      <NavBtn
        icon="🌐"
        label="Games"
        active={publicGamesOpen}
        onClick={() => { closeChat(); togglePublicGames() }}
      />

      {/* Tournaments */}
      <NavBtn icon="⚔" label="Tourneys" disabled />

      {/* Chat */}
      <NavBtn icon="💬" label="Chat" active={chatOpen} onClick={toggleOpen} />

      {/* Profile */}
      <NavBtn
        icon="👤"
        label="Profile"
        active={settingsOpen}
        onClick={() => { closeChat(); toggleSettings() }}
      />
    </nav>
  )
}

function NavBtn({ icon, label, active, disabled, onClick }: {
  icon: string; label: string; active?: boolean; disabled?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors
        ${active ? 'text-violet-400 bg-violet-900/20' : 'text-slate-600'}
        ${disabled ? 'pointer-events-none opacity-40' : 'hover:text-slate-300 active:bg-white/5'}
      `}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="font-mono text-[8px] tracking-wider uppercase leading-none">
        {label}{disabled ? <span className="ml-1 text-amber-500">·</span> : null}
      </span>
    </button>
  )
}

function PacManTestPage() {
  return (
    <div className="h-[100dvh] bg-black flex items-center justify-center overflow-hidden">
      <PacManGame />
    </div>
  )
}

export default function App() {
  if (IS_PACTEST) return <PacManTestPage />
  return IS_ADMIN ? <AdminPage /> : <MainApp />
}
