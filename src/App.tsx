import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './lib/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import ChatRoom from './pages/ChatRoom'
import Leaderboard from './pages/Leaderboard'
import PlayerDetail from './pages/PlayerDetail'
import MyPredictions from './pages/MyPredictions'
import PreTournament from './pages/PreTournament'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminMatch from './pages/AdminMatch'
import AdminCompetition from './pages/AdminCompetition'
import { Spinner } from './components/ui'

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

  return (
    <Routes>
      {/* Salon plein écran, hors tab bar */}
      <Route path="match/:id/chat" element={<ChatRoom />} />
      <Route element={<Layout />}>
        <Route index element={<Matches />} />
        <Route path="match/:id" element={<MatchDetail />} />
        <Route path="classement" element={<Leaderboard />} />
        <Route path="joueur/:id" element={<PlayerDetail />} />
        <Route path="pronos" element={<MyPredictions />} />
        <Route path="avant-competition" element={<PreTournament />} />
        <Route path="profil" element={<Profile />} />
        {profile?.is_admin && (
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

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Shell />
      </AppProvider>
    </HashRouter>
  )
}
