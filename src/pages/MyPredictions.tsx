import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { hasStarted, timeLabel, dayLabel } from '../lib/format'
import { Badge, Card, EmptyState, PageTitle } from '../components/ui'

export default function MyPredictions() {
  const { matches, myPredictions, myTournamentPrediction, session, tournamentStart } = useApp()
  const now = useNow()
  const [points, setPoints] = useState<Map<number, MatchPoints>>(new Map())

  useEffect(() => {
    if (!session) return
    supabase.from('match_points').select('*').eq('user_id', session.user.id).then(({ data }) => {
      if (data) setPoints(new Map((data as MatchPoints[]).map((r) => [r.match_id, r])))
    })
  }, [session, matches])

  const predicted = useMemo(
    () => matches.filter((m) => myPredictions.has(m.id)),
    [matches, myPredictions],
  )

  const tp = myTournamentPrediction
  const tpFields = tp
    ? ([
        ['Meilleur buteur', tp.top_scorer],
        ['Meilleur passeur', tp.top_assister],
        ['Meilleur gardien', tp.best_keeper],
        ['Finale', tp.finalist_a && tp.finalist_b ? `${tp.finalist_a} – ${tp.finalist_b}` : null],
        ['Vainqueur', tp.winner],
        ['Meilleur joueur', tp.best_player],
      ] as const)
    : null
  const locked = tournamentStart != null && now >= new Date(tournamentStart).getTime()

  return (
    <div>
      <PageTitle sub="Avant-compétition et matchs">Mes pronos</PageTitle>

      <Link to="/avant-competition" className="block transition-transform duration-150 active:scale-[0.98]">
        <Card className="mb-5 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold">Avant-compétition</h2>
            <Badge tone={locked ? 'neutral' : 'accent'}>{locked ? 'Verrouillé' : 'Modifiable'}</Badge>
          </div>
          {tpFields ? (
            <div className="mt-3 space-y-1.5">
              {tpFields.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 text-[14px]">
                  <span className="text-ink-2">{label}</span>
                  <span className="truncate font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">
              {locked ? 'Pas de pronostics envoyés.' : "6 réponses, jusqu'à 130 pts — à remplir avant le 1er match."}
            </p>
          )}
        </Card>
      </Link>

      {predicted.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Aucun prono de match"
          text="Va sur l'onglet Matchs pour pronostiquer les prochaines rencontres."
        />
      ) : (
        <Card className="divide-y divide-line/60">
          {predicted.map((m) => {
            const p = myPredictions.get(m.id)!
            const pts = points.get(m.id)
            const total = pts ? pts.winner_pts + pts.scorer_pts + pts.assister_pts + pts.exact_pts : null
            const started = hasStarted(m.kickoff_at, now)
            return (
              <Link key={m.id} to={`/match/${m.id}`} className="block px-4 py-3 transition-colors hover:bg-surface-2/60">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold">
                    {teamFlag(m.home_code)} {teamName(m.home_team, m.home_code)} – {teamName(m.away_team, m.away_code)}{' '}
                    {teamFlag(m.away_code)}
                  </span>
                  {m.status === 'finished' ? (
                    <Badge tone={(total ?? 0) > 0 ? 'positive' : 'neutral'}>
                      {(total ?? 0) > 0 ? `+${total} pts` : '0 pt'}
                    </Badge>
                  ) : started ? (
                    <Badge tone="warning">En cours</Badge>
                  ) : (
                    <span className="text-[12px] text-ink-3">
                      {dayLabel(m.kickoff_at)} {timeLabel(m.kickoff_at)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-ink-2">
                  {p.winner
                    ? p.winner === 'draw'
                      ? 'Nul'
                      : p.winner === 'home'
                        ? teamName(m.home_team, m.home_code)
                        : teamName(m.away_team, m.away_code)
                    : '—'}
                  {p.pred_home_score !== null && ` · ${p.pred_home_score}-${p.pred_away_score}`}
                  {p.scorer && ` · ⚽️ ${p.scorer}`}
                  {p.assister && ` · 🅰️ ${p.assister}`}
                </p>
              </Link>
            )
          })}
        </Card>
      )}
    </div>
  )
}
