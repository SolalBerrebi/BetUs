/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Match, Prediction, Profile, TournamentPrediction } from './types'

interface AppState {
  session: Session | null
  profile: Profile | null
  profiles: Profile[]
  matches: Match[]
  myPredictions: Map<number, Prediction>
  tournamentStart: string | null
  myTournamentPrediction: TournamentPrediction | null
  loading: boolean
  refresh: () => Promise<void>
  savePrediction: (p: Prediction) => Promise<string | null>
  saveTournamentPrediction: (p: TournamentPrediction) => Promise<string | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

/** Horloge partagée (tick 20 s) pour comptes à rebours et verrouillages. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [myPredictions, setMyPredictions] = useState<Map<number, Prediction>>(new Map())
  const [tournamentStart, setTournamentStart] = useState<string | null>(null)
  const [myTournamentPrediction, setMyTournamentPrediction] = useState<TournamentPrediction | null>(null)
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!session) return
    const uid = session.user.id
    const [m, p, ps, s, tp] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at').order('id'),
      supabase.from('predictions').select('*').eq('user_id', uid),
      supabase.from('profiles').select('*').order('display_name'),
      supabase.from('settings').select('tournament_start').maybeSingle(),
      supabase.from('tournament_predictions').select('*').eq('user_id', uid).maybeSingle(),
    ])
    if (m.data) setMatches(m.data as Match[])
    if (p.data) setMyPredictions(new Map((p.data as Prediction[]).map((x) => [x.match_id, x])))
    if (ps.data) {
      setProfiles(ps.data as Profile[])
      setProfile((ps.data as Profile[]).find((x) => x.id === uid) ?? null)
    }
    if (s.data) setTournamentStart(s.data.tournament_start)
    setMyTournamentPrediction((tp.data as TournamentPrediction) ?? null)
    setDataReady(true)
  }, [session])

  useEffect(() => {
    if (!session) {
      setDataReady(false)
      setProfile(null)
      return
    }
    void refresh()
    const channel = supabase
      .channel('app-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session, refresh])

  const savePrediction = useCallback(
    async (p: Prediction): Promise<string | null> => {
      const { error } = await supabase
        .from('predictions')
        .upsert(p, { onConflict: 'user_id,match_id' })
      if (error) {
        if (error.code === '42501') return 'Trop tard — le match a commencé.'
        return error.message
      }
      setMyPredictions((prev) => new Map(prev).set(p.match_id, p))
      return null
    },
    [],
  )

  const saveTournamentPrediction = useCallback(
    async (p: TournamentPrediction): Promise<string | null> => {
      const { error } = await supabase
        .from('tournament_predictions')
        .upsert(p, { onConflict: 'user_id' })
      if (error) {
        if (error.code === '42501') return 'Trop tard — la compétition a commencé.'
        return error.message
      }
      setMyTournamentPrediction(p)
      return null
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AppState>(
    () => ({
      session,
      profile,
      profiles,
      matches,
      myPredictions,
      tournamentStart,
      myTournamentPrediction,
      loading: !authReady || (!!session && !dataReady),
      refresh,
      savePrediction,
      saveTournamentPrediction,
      signOut,
    }),
    [session, profile, profiles, matches, myPredictions, tournamentStart, myTournamentPrediction,
     authReady, dataReady, refresh, savePrediction, saveTournamentPrediction, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
