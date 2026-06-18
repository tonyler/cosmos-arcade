import { useEffect } from 'react'
import LeftSidebar from './components/layout/LeftSidebar'
import Navbar from './components/layout/Navbar'
import ChatSidebar from './components/layout/ChatSidebar'
import GameGrid from './components/lobby/GameGrid'
import GamePage from './pages/GamePage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import PacManGame from './games/pacman/PacManGame'
import { useRouterStore } from './store/routerStore'
import { useMatchStore } from './store/matchStore'
import type { Denom } from './lib/escrow'

const IS_ADMIN   = new URLSearchParams(window.location.search).has('admin')
const IS_PACTEST = new URLSearchParams(window.location.search).has('test') &&
                   new URLSearchParams(window.location.search).get('test') === 'pacman'

function MainApp() {
  const currentGame = useRouterStore((s) => s.currentGame)
  const settingsOpen = useRouterStore((s) => s.settingsOpen)
  const navigate = useRouterStore((s) => s.navigate)
  const setJoinTarget = useMatchStore((s) => s.setJoinTarget)

  // Handle ?join= invite links on initial load
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const joinId = p.get('join')
    const game = p.get('game')
    const amount = p.get('amount')
    const denom = p.get('denom') as Denom | null
    if (joinId && game) {
      setJoinTarget({ matchId: joinId, gameSlug: game, amount: amount ?? '1000000', denom: denom ?? 'uatom' })
      navigate(game)
      // Clean up URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (currentGame) return <GamePage slug={currentGame} />

  return (
    <div className="relative flex overflow-hidden font-ui text-slate-200 bg-c-bg" style={{ zoom: 1.1, height: 'calc(100vh / 1.1)' }}>

      {/* ── BACKGROUND LAYERS (fixed, pointer-events-none) ────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">

        {/* 1. Grid — visible enough to feel like a cockpit HUD */}
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
        {/* warm centre glow so middle doesn't look flat */}
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

        {/* 4. Decorative retro text — giant, very low opacity, tilted */}
        {/* Top-right: INSERT COIN */}
        <div
          className="absolute font-px text-violet-400 leading-relaxed tracking-widest"
          style={{
            top: '6%',
            right: '320px',
            fontSize: '72px',
            opacity: 0.032,
            transform: 'rotate(-7deg)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          INSERT<br />COIN
        </div>

        {/* Bottom-left: GAME OVER */}
        <div
          className="absolute font-px text-blue-400 leading-relaxed tracking-widest"
          style={{
            bottom: '8%',
            left: '200px',
            fontSize: '56px',
            opacity: 0.03,
            transform: 'rotate(5deg)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          GAME<br />OVER
        </div>

        {/* Centre-right: large 1UP */}
        <div
          className="absolute font-px text-emerald-400"
          style={{
            top: '38%',
            right: '310px',
            fontSize: '110px',
            opacity: 0.025,
            transform: 'rotate(-2deg)',
          }}
        >
          1UP
        </div>

        {/* 5. Floating pixel sprites — animated drift, extremely faint */}
        <div
          className="absolute font-px text-violet-300 animate-drift-a"
          style={{ top: '14%', right: '22%', fontSize: '88px', opacity: 0.045 }}
        >
          👾
        </div>
        <div
          className="absolute font-px text-blue-300 animate-drift-b"
          style={{ bottom: '22%', left: '17%', fontSize: '64px', opacity: 0.04 }}
        >
          ★
        </div>
        <div
          className="absolute font-px text-slate-400 animate-drift-c"
          style={{ top: '55%', right: '18%', fontSize: '52px', opacity: 0.035 }}
        >
          🎮
        </div>

        {/* 6. Top border glow */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(139,92,246,0.5) 50%, transparent)',
          }}
        />

        {/* 7. Corner accent brackets */}
        <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-violet-600/20" />
        <div className="absolute top-0 right-0 w-16 h-16 border-r-2 border-t-2 border-violet-600/20" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border-l-2 border-b-2 border-violet-600/20" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-violet-600/20" />
      </div>

      {/* ── LAYOUT (above background) ─────────────────────────────────────── */}
      <div className="relative z-10 flex w-full h-full">

        {/* Left sidebar */}
        <LeftSidebar />

        {/* Main column */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto">
            {settingsOpen ? <SettingsPage /> : <GameGrid />}
          </main>
        </div>

        {/* Chat sidebar */}
        <ChatSidebar />

      </div>
    </div>
  )
}

function PacManTestPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center overflow-auto py-8">
      <PacManGame />
    </div>
  )
}

export default function App() {
  if (IS_PACTEST) return <PacManTestPage />
  return IS_ADMIN ? <AdminPage /> : <MainApp />
}
