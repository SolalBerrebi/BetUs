import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useApp, useNow } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { Message, Prediction } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { countdown, hasStarted } from '../lib/format'
import { Segmented, Spinner } from '../components/ui'

interface Online {
  user_id: string
  name: string
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_BG = ['bg-[#0a7aff]', 'bg-[#34c759]', 'bg-[#ff9500]', 'bg-[#af52de]', 'bg-[#ff2d55]', 'bg-[#5ac8fa]']
function avatarColor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % AVATAR_BG.length
  return AVATAR_BG[h]
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function ChatRoom() {
  const { id } = useParams()
  const matchId = Number(id)
  const { matches, profiles, session } = useApp()
  const now = useNow()
  const match = matches.find((m) => m.id === matchId)
  const me = session?.user.id

  const [messages, setMessages] = useState<Message[] | null>(null)
  const [online, setOnline] = useState<Online[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [view, setView] = useState<'chat' | 'pronos'>('chat')
  const [preds, setPreds] = useState<Prediction[] | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles])
  const started = match ? hasStarted(match.kickoff_at, now) : false

  // Pronos de tout le monde (visibles une fois le match commencé, comme la fiche match)
  useEffect(() => {
    if (view !== 'pronos' || !matchId || !started) return
    supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId)
      .then(({ data }) => setPreds((data as Prediction[]) ?? []))
  }, [view, matchId, started])

  // Messages initiaux + abonnement realtime + présence
  useEffect(() => {
    if (!matchId || !me || !started) return
    let cancelled = false

    supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at')
      .limit(300)
      .then(({ data }) => {
        if (!cancelled) setMessages((data as Message[]) ?? [])
      })

    const myName = names.get(me) ?? 'moi'
    const channel = supabase.channel(`room:${matchId}`, {
      config: { presence: { key: me } },
    })
    channelRef.current = channel

    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (!prev) return [msg]
            if (prev.some((m) => m.id === msg.id)) return prev // déjà ajouté (optimiste)
            return [...prev, msg]
          })
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<Online>()
        const seen = new Map<string, Online>()
        for (const metas of Object.values(state)) {
          for (const m of metas) seen.set(m.user_id, { user_id: m.user_id, name: m.name })
        }
        setOnline([...seen.values()])
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ user_id: me, name: myName })
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [matchId, me, started, names])

  // Auto-scroll en bas à l'arrivée d'un message
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !me || sending) return
    setSending(true)
    setDraft('')
    const { data, error } = await supabase
      .from('messages')
      .insert({ match_id: matchId, user_id: me, body })
      .select()
      .single()
    setSending(false)
    if (error) {
      setDraft(body) // on rend le texte si échec
      return
    }
    // Ajout optimiste (le realtime dédupe par id)
    const msg = data as Message
    setMessages((prev) => (prev && prev.some((m) => m.id === msg.id) ? prev : [...(prev ?? []), msg]))
  }

  if (!match) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    )
  }

  const score =
    match.home_score !== null && match.away_score !== null
      ? `${match.home_score} – ${match.away_score}`
      : null

  return (
    <div className="flex h-dvh flex-col">
      {/* En-tête : score + présence */}
      <header className="sticky top-0 z-10 border-b border-line/60 bg-white/80 px-4 pb-3 pt-4 backdrop-blur-xl">
        <Link to={`/match/${match.id}`} className="mb-2 inline-flex items-center gap-1 text-[15px] font-medium text-accent">
          ‹ Match
        </Link>
        <div className="flex items-center justify-center gap-3">
          <span className="text-[22px]">{teamFlag(match.home_code)}</span>
          <span className="text-[15px] font-semibold">{teamName(match.home_team, match.home_code)}</span>
          <span className="tnum min-w-16 text-center text-[20px] font-bold">
            {score ?? (started ? 'live' : '—')}
          </span>
          <span className="text-[15px] font-semibold">{teamName(match.away_team, match.away_code)}</span>
          <span className="text-[22px]">{teamFlag(match.away_code)}</span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="live-dot inline-block size-2 rounded-full bg-positive" />
          <span className="text-[13px] font-medium text-ink-2">
            {online.length > 0
              ? `${online.length} ${online.length > 1 ? 'amis regardent' : 'ami regarde'}`
              : 'Salon en direct'}
          </span>
          <div className="flex -space-x-1.5">
            {online.slice(0, 6).map((o) => (
              <span
                key={o.user_id}
                title={o.name}
                className={`flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white ${avatarColor(o.user_id)}`}
              >
                {initials(o.name)}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Segmented
            options={[
              { value: 'chat', label: 'Chat' },
              { value: 'pronos', label: 'Pronos du groupe' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </header>

      {view === 'pronos' ? (
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {preds === null ? (
            <div className="py-10 text-center">
              <Spinner />
            </div>
          ) : preds.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] text-ink-2">Aucun prono sur ce match.</p>
          ) : (
            preds
              .slice()
              .sort((a, b) => (names.get(a.user_id) ?? '').localeCompare(names.get(b.user_id) ?? ''))
              .map((p) => (
                <div key={p.user_id} className="rounded-2xl bg-surface px-4 py-3 shadow-(--shadow-card)">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold">
                      {names.get(p.user_id) ?? '?'}
                      {p.user_id === me && <span className="font-normal text-ink-3"> (moi)</span>}
                    </span>
                    {p.pred_home_score !== null && (
                      <span className="tnum text-[14px] font-semibold text-ink-2">
                        {p.pred_home_score}–{p.pred_away_score}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-2">
                    {p.winner
                      ? p.winner === 'draw'
                        ? 'Nul'
                        : p.winner === 'home'
                          ? teamName(match.home_team, match.home_code)
                          : teamName(match.away_team, match.away_code)
                      : '—'}
                    {p.scorer && ` · ⚽️ ${p.scorer}`}
                    {p.assister && ` · 🅰️ ${p.assister}`}
                  </p>
                </div>
              ))
          )}
        </div>
      ) : (
      /* Fil de messages */
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages === null ? (
          <div className="py-10 text-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="px-6 py-10 text-center text-[15px] text-ink-2">
            Personne n'a encore parlé. Lance l'ambiance ! 🎉
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.user_id === me
            const prev = messages[i - 1]
            const showAuthor = !mine && (!prev || prev.user_id !== m.user_id)
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {showAuthor && (
                  <span className="mb-0.5 ml-3 text-[12px] font-medium text-ink-3">
                    {names.get(m.user_id) ?? '?'}
                  </span>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] ${
                    mine ? 'bg-accent text-white' : 'bg-surface text-ink shadow-(--shadow-card)'
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                </div>
                <span className="mt-0.5 px-2 text-[10px] text-ink-3">{timeLabel(m.created_at)}</span>
              </div>
            )
          })
        )}
      </div>
      )}

      {/* Saisie */}
      {!started ? (
        <div className="border-t border-line/60 px-4 py-4 text-center text-[14px] text-ink-2">
          Le salon ouvre au coup d'envoi — dans {countdown(match.kickoff_at, now)}.
        </div>
      ) : view === 'chat' ? (
        <form
          onSubmit={send}
          className="sticky bottom-0 flex items-center gap-2 border-t border-line/60 bg-white/80 px-3 py-2.5 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Ton message…"
            className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-[16px] outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Envoyer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all duration-150 active:scale-90 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11l5-5 5 5M12 6v13" />
            </svg>
          </button>
        </form>
      ) : null}
    </div>
  )
}
