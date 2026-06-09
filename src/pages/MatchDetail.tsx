import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints, Prediction } from '../lib/types'
import { STAGE_LABELS } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { countdown, dayLabel, hasStarted, timeLabel } from '../lib/format'
import { Badge, Button, Card, Field, Segmented, Spinner } from '../components/ui'

function ScoreStepper({ label, value, onChange, disabled }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="max-w-24 truncate text-[13px] font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Moins de buts ${label}`}
          disabled={disabled || value === null || value <= 0}
          onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
          className="size-9 rounded-full bg-surface-2 text-[18px] font-medium text-ink-2 transition-all duration-150 active:scale-90 disabled:opacity-30"
        >
          −
        </button>
        <span className="tnum w-10 text-center text-[28px] font-bold">{value ?? '–'}</span>
        <button
          type="button"
          aria-label={`Plus de buts ${label}`}
          disabled={disabled}
          onClick={() => onChange((value ?? -1) + 1)}
          className="size-9 rounded-full bg-surface-2 text-[18px] font-medium text-ink-2 transition-all duration-150 active:scale-90 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function MatchDetail() {
  const { id } = useParams()
  const { matches, myPredictions, savePrediction, session, profiles } = useApp()
  const now = useNow()
  const match = matches.find((m) => m.id === Number(id))

  const mine = match ? myPredictions.get(match.id) : undefined
  const [winner, setWinner] = useState<'home' | 'draw' | 'away' | null>(mine?.winner ?? null)
  const [hs, setHs] = useState<number | null>(mine?.pred_home_score ?? null)
  const [as_, setAs] = useState<number | null>(mine?.pred_away_score ?? null)
  const [scorer, setScorer] = useState(mine?.scorer ?? '')
  const [assister, setAssister] = useState(mine?.assister ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const started = match ? hasStarted(match.kickoff_at, now) : false

  const [others, setOthers] = useState<Prediction[] | null>(null)
  const [points, setPoints] = useState<Map<string, MatchPoints>>(new Map())
  useEffect(() => {
    if (!match || !started) return
    supabase.from('predictions').select('*').eq('match_id', match.id).then(({ data }) => {
      if (data) setOthers(data as Prediction[])
    })
    if (match.status === 'finished') {
      supabase.from('match_points').select('*').eq('match_id', match.id).then(({ data }) => {
        if (data) setPoints(new Map((data as MatchPoints[]).map((r) => [r.user_id, r])))
      })
    }
  }, [match, started, match?.status])

  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles])

  if (!match) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    )
  }

  const cd = countdown(match.kickoff_at, now)
  const finished = match.status === 'finished'

  async function submit() {
    if (!match || !session) return
    setSaving(true)
    setError(null)
    const err = await savePrediction({
      user_id: session.user.id,
      match_id: match.id,
      winner,
      pred_home_score: hs,
      pred_away_score: as_,
      scorer: scorer.trim() || null,
      assister: assister.trim() || null,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const winnerOptions: { value: 'home' | 'draw' | 'away'; label: string }[] =
    match.stage === 'group'
      ? [
          { value: 'home', label: teamName(match.home_team, match.home_code) },
          { value: 'draw', label: 'Nul' },
          { value: 'away', label: teamName(match.away_team, match.away_code) },
        ]
      : [
          { value: 'home', label: teamName(match.home_team, match.home_code) },
          { value: 'away', label: teamName(match.away_team, match.away_code) },
        ]

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent">
        ‹ Matchs
      </Link>

      <Card className="mb-4 p-5">
        <p className="text-center text-[12px] font-medium uppercase tracking-wide text-ink-3">
          {match.group_name ? `Groupe ${match.group_name}` : STAGE_LABELS[match.stage]} ·{' '}
          {dayLabel(match.kickoff_at)} · {timeLabel(match.kickoff_at)}
        </p>
        <div className="mt-4 flex items-center justify-center gap-5">
          <div className="flex w-28 flex-col items-center gap-1.5">
            <span className="text-5xl">{teamFlag(match.home_code)}</span>
            <span className="text-center text-[15px] font-semibold leading-tight">
              {teamName(match.home_team, match.home_code)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            {finished ? (
              <span className="tnum text-[34px] font-bold">
                {match.home_score} – {match.away_score}
              </span>
            ) : started ? (
              <Badge tone="warning">En cours</Badge>
            ) : (
              <>
                <span className="text-[15px] font-medium text-ink-2">dans</span>
                <span className="tnum text-[22px] font-bold">{cd}</span>
              </>
            )}
          </div>
          <div className="flex w-28 flex-col items-center gap-1.5">
            <span className="text-5xl">{teamFlag(match.away_code)}</span>
            <span className="text-center text-[15px] font-semibold leading-tight">
              {teamName(match.away_team, match.away_code)}
            </span>
          </div>
        </div>
        {finished && match.winner_override && (
          <p className="mt-2 text-center text-[13px] text-ink-2">
            Qualifié aux tirs au but :{' '}
            {match.winner_override === 'home'
              ? teamName(match.home_team, match.home_code)
              : teamName(match.away_team, match.away_code)}
          </p>
        )}
        {(match.venue || match.city) && (
          <p className="mt-3 text-center text-[13px] text-ink-3">
            {[match.venue, match.city].filter(Boolean).join(' · ')}
          </p>
        )}
        {finished && match.scorers.length > 0 && (
          <div className="mt-4 border-t border-line/70 pt-3 text-center text-[13px] text-ink-2">
            <p>⚽️ {match.scorers.join(', ')}</p>
            {match.assisters.length > 0 && <p className="mt-1">🅰️ {match.assisters.join(', ')}</p>}
          </div>
        )}
      </Card>

      {!started ? (
        <Card className="p-5">
          <h2 className="text-[20px] font-bold tracking-tight">Mon pronostic</h2>
          <p className="mb-5 mt-0.5 text-[13px] text-ink-2">Modifiable jusqu'au coup d'envoi.</p>

          <div className="space-y-6">
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Vainqueur · 1 pt</p>
              <Segmented options={winnerOptions} value={winner} onChange={setWinner} />
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Score exact · 5 pts</p>
              <div className="flex items-start justify-center gap-8">
                <ScoreStepper
                  label={teamName(match.home_team, match.home_code)}
                  value={hs}
                  onChange={setHs}
                />
                <span className="pt-8 text-[22px] font-bold text-ink-3">–</span>
                <ScoreStepper
                  label={teamName(match.away_team, match.away_code)}
                  value={as_}
                  onChange={setAs}
                />
              </div>
            </div>

            <Field
              label="Buteur · 3 pts"
              value={scorer}
              onChange={(e) => setScorer(e.target.value)}
              placeholder="Ex. Mbappé"
              hint="⚠️ Nom de famille seul (ex. « Mbappé », pas « Kylian Mbappé »). Accents et petites fautes tolérés."
            />
            <Field
              label="Passeur décisif · 3 pts"
              value={assister}
              onChange={(e) => setAssister(e.target.value)}
              placeholder="Ex. Griezmann"
            />

            {error && <p className="text-[14px] font-medium text-negative">{error}</p>}
            <Button onClick={submit} loading={saving} className="w-full">
              {saved ? 'Enregistré ✓' : mine ? 'Mettre à jour mon prono' : 'Valider mon prono'}
            </Button>
          </div>
        </Card>
      ) : (
        <section>
          <h2 className="mb-2.5 px-1 text-[15px] font-semibold text-ink-2">
            Les pronos {finished ? 'et les points' : 'du groupe'}
          </h2>
          {others === null ? (
            <div className="py-10 text-center">
              <Spinner />
            </div>
          ) : others.length === 0 ? (
            <Card>
              <p className="px-5 py-8 text-center text-[15px] text-ink-2">
                Personne n'a pronostiqué ce match.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-line/60">
              {others
                .sort((a, b) => {
                  const pa = points.get(a.user_id)
                  const pb = points.get(b.user_id)
                  const ta = pa ? pa.winner_pts + pa.scorer_pts + pa.assister_pts + pa.exact_pts : 0
                  const tb = pb ? pb.winner_pts + pb.scorer_pts + pb.assister_pts + pb.exact_pts : 0
                  return tb - ta || (names.get(a.user_id) ?? '').localeCompare(names.get(b.user_id) ?? '')
                })
                .map((p) => {
                  const pts = points.get(p.user_id)
                  const total = pts ? pts.winner_pts + pts.scorer_pts + pts.assister_pts + pts.exact_pts : null
                  const isMe = p.user_id === session?.user.id
                  return (
                    <div key={p.user_id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[16px] font-semibold">
                          {names.get(p.user_id) ?? '?'} {isMe && <span className="font-normal text-ink-3">(moi)</span>}
                        </span>
                        {total !== null && (
                          <Badge tone={total > 0 ? 'positive' : 'neutral'}>
                            {total > 0 ? `+${total} pts` : '0 pt'}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[14px] text-ink-2">
                        {p.winner
                          ? p.winner === 'draw'
                            ? 'Nul'
                            : p.winner === 'home'
                              ? teamName(match.home_team, match.home_code)
                              : teamName(match.away_team, match.away_code)
                          : '—'}
                        {p.pred_home_score !== null && ` · ${p.pred_home_score}-${p.pred_away_score}`}
                        {p.scorer && ` · ⚽️ ${p.scorer}`}
                        {p.assister && ` · 🅰️ ${p.assister}`}
                      </p>
                    </div>
                  )
                })}
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
