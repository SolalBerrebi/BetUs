import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints, Prediction, TournamentBreakdownRow, TournamentPrediction } from '../lib/types'
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

/** Ligne d'un prono d'avant-compétition (avant que les résultats ne soient connus). */
function PickLine({ label, pick }: { label: string; pick: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <p className="shrink-0 text-[14px] font-medium">{label}</p>
      <span className="truncate text-right text-[14px] font-semibold text-ink-2">{pick || '—'}</span>
    </div>
  )
}

const TOURNAMENT_ITEMS: { slot: number; item: string; get: (t: TournamentPrediction) => string | null }[] = [
  { slot: 1, item: 'Meilleur buteur', get: (t) => t.top_scorer },
  { slot: 2, item: 'Meilleur passeur', get: (t) => t.top_assister },
  { slot: 3, item: 'Meilleur gardien', get: (t) => t.best_keeper },
  { slot: 4, item: 'Finale', get: (t) => [t.finalist_a, t.finalist_b].filter(Boolean).join(' – ') || null },
  { slot: 5, item: 'Équipe gagnante', get: (t) => t.winner },
  { slot: 6, item: 'Meilleur joueur', get: (t) => t.best_player },
]

export default function PlayerDetail() {
  const { id } = useParams()
  const { matches, profiles, session } = useApp()
  const [points, setPoints] = useState<MatchPoints[] | null>(null)
  const [preds, setPreds] = useState<Map<number, Prediction>>(new Map())
  const [tournament, setTournament] = useState<TournamentBreakdownRow[]>([])
  const [tpred, setTpred] = useState<TournamentPrediction | null>(null)

  const player = profiles.find((p) => p.id === id)
  const isMe = id === session?.user.id

  useEffect(() => {
    if (!id) return
    setPoints(null)
    setTpred(null)
    Promise.all([
      supabase.from('match_points').select('*').eq('user_id', id),
      supabase.from('predictions').select('*').eq('user_id', id),
      supabase.from('tournament_breakdown').select('*').eq('user_id', id).order('slot'),
      supabase.from('tournament_predictions').select('*').eq('user_id', id).maybeSingle(),
    ]).then(([mp, pr, tb, tp]) => {
      setPoints((mp.data as MatchPoints[]) ?? [])
      setPreds(new Map(((pr.data as Prediction[]) ?? []).map((x) => [x.match_id, x])))
      setTournament((tb.data as TournamentBreakdownRow[]) ?? [])
      setTpred((tp.data as TournamentPrediction) ?? null)
    })
  }, [id])

  // Pronos d'avant-compétition visibles par tout le monde.
  const resultsKnown = tournament.length > 0
  const tBySlot = useMemo(() => new Map(tournament.map((t) => [t.slot, t])), [tournament])
  const preItems = tpred ? TOURNAMENT_ITEMS.map((x) => ({ ...x, pick: x.get(tpred) })) : []
  const hasPicks = preItems.some((i) => i.pick)

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

      <section className="mb-6">
        <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Avant-compétition</h2>
        <Card className="px-4 py-2">
          {!hasPicks ? (
            <p className="py-3 text-center text-[14px] text-ink-2">
              {isMe ? (
                <>
                  Tu n'as pas encore fait tes pronos —{' '}
                  <Link to="/avant-competition" className="font-medium text-accent">les remplir</Link>.
                </>
              ) : (
                "Pas de pronostic d'avant-compétition."
              )}
            </p>
          ) : resultsKnown ? (
            // Résultats connus → affichage avec points
            preItems.map((it) => {
              const b = tBySlot.get(it.slot)
              return (
                <PointLine
                  key={it.slot}
                  label={it.item}
                  detail={
                    it.pick
                      ? `${it.pick}${b?.answer && (b?.points ?? 0) === 0 ? ` — réel : ${b.answer}` : ''}`
                      : 'Pas de pronostic'
                  }
                  won={(b?.points ?? 0) > 0}
                  max={3}
                />
              )
            })
          ) : (
            // Avant les résultats → on montre juste les pronos
            preItems.map((it) => <PickLine key={it.slot} label={it.item} pick={it.pick} />)
          )}
        </Card>
      </section>

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
