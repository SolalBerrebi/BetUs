import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints } from '../lib/types'
import MatchCard from '../components/MatchCard'
import { EmptyState, PageTitle, Segmented } from '../components/ui'
import { dayKey, dayLabel, countdown } from '../lib/format'

export default function Matches() {
  const { matches, myPredictions, session, tournamentStart, myTournamentPrediction } = useApp()
  const now = useNow()
  const [filter, setFilter] = useState<'upcoming' | 'finished'>('upcoming')
  const [points, setPoints] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (!session) return
    supabase
      .from('match_points')
      .select('*')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        if (data)
          setPoints(
            new Map(
              (data as MatchPoints[]).map((r) => [
                r.match_id,
                r.winner_pts + r.scorer_pts + r.assister_pts + r.exact_pts,
              ]),
            ),
          )
      })
  }, [session, matches])

  const shown = useMemo(() => {
    const list = matches.filter((m) =>
      filter === 'finished' ? m.status === 'finished' : m.status !== 'finished',
    )
    if (filter === 'finished') list.reverse()
    const days: { key: string; label: string; items: typeof list }[] = []
    for (const m of list) {
      const key = dayKey(m.kickoff_at)
      const last = days[days.length - 1]
      if (last && last.key === key) last.items.push(m)
      else days.push({ key, label: dayLabel(m.kickoff_at), items: [m] })
    }
    return days
  }, [matches, filter])

  const tournamentNotStarted = tournamentStart != null && now < new Date(tournamentStart).getTime()
  const preTournamentDone =
    myTournamentPrediction != null &&
    [
      myTournamentPrediction.top_scorer,
      myTournamentPrediction.top_assister,
      myTournamentPrediction.best_keeper,
      myTournamentPrediction.finalist_a,
      myTournamentPrediction.finalist_b,
      myTournamentPrediction.winner,
      myTournamentPrediction.best_player,
    ].every((v) => v && v.trim() !== '')

  return (
    <div>
      <PageTitle sub="Coupe du Monde 2026">Matchs</PageTitle>

      {tournamentNotStarted && !preTournamentDone && (
        <Link
          to="/avant-competition"
          className="mb-4 block rounded-(--radius-card) bg-accent p-4 text-white shadow-(--shadow-float) transition-transform duration-150 active:scale-[0.98]"
        >
          <p className="text-[16px] font-semibold">Pronostics d'avant-compétition</p>
          <p className="mt-0.5 text-[14px] text-white/80">
            6 réponses, jusqu'à 65 pts — ferme dans {countdown(tournamentStart!, now) ?? 'quelques minutes'}.
          </p>
        </Link>
      )}

      <div className="mb-5">
        <Segmented
          options={[
            { value: 'upcoming', label: 'À venir' },
            { value: 'finished', label: 'Terminés' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {shown.length === 0 && (
        <EmptyState
          icon={filter === 'upcoming' ? '🗓️' : '⚽️'}
          title={filter === 'upcoming' ? 'Aucun match à venir' : 'Aucun match terminé'}
          text={filter === 'finished' ? 'Les résultats apparaîtront ici après les premiers matchs.' : undefined}
        />
      )}

      <div className="space-y-7">
        {shown.map((day) => (
          <section key={day.key}>
            <h2 className="mb-2.5 px-1 text-[15px] font-semibold text-ink-2">{day.label}</h2>
            <div className="space-y-2.5">
              {day.items.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  prediction={myPredictions.get(m.id)}
                  points={m.status === 'finished' ? (points.get(m.id) ?? (myPredictions.has(m.id) ? 0 : undefined)) : undefined}
                  now={now}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
