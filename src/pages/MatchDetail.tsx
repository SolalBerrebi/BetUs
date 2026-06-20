import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints, Prediction } from '../lib/types'
import { STAGE_LABELS } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { ambiance, countdown, dayLabel, hasStarted, timeLabel } from '../lib/format'
import { matchGradient, GRAIN_DATA_URI } from '../lib/teamColors'
import { Badge, Button, Card, Segmented, Spinner } from '../components/ui'
import PlayerInput from '../components/PlayerInput'
import Lineup from '../components/Lineup'
import MatchStats from '../components/MatchStats'
import Momentum from '../components/Momentum'
import ShareSheet from '../components/ShareSheet'
import type { ShareData } from '../components/ShareCard'

// Vainqueur déduit d'un score complet. `null` = indéterminé :
//   - score incomplet → on laisse le joueur choisir le vainqueur seul ;
//   - nul en élimination → départage aux tirs au but, le joueur choisit qui se qualifie.
function impliedWinner(
  hs: number | null,
  as_: number | null,
  stage: string,
): 'home' | 'draw' | 'away' | null {
  if (hs === null || as_ === null) return null
  if (hs > as_) return 'home'
  if (hs < as_) return 'away'
  return stage === 'group' ? 'draw' : null
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3M12 3l-3.5 3.5M12 3l3.5 3.5" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

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
  // Score toujours renseigné : on démarre à 0-0, jamais d'état « – » (plus de prono partiel).
  const [hs, setHs] = useState<number | null>(mine?.pred_home_score ?? 0)
  const [as_, setAs] = useState<number | null>(mine?.pred_away_score ?? 0)
  const [scorer, setScorer] = useState(mine?.scorer ?? '')
  const [assister, setAssister] = useState(mine?.assister ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'resume' | 'momentum' | 'compos' | 'stats'>('resume')
  const [share, setShare] = useState<ShareData | null>(null)
  const navigate = useNavigate()

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

  // Cohérence vainqueur / score : dès qu'un score complet détermine l'issue, on aligne
  // (et on verrouille côté UI) le vainqueur dessus. Empêche les pronos contradictoires.
  useEffect(() => {
    if (!match) return
    const imp = impliedWinner(hs, as_, match.stage)
    if (imp !== null && winner !== imp) setWinner(imp)
    // Nul prédit en élimination : 'draw' n'a pas de sens (départage aux TAB), on le retire.
    else if (hs !== null && as_ !== null && hs === as_ && match.stage !== 'group' && winner === 'draw') {
      setWinner(null)
    }
  }, [hs, as_, match, winner])

  // Cohérence buteur / score : un 0-0 prédit n'a ni buteur ni passeur, on efface et on verrouille.
  useEffect(() => {
    if (hs === 0 && as_ === 0) {
      if (scorer) setScorer('')
      if (assister) setAssister('')
    }
  }, [hs, as_, scorer, assister])

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
  const amb = ambiance(match.kickoff_at, match.status, now)

  // Onglets internes : épuré avant le match, complet une fois lancé.
  const TABS: { key: 'resume' | 'momentum' | 'compos' | 'stats' | 'salon'; label: string; nav?: boolean }[] =
    started
      ? [
          { key: 'resume', label: 'Résumé' },
          { key: 'momentum', label: 'Momentum' },
          { key: 'compos', label: 'Compos' },
          { key: 'stats', label: 'Stats' },
          { key: 'salon', label: 'Salon', nav: true },
        ]
      : [
          { key: 'resume', label: 'Résumé' },
          { key: 'compos', label: 'Compos' },
        ]
  const activeTab = TABS.some((t) => t.key === tab) ? tab : 'resume'
  const momentumGoals = match.goals_timeline.map((g) => ({ min: g.min, team: g.team }))

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

  const scoreSet = hs !== null && as_ !== null
  // Score complet qui fixe l'issue → vainqueur verrouillé sur la déduction.
  const winnerLocked = scoreSet && impliedWinner(hs, as_, match.stage) !== null
  // Nul prédit en élimination → vainqueur libre (qui passe aux tirs au but).
  const koTie = scoreSet && hs === as_ && match.stage !== 'group'
  // 0-0 prédit → aucun but, donc buteur et passeur verrouillés.
  const goalless = hs === 0 && as_ === 0

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent">
        ‹ Matchs
      </Link>

      <div
        className="relative mb-4 overflow-hidden rounded-(--radius-card) p-5 text-white shadow-(--shadow-card)"
        style={matchGradient(match.home_code, match.away_code)}
      >
        {/* Grain léger pour la texture organique du dégradé */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{ backgroundImage: GRAIN_DATA_URI, opacity: 0.06 }}
        />
        <div className="relative">
          <p className="text-center text-[12px] font-medium uppercase tracking-wide text-white/70">
            {match.group_name ? `Groupe ${match.group_name}` : STAGE_LABELS[match.stage]} ·{' '}
            {dayLabel(match.kickoff_at)} · {timeLabel(match.kickoff_at)}
          </p>
          <div className="mt-4 flex items-center justify-center gap-5">
            <div className="flex w-28 flex-col items-center gap-1.5">
              <span className="text-5xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]">{teamFlag(match.home_code)}</span>
              <span className="text-center text-[15px] font-semibold leading-tight">
                {teamName(match.home_team, match.home_code)}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-center">
              {finished ? (
                <span className="tnum whitespace-nowrap text-[34px] font-bold">
                  {match.home_score} – {match.away_score}
                </span>
              ) : started && match.home_score !== null ? (
                <>
                  <span className="tnum whitespace-nowrap text-[34px] font-bold">
                    {match.home_score} – {match.away_score}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-white">
                    <span className="live-dot inline-block size-1.5 rounded-full bg-white" />
                    En direct
                  </span>
                </>
              ) : started ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">
                  <span className="live-dot inline-block size-1.5 rounded-full bg-white" />
                  En cours
                </span>
              ) : (
                <>
                  <span className="text-[15px] font-medium text-white/75">dans</span>
                  <span className="tnum whitespace-nowrap text-[20px] font-bold">{cd}</span>
                  {amb === 'imminent' && (
                    <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/85">
                      ça ferme bientôt
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex w-28 flex-col items-center gap-1.5">
              <span className="text-5xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]">{teamFlag(match.away_code)}</span>
              <span className="text-center text-[15px] font-semibold leading-tight">
                {teamName(match.away_team, match.away_code)}
              </span>
            </div>
          </div>
          {finished && match.winner_override && (
            <p className="mt-2 text-center text-[13px] text-white/80">
              Qualifié aux tirs au but :{' '}
              {match.winner_override === 'home'
                ? teamName(match.home_team, match.home_code)
                : teamName(match.away_team, match.away_code)}
            </p>
          )}
          {(match.venue || match.city) && (
            <p className="mt-3 text-center text-[13px] text-white/70">
              {[match.venue, match.city].filter(Boolean).join(' · ')}
            </p>
          )}
          {started && match.scorers.length > 0 && (
            <div className="mt-4 border-t border-white/20 pt-3 text-center text-[13px] text-white/85">
              <p>⚽️ {match.scorers.join(', ')}</p>
              {match.assisters.length > 0 && <p className="mt-1">🅰️ {match.assisters.join(', ')}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Onglets internes (segmented iOS) — l'en-tête dégradé reste fixe au-dessus */}
      <div className="mb-4 flex gap-0.5 rounded-[13px] bg-surface-2 p-1">
        {TABS.map((t) => {
          const isActive = !t.nav && activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => (t.nav ? navigate(`/match/${match.id}/chat`) : setTab(t.key as typeof tab))}
              className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] py-1.5 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.97] ${
                isActive ? 'bg-surface text-ink shadow-(--shadow-card)' : 'text-ink-2'
              }`}
            >
              {t.label}
              {t.nav && !finished && <span className="live-dot inline-block size-1.5 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'resume' && !started && match.odds && (
        <Card className="mb-4 p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink-2">Cotes</p>
            {match.odds.book && <p className="text-[11px] text-ink-3">{match.odds.book}</p>}
          </div>
          <div className="flex gap-2">
            {([
              { label: teamFlag(match.home_code), odd: match.odds.home },
              { label: 'Nul', odd: match.odds.draw },
              { label: teamFlag(match.away_code), odd: match.odds.away },
            ] as const).map((c, i) => {
              const fav = c.odd === Math.min(match.odds!.home, match.odds!.draw, match.odds!.away)
              return (
                <div
                  key={i}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 ${fav ? 'bg-accent-soft' : 'bg-surface-2'}`}
                >
                  <span className="text-[15px] font-medium text-ink-2">{c.label}</span>
                  <span className={`tnum text-[17px] font-bold ${fav ? 'text-accent' : ''}`}>
                    {c.odd.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {activeTab === 'momentum' && (
        <Card className="mb-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold tracking-tight">Momentum</h2>
            {!finished && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                <span className="live-dot inline-block size-1.5 rounded-full bg-accent" />
                en direct
              </span>
            )}
          </div>
          <div className="mt-4">
            {match.momentum && match.momentum.length > 1 ? (
              <Momentum
                home={{ code: match.home_code, name: match.home_team }}
                away={{ code: match.away_code, name: match.away_team }}
                data={match.momentum}
                goals={momentumGoals}
              />
            ) : (
              <p className="text-[14px] text-ink-2">Le momentum s'affiche dès que le jeu se met en route.</p>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'stats' && started && match.stats && (
        <Card className="mb-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold tracking-tight">Statistiques</h2>
            {!finished && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                <span className="live-dot inline-block size-1.5 rounded-full bg-accent" />
                en direct
              </span>
            )}
          </div>
          <div className="mt-4">
            <MatchStats
              stats={match.stats}
              home={{ code: match.home_code }}
              away={{ code: match.away_code }}
            />
          </div>
        </Card>
      )}

      {activeTab === 'stats' && started && !match.stats && (
        <Card className="p-5">
          <p className="text-[14px] text-ink-2">Statistiques indisponibles pour le moment.</p>
        </Card>
      )}

      {activeTab === 'compos' && (
        <Card className="mb-4 p-5">
          <h2 className="text-[20px] font-bold tracking-tight">Compositions</h2>
          {match.lineups ? (
            <div className="mt-4">
              <Lineup
                lineups={match.lineups}
                home={{ name: match.home_team, code: match.home_code }}
                away={{ name: match.away_team, code: match.away_code }}
              />
            </div>
          ) : (
            <p className="mt-1 text-[14px] text-ink-2">
              {started
                ? 'Compositions indisponibles pour ce match.'
                : 'Les compositions officielles s’afficheront ici environ 40 min avant le coup d’envoi.'}
            </p>
          )}
        </Card>
      )}

      {activeTab === 'resume' && (!started ? (
        <Card className="p-5">
          <h2 className="text-[20px] font-bold tracking-tight">Mon pronostic</h2>
          <p className="mb-5 mt-0.5 text-[13px] text-ink-2">Modifiable jusqu'au coup d'envoi.</p>

          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-ink-2">Vainqueur · 2 pts</p>
                {winnerLocked ? (
                  <span className="text-[12px] font-medium text-ink-3">déduit du score</span>
                ) : koTie ? (
                  <span className="text-[12px] font-medium text-ink-3">qui se qualifie aux t.a.b. ?</span>
                ) : null}
              </div>
              <Segmented options={winnerOptions} value={winner} onChange={setWinner} disabled={winnerLocked} />
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Score exact · 6 pts</p>
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

            <PlayerInput
              label="Buteur · 4 pts"
              value={scorer}
              onChange={setScorer}
              placeholder={goalless ? '—' : 'Tape un nom…'}
              teams={[match.home_code, match.away_code]}
              disabled={goalless}
              hint={goalless ? 'Pas de but sur un 0-0 : pas de buteur.' : 'Tape pour filtrer, puis choisis dans la liste.'}
            />
            <PlayerInput
              label="Passeur décisif · 4 pts"
              value={assister}
              onChange={setAssister}
              placeholder={goalless ? '—' : 'Tape un nom…'}
              teams={[match.home_code, match.away_code]}
              disabled={goalless}
              hint={goalless ? 'Pas de but sur un 0-0 : pas de passeur.' : undefined}
            />

            {error && <p className="text-[14px] font-medium text-negative">{error}</p>}
            <Button onClick={submit} loading={saving} className="w-full">
              {saved ? 'Enregistré ✓' : mine ? 'Mettre à jour mon prono' : 'Valider mon prono'}
            </Button>
          </div>
        </Card>
      ) : (
        <section>
          {finished && mine && session && match.home_score !== null && match.away_score !== null && (() => {
            const mp = points.get(session.user.id)
            const total = mp ? mp.winner_pts + mp.scorer_pts + mp.assister_pts + mp.exact_pts : 0
            // Étiquette de ce qui a été trouvé, pour la carte de partage.
            const hits: string[] = []
            if (mp?.exact_pts) hits.push('Score exact 🎯')
            else if (mp?.winner_pts) hits.push('Vainqueur trouvé')
            if (mp?.scorer_pts) hits.push('buteur')
            if (mp?.assister_pts) hits.push('passeur')
            const badge =
              total === 0
                ? 'Raté — on se refait au prochain 😬'
                : hits.length
                  ? hits.join(' + ').replace(/^(.)/, (c) => c.toUpperCase())
                  : `+${total} pts`
            return (
              <button
                type="button"
                onClick={() =>
                  setShare({
                    kind: 'match',
                    name: names.get(session.user.id) ?? 'Moi',
                    home: { code: match.home_code, name: match.home_team },
                    away: { code: match.away_code, name: match.away_team },
                    homeScore: match.home_score!,
                    awayScore: match.away_score!,
                    badge,
                    points: total,
                  })
                }
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-(--radius-card) bg-accent-soft py-3 text-[15px] font-semibold text-accent transition-transform duration-150 active:scale-[0.98]"
              >
                <ShareIcon /> Partager mon prono
              </button>
            )
          })()}
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
      ))}

      {share && <ShareSheet data={share} onClose={() => setShare(null)} />}
    </div>
  )
}
