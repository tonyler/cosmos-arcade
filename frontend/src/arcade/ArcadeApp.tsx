import { useEffect } from 'react'
import LeftSidebar from '../components/layout/LeftSidebar'
import Navbar from '../components/layout/Navbar'
import ChatSidebar from '../components/layout/ChatSidebar'
import GameGrid from '../components/lobby/GameGrid'
import PublicMatchList from '../components/lobby/PublicMatchList'
import GamePage from '../pages/GamePage'
import SettingsPage from '../pages/SettingsPage'
import AdminPage from '../pages/AdminPage'
import { lazy, Suspense } from 'react'
const PacManGame  = lazy(() => import('../games/pacman/PacManGame'))
const ShooterGame = lazy(() => import('../games/shooter/ShooterGame'))
import { useRouterStore } from '../store/routerStore'
import { useMatchStore } from '../store/matchStore'
import { useChatStore } from '../store/chatStore'
import { useWalletStore } from '../store/walletStore'
import type { Denom } from '../lib/escrow'

const IS_ADMIN     = new URLSearchParams(window.location.search).has('admin')
const TEST_GAME    = new URLSearchParams(window.location.search).get('test')
const IS_PACTEST   = TEST_GAME === 'pacman'
const IS_SHOOTTEST = TEST_GAME === 'shooter'

/* ─────────────────────────────────────────────────────────────────────────
   COSMOS NEXUS BACKGROUND
   Modern gaming platform aesthetic: deep void, neon nebula orbs, subtle
   dot grid. Arcade DNA lives in the score strip and edge glowlines only.
   ───────────────────────────────────────────────────────────────────────── */
function ArcadeBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">

      {/* 1. BASE — deep void with violet/cyan nebula washes */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(124,58,237,0.20) 0%, transparent 55%),
            radial-gradient(ellipse 65% 45% at 90% 90%, rgba(6,182,212,0.10) 0%, transparent 50%),
            radial-gradient(ellipse 45% 40% at 5% 65%,  rgba(109,40,217,0.09) 0%, transparent 50%),
            #04040d
          `,
        }}
      />

      {/* 2. DOT GRID — very faint, arcade DNA reference */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* 3. FLOATING NEON ORBS — depth and atmosphere */}
      <div
        className="absolute animate-drift-a"
        style={{
          top: '-8%', left: '-6%',
          width: '700px', height: '700px',
          background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 65%)',
          filter: 'blur(70px)',
        }}
      />
      <div
        className="absolute animate-drift-b"
        style={{
          bottom: '-12%', right: '-4%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute animate-drift-c"
        style={{
          top: '38%', left: '42%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* 4. EDGE GLOWLINES — neon trim, arcade nod */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '1px', background: 'linear-gradient(90deg, transparent 5%, rgba(124,58,237,0.65) 30%, rgba(245,158,11,0.45) 50%, rgba(124,58,237,0.65) 70%, transparent 95%)' }} />
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '1px', background: 'linear-gradient(90deg, transparent 5%, rgba(124,58,237,0.35) 30%, rgba(245,158,11,0.25) 50%, rgba(124,58,237,0.35) 70%, transparent 95%)' }} />
      <div className="absolute left-0 top-0 bottom-0" style={{ width: '1px', background: 'linear-gradient(180deg, transparent 8%, rgba(124,58,237,0.35) 35%, rgba(124,58,237,0.15) 65%, transparent 92%)' }} />
      <div className="absolute right-0 top-0 bottom-0" style={{ width: '1px', background: 'linear-gradient(180deg, transparent 8%, rgba(124,58,237,0.35) 35%, rgba(124,58,237,0.15) 65%, transparent 92%)' }} />

      {/* 5. SCORE STRIP — arcade DNA, barely-there watermark */}
      <div
        className="hidden md:flex absolute top-2 left-1/2 -translate-x-1/2 items-center gap-10 animate-glow-pulse"
        style={{ opacity: 0.15 }}
      >
        {[
          { label: 'Player 1', value: '00000', color: '#e2e8f0' },
          { label: 'High Score', value: '44010', color: '#f59e0b' },
          { label: 'Player 2', value: '00000', color: '#e2e8f0' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center leading-tight">
            <div style={{ fontFamily: 'Russo One, sans-serif', fontSize: '7px', color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontFamily: 'Russo One, sans-serif', fontSize: '10px', color, letterSpacing: '0.12em', marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MainApp() {
  const currentGame     = useRouterStore((s) => s.currentGame)
  const settingsOpen    = useRouterStore((s) => s.settingsOpen)
  const publicGamesOpen = useRouterStore((s) => s.publicGamesOpen)
  const navigate        = useRouterStore((s) => s.navigate)
  const setJoinTarget   = useMatchStore((s) => s.setJoinTarget)
  const { open: chatOpen, collapsed: chatCollapsed, toggleOpen: toggleChat } = useChatStore()
  const { ensureWsConnected } = useWalletStore()

  useEffect(() => { ensureWsConnected() }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const joinId   = p.get('join')
    const game     = p.get('game')
    const amount   = p.get('amount')
    const denom    = p.get('denom') as Denom | null
    const isCasual = p.get('casual') === 'true'
    if (joinId && game) {
      setJoinTarget({ matchId: joinId, gameSlug: game, amount: amount ?? '1000000', denom: denom ?? 'uatom', isCasual })
      navigate(game)
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div data-arcade className="desktop-zoom relative flex overflow-hidden font-ui text-slate-200 bg-c-bg">

      <ArcadeBackground />

      <div className="relative z-10 flex w-full h-full">
        {!currentGame && <LeftSidebar />}

        <div className={`flex flex-col flex-1 overflow-hidden min-w-0 ${!currentGame && !chatCollapsed ? 'md:pr-[300px]' : ''}`}>
          {!currentGame && <Navbar />}
          <main className="flex-1 overflow-hidden">
            {currentGame
              ? <GamePage slug={currentGame} />
              : <div className="h-full overflow-y-auto pb-16 md:pb-0">
                  {settingsOpen
                    ? <SettingsPage />
                    : publicGamesOpen
                      ? <div className="px-4 py-5 md:px-7 md:py-7"><PublicMatchList /></div>
                      : <GameGrid />
                  }
                </div>
            }
          </main>
          {!currentGame && <MobileBottomNav />}
        </div>

        {!currentGame && chatOpen && (
          <div
            className="fixed top-[56px] bottom-16 inset-x-0 bg-black/60 z-40 md:hidden"
            onClick={toggleChat}
          />
        )}

        {!currentGame && <ChatSidebar />}
      </div>
    </div>
  )
}

/* SVG icon components — minimal paths, no dependency */
const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const IconGames = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 12h4M8 10v4M15 12h.01M17.5 12h.01" />
  </svg>
)
const IconTrophy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16M9 22v-3M15 22v-3" />
    <path d="M8 3h8v11a4 4 0 0 1-8 0z" />
  </svg>
)
const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const IconProfile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

function MobileBottomNav() {
  const settingsOpen    = useRouterStore((s) => s.settingsOpen)
  const publicGamesOpen = useRouterStore((s) => s.publicGamesOpen)
  const toggleSettings  = useRouterStore((s) => s.toggleSettings)
  const togglePublicGames = useRouterStore((s) => s.togglePublicGames)
  const navigate        = useRouterStore((s) => s.navigate)
  const { open: chatOpen, toggleOpen } = useChatStore()

  const closeChat = () => { if (chatOpen) toggleOpen() }
  const isHome = !settingsOpen && !publicGamesOpen

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30
      bg-c-panel/85 border-t border-c-border
      flex items-stretch h-16"
      style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <NavBtn icon={<IconHome />}    label="Home"    active={isHome}          onClick={() => { closeChat(); navigate(null) }} />
      <NavBtn icon={<IconGames />}   label="Games"   active={publicGamesOpen} onClick={() => { closeChat(); togglePublicGames() }} />
      <NavBtn icon={<IconTrophy />}  label="Tourney" disabled />
      <NavBtn icon={<IconChat />}    label="Chat"    active={chatOpen}        onClick={toggleOpen} />
      <NavBtn icon={<IconProfile />} label="Profile" active={settingsOpen}    onClick={() => { closeChat(); toggleSettings() }} />
    </nav>
  )
}

function NavBtn({ icon, label, active, disabled, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150
        ${active   ? 'text-violet-400' : 'text-slate-600'}
        ${disabled ? 'pointer-events-none opacity-25' : 'hover:text-slate-400 active:scale-95'}
      `}
      style={active ? {
        borderTop: '2px solid rgba(139,92,246,0.7)',
        marginTop: '-2px',
        filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.4))',
      } : {}}
    >
      {icon}
      <span className="font-ui text-[9px] leading-none tracking-wide uppercase font-medium">{label}</span>
    </button>
  )
}

function PacManTestPage() {
  return (
    <Suspense fallback={null}>
      <div className="h-[100dvh] bg-black flex items-center justify-center overflow-hidden">
        <PacManGame />
      </div>
    </Suspense>
  )
}

function ShooterTestPage() {
  return (
    <Suspense fallback={null}>
      <div className="h-[100dvh] bg-[#0a0e14] flex items-center justify-center overflow-hidden">
        <ShooterGame />
      </div>
    </Suspense>
  )
}

export default function ArcadeApp() {
  if (IS_PACTEST)   return <PacManTestPage />
  if (IS_SHOOTTEST) return <ShooterTestPage />
  return IS_ADMIN ? <AdminPage /> : <MainApp />
}
