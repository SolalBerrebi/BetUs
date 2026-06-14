import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AppProvider, useApp } from './lib/AppContext'
import Layout from './components/Layout'
import NotifGate from './components/NotifGate'
import Login from './pages/Login'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import ChatRoom from './pages/ChatRoom'
import Leaderboard from './pages/Leaderboard'
import PlayerDetail from './pages/PlayerDetail'
import MyPredictions from './pages/MyPredictions'
import PreTournament from './pages/PreTournament'
import Bracket from './pages/Bracket'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminMatch from './pages/AdminMatch'
import AdminCompetition from './pages/AdminCompetition'
import { Spinner } from './components/ui'

// Écrans de premier niveau (onglets) : on fond entre eux, on slide pour le reste.
const TOP_LEVEL = new Set(['/', '/classement', '/pronos', '/profil', '/admin'])
const depth = (p: string) => p.split('/').filter(Boolean).length

/**
 * Anime chaque changement de route façon iOS via la View Transitions API.
 * On retient la location « affichée » et on ne la met à jour qu'à l'intérieur d'une
 * transition → capture push/pop/onglets de façon centralisée (liens, tab bar, retour).
 */
function useAnimatedLocation() {
  const location = useLocation()
  const [display, setDisplay] = useState(location)
  const prev = useRef(location)

  useLayoutEffect(() => {
    if (location === display) return
    const from = prev.current.pathname
    const to = location.pathname
    const commit = () => {
      prev.current = location
      setDisplay(location)
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    if (from === to || reduce || !doc.startViewTransition) {
      commit()
      return
    }
    document.documentElement.dataset.nav =
      TOP_LEVEL.has(from) && TOP_LEVEL.has(to)
        ? 'fade'
        : depth(to) > depth(from)
          ? 'forward'
          : depth(to) < depth(from)
            ? 'back'
            : 'fade'
    doc.startViewTransition(() => flushSync(commit))
  }, [location, display])

  return display
}

function AppRoutes({ isAdmin }: { isAdmin: boolean }) {
  const display = useAnimatedLocation()
  return (
    <Routes location={display}>
      {/* Salon + tableau plein écran, hors tab bar */}
      <Route path="match/:id/chat" element={<ChatRoom />} />
      <Route path="tableau" element={<Bracket />} />
      <Route element={<Layout />}>
        <Route index element={<Matches />} />
        <Route path="match/:id" element={<MatchDetail />} />
        <Route path="classement" element={<Leaderboard />} />
        <Route path="joueur/:id" element={<PlayerDetail />} />
        <Route path="pronos" element={<MyPredictions />} />
        <Route path="avant-competition" element={<PreTournament />} />
        <Route path="profil" element={<Profile />} />
        {isAdmin && (
          <>
            <Route path="admin" element={<Admin />} />
            <Route path="admin/match/:id" element={<AdminMatch />} />
            <Route path="admin/competition" element={<AdminCompetition />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Shell() {
  const { session, profile, loading } = useApp()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!session) return <Login />

  // Gate strict : app verrouillée tant que pas installée + notifications actives
  return (
    <NotifGate userId={session.user.id}>
      <AppRoutes isAdmin={!!profile?.is_admin} />
    </NotifGate>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Shell />
      </AppProvider>
    </HashRouter>
  )
}
