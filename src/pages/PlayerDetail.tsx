import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { MatchPoints, PlayerComment, Prediction, TournamentBreakdownRow, TournamentPrediction } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { dayLabel } from '../lib/format'
import { Badge, Button, Card, EmptyState, PageTitle, Spinner } from '../components/ui'

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

function commentTime(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const TOURNAMENT_ITEMS: { slot: number; item: string; max: number; get: (t: TournamentPrediction) => string | null }[] = [
  { slot: 1, item: 'Meilleur buteur', max: 25, get: (t) => t.top_scorer },
  { slot: 2, item: 'Meilleur passeur', max: 25, get: (t) => t.top_assister },
  { slot: 3, item: 'Meilleur gardien', max: 10, get: (t) => t.best_keeper },
  { slot: 4, item: 'Finale', max: 50, get: (t) => [t.finalist_a, t.finalist_b].filter(Boolean).join(' – ') || null },
  { slot: 5, item: 'Équipe gagnante', max: 40, get: (t) => t.winner },
  { slot: 6, item: 'Meilleur joueur', max: 10, get: (t) => t.best_player },
]

export default function PlayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/classement'))
  const { matches, profiles, session, refresh } = useApp()
  const [points, setPoints] = useState<MatchPoints[] | null>(null)
  const [preds, setPreds] = useState<Map<number, Prediction>>(new Map())
  const [tournament, setTournament] = useState<TournamentBreakdownRow[]>([])
  const [tpred, setTpred] = useState<TournamentPrediction | null>(null)
  const [comments, setComments] = useState<PlayerComment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const player = profiles.find((p) => p.id === id)
  const isMe = id === session?.user.id
  const me = session?.user.id
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles])

  // Commentaires de la fiche + temps réel
  useEffect(() => {
    if (!id) return
    supabase
      .from('player_comments')
      .select('*')
      .eq('target_user_id', id)
      .order('created_at')
      .then(({ data }) => setComments((data as PlayerComment[]) ?? []))
    const ch = supabase
      .channel(`pc-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_comments', filter: `target_user_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const c = payload.new as PlayerComment
            setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]))
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as PlayerComment
            setComments((prev) => prev.filter((x) => x.id !== old.id))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [id])

  useEffect(() => setNoteDraft(player?.pronos_note ?? ''), [player?.pronos_note])

  async function saveNote() {
    if (!me) return
    setSavingNote(true)
    await supabase.from('profiles').update({ pronos_note: noteDraft.trim() || null }).eq('id', me)
    await refresh()
    setSavingNote(false)
  }

  async function postComment() {
    if (!me || !id || !commentDraft.trim()) return
    setPosting(true)
    const { error } = await supabase
      .from('player_comments')
      .insert({ target_user_id: id, author_id: me, body: commentDraft.trim() })
    if (!error) setCommentDraft('')
    setPosting(false)
  }

  async function deleteComment(cid: number) {
    setComments((prev) => prev.filter((x) => x.id !== cid))
    await supabase.from('player_comments').delete().eq('id', cid)
  }

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
      <button
        type="button"
        onClick={goBack}
        className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent"
      >
        ‹ Classement
      </button>
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

      {/* Mot du pronostiqueur : note perso (éditable par soi) */}
      {isMe ? (
        <section className="mb-6">
          <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Ton mot sur tes pronos</h2>
          <Card className="p-4">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Une punchline sur tes pronos… (ex. « La France ramène la coupe 🇫🇷 »)"
              className="w-full resize-none rounded-xl bg-surface-2 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[12px] text-ink-3">{noteDraft.length}/200 · visible par tous</span>
              <Button
                variant="secondary"
                onClick={saveNote}
                loading={savingNote}
                disabled={noteDraft.trim() === (player?.pronos_note ?? '')}
                className="px-4 py-1.5 text-[14px]"
              >
                Enregistrer
              </Button>
            </div>
          </Card>
        </section>
      ) : (
        player?.pronos_note && (
          <Card className="mb-6 p-4">
            <p className="text-[15px] italic text-ink">« {player.pronos_note} »</p>
          </Card>
        )
      )}

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
                  max={it.max}
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
                          max={2}
                        />
                        <PointLine
                          label="Score exact"
                          detail={pred.pred_home_score !== null ? `${pred.pred_home_score}–${pred.pred_away_score}` : '—'}
                          won={mp.exact_pts > 0}
                          max={6}
                        />
                        <PointLine
                          label="Buteur"
                          detail={pred.scorer || '—'}
                          won={mp.scorer_pts > 0}
                          max={4}
                        />
                        <PointLine
                          label="Passeur"
                          detail={pred.assister || '—'}
                          won={mp.assister_pts > 0}
                          max={4}
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

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">
          Commentaires {comments.length > 0 && <span className="text-ink-3">({comments.length})</span>}
        </h2>
        <Card className="p-4">
          {comments.length === 0 ? (
            <p className="pb-3 text-center text-[14px] text-ink-2">
              Aucun commentaire. {isMe ? 'Les copains vont sûrement réagir 😏' : 'Lance la chambre ! 🔥'}
            </p>
          ) : (
            <div className="mb-3 space-y-3">
              {comments.map((c) => {
                const mine = c.author_id === me
                return (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink-2">
                        {names.get(c.author_id) ?? '?'}
                        <span className="ml-1.5 font-normal text-ink-3">{commentTime(c.created_at)}</span>
                      </p>
                      <p className="whitespace-pre-wrap break-words text-[15px]">{c.body}</p>
                    </div>
                    {mine && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        aria-label="Supprimer"
                        className="shrink-0 text-[18px] leading-none text-ink-3 active:text-danger"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              maxLength={500}
              placeholder={isMe ? 'Réponds ou commente…' : 'Commente ses pronos…'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && commentDraft.trim()) postComment()
              }}
              className="h-10 flex-1 rounded-full bg-surface-2 px-4 text-[15px] outline-none focus:ring-2 focus:ring-accent"
            />
            <Button
              variant="secondary"
              onClick={postComment}
              loading={posting}
              disabled={!commentDraft.trim()}
              className="px-4 py-1.5 text-[14px]"
            >
              Envoyer
            </Button>
          </div>
        </Card>
      </section>
    </div>
  )
}
