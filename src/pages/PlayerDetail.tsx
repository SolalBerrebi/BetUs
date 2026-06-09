import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints, Prediction, TournamentBreakdownRow } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { dayLabel } from '../lib/format'
import { Badge, Card, EmptyState, PageTitle, Spinner } from '../components/ui'

/** Pastille d'un poste de points : verte si gagné, grise sinon. */
function PointLine({ label, detail, won, max }: { label: string; detail: string; won: boolean; max: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{label}</p>
        <p className="truncate text-[13px] text-ink-2">{detail}</p>
      </div>
      <Badge tone={won ? 'positive' : 'neutral'}>{won ? `+${max}` : '0'} pts</Badge>
    </div>
  )
}

export default function PlayerDetail() {
  const { id } = useParams()
  const { matches, profiles, session } = useApp()
  const [points, setPoints] = useState<MatchPoints[] | null>(null)
  const [preds, setPreds] = useState<Map<number, Prediction>>(new Map())
  const [tournament, setTournament] = useState<TournamentBreakdownRow[]>([])

  const player = profiles.find((p) => p.id === id)
  const isMe = id === session?.user.id

  useEffect(() => {
    if (!id) return
    setPoints(null)
    Promise.all([
      supabase.from('match_points').select('*').eq('user_id', id),
      supabase.from('predictions').select('*').eq('user_id', id),
      supabase.from('tournament_breakdown').select('*').eq('user_id', id).order('slot'),
    ]).then(([mp, pr, tb]) => {
      setPoints((mp.data as MatchPoints[]) ?? [])
      setPreds(new Map(((pr.data as Prediction[]) ?? []).map((x) => [x.match_id, x])))
      setTournament((tb.data as TournamentBreakdownRow[]) ?? [])
    })
  }, [id])

  const matchById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches])

  const scored = useMemo(() => {
    if (!points) return []
    return points
      .map((mp) => ({ mp, match: matchById.get(mp.match_id), pred: preds.get(mp.match_id) }))
      .filter((x) => x.match)
      .sort((a, b) => b.mp.match_id - a.mp.match_id)
  }, [points, preds, matchById])

  const matchTotal = (points ?? []).reduce(
    (s, p) => s + p.winner_pts + p.scorer_pts + p.assister_pts + p.exact_pts,
    0,
  )
  const tournamentTotal = tournament.reduce((s, t) => s + t.points, 0)
  const grandTotal = matchTotal + tournamentTotal

  if (!points) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <Link to="/classement" className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent">
        ‹ Classement
      </Link>
      <PageTitle
        sub={
          <>
            <span className="tnum font-semibold text-ink">{grandTotal} pts</span> au total ·{' '}
            {matchTotal} en matchs{tournamentTotal ? ` · ${tournamentTotal} en avant-compétition` : ''}
          </>
        }
      >
        {player?.display_name ?? 'Joueur'} {isMe && <span className="text-[18px] font-normal text-ink-3">(moi)</span>}
      </PageTitle>

      {tournament.some((t) => t.points > 0 || t.pick) && (
        <section className="mb-6">
          <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Avant-compétition</h2>
          <Card className="px-4 py-2">
            {tournament.map((t) => (
              <PointLine
                key={t.slot}
                label={t.item}
                detail={
                  t.pick
                    ? `${t.pick}${t.answer && t.points === 0 ? ` — réel : ${t.answer}` : ''}`
                    : 'Pas de pronostic'
                }
                won={t.points > 0}
                max={3}
              />
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Matchs comptés</h2>
        {scored.length === 0 ? (
          <EmptyState icon="⚽️" title="Aucun match compté pour l'instant" text="Les points apparaîtront ici après les premiers résultats." />
        ) : (
          <div className="space-y-2.5">
            {scored.map(({ mp, match, pred }) => {
              const m = match!
              const total = mp.winner_pts + mp.scorer_pts + mp.assister_pts + mp.exact_pts
              const predWinner = pred?.winner
                ? pred.winner === 'draw'
                  ? 'Nul'
                  : pred.winner === 'home'
                    ? teamName(m.home_team, m.home_code)
                    : teamName(m.away_team, m.away_code)
                : '—'
              return (
                <Card key={mp.match_id} className="overflow-hidden">
                  <Link to={`/match/${m.id}`} className="block px-4 pb-3 pt-3.5 transition-colors active:bg-surface-2/60">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[15px] font-semibold">
                        {teamFlag(m.home_code)} {teamName(m.home_team, m.home_code)} {m.home_score}–{m.away_score}{' '}
                        {teamName(m.away_team, m.away_code)} {teamFlag(m.away_code)}
                      </span>
                      <Badge tone={total > 0 ? 'positive' : 'neutral'}>{total > 0 ? `+${total}` : '0'} pts</Badge>
                    </div>
                    <p className="mb-2 text-[12px] text-ink-3">{dayLabel(m.kickoff_at)}</p>
                    {pred ? (
                      <div className="divide-y divide-line/50 border-t border-line/50">
                        <PointLine
                          label="Vainqueur"
                          detail={predWinner}
                          won={mp.winner_pts > 0}
                          max={1}
                        />
                        <PointLine
                          label="Score exact"
                          detail={pred.pred_home_score !== null ? `${pred.pred_home_score}–${pred.pred_away_score}` : '—'}
                          won={mp.exact_pts > 0}
                          max={5}
                        />
                        <PointLine
                          label="Buteur"
                          detail={pred.scorer || '—'}
                          won={mp.scorer_pts > 0}
                          max={3}
                        />
                        <PointLine
                          label="Passeur"
                          detail={pred.assister || '—'}
                          won={mp.assister_pts > 0}
                          max={3}
                        />
                      </div>
                    ) : (
                      <p className="border-t border-line/50 pt-2 text-[13px] text-ink-3">Pas de pronostic sur ce match.</p>
                    )}
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
