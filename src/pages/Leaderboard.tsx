import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow } from '../lib/types'
import { Card, PageTitle, Segmented, Spinner } from '../components/ui'
import TopPlayers from '../components/TopPlayers'

function rankSort(a: LeaderboardRow, b: LeaderboardRow): number {
  return (
    b.total_points - a.total_points ||
    b.exact_count - a.exact_count ||
    b.scorer_count - a.scorer_count ||
    b.assister_count - a.assister_count ||
    a.display_name.localeCompare(b.display_name)
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

const sameOrder = (a: LeaderboardRow[], b: LeaderboardRow[]) =>
  a.length === b.length && a.every((r, i) => r.user_id === b[i].user_id)

type View = 'us' | 'scorer' | 'assister'

export default function Leaderboard() {
  const { session, matches, profiles, myTournamentPrediction } = useApp()
  const [view, setView] = useState<View>('us')
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  // Rang d'avant le(s) match(s) en cours → delta ▲/▼ pendant le live.
  const [prevRank, setPrevRank] = useState<Map<string, number>>(new Map())
  const rowsRef = useRef<LeaderboardRow[] | null>(null)

  const live = matches.some((m) => m.status === 'live')

  useEffect(() => {
    supabase.from('leaderboard').select('*').then(({ data }) => {
      if (!data) return
      const sorted = (data as LeaderboardRow[]).sort(rankSort)
      const prev = rowsRef.current
      const apply = () => {
        rowsRef.current = sorted
        setRows(sorted)
      }
      // Réordonnancement animé façon iOS (View Transitions) quand l'ordre change.
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prev && !sameOrder(prev, sorted) && doc.startViewTransition && !reduce) {
        doc.startViewTransition(() => flushSync(apply))
      } else {
        apply()
      }
    })
  }, [matches, profiles])

  useEffect(() => {
    supabase.from('rank_snapshot').select('user_id, rank').then(({ data }) => {
      if (data) setPrevRank(new Map((data as { user_id: string; rank: number }[]).map((r) => [r.user_id, r.rank])))
    })
  }, [matches])

  const paidCount = profiles.filter((p) => p.has_paid).length
  const pot = paidCount * 30

  return (
    <div>
      <PageTitle sub={pot > 0 ? `Cagnotte ${pot} € — 70 % au 1er, 30 % au 2e` : 'Mis à jour en temps réel'}>
        Classement
      </PageTitle>

      <Segmented
        options={[
          { value: 'us', label: 'Nous' },
          { value: 'scorer', label: 'Buteurs' },
          { value: 'assister', label: 'Passeurs' },
        ]}
        value={view}
        onChange={setView}
      />

      <div className="mt-4">
      {view !== 'us' ? (
        <TopPlayers
          category={view}
          myPick={
            view === 'scorer'
              ? myTournamentPrediction?.top_scorer ?? null
              : myTournamentPrediction?.top_assister ?? null
          }
        />
      ) : (
        <>
      {live && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-full bg-warning-soft py-2 text-[12.5px] font-semibold text-[#c77700]">
          <span className="live-dot inline-block size-1.5 rounded-full bg-warning" />
          Classement en direct · points provisoires
        </div>
      )}

      {rows === null ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y divide-line/60">
          {rows.map((r, i) => {
            const isMe = r.user_id === session?.user.id
            const before = prevRank.get(r.user_id)
            // delta > 0 = a gagné des places depuis le coup d'envoi
            const delta = live && before ? before - (i + 1) : 0
            return (
              <Link
                to={`/joueur/${r.user_id}`}
                key={r.user_id}
                style={live ? { viewTransitionName: `lb-${r.user_id}` } : undefined}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-surface-2/70 ${isMe ? 'bg-accent-soft/50' : ''}`}
              >
                <span className="tnum w-8 text-center text-[17px] font-bold text-ink-2">
                  {i < 3 && r.total_points > 0 ? MEDALS[i] : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">
                    {r.display_name} {isMe && <span className="font-normal text-ink-3">(moi)</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {r.exact_count} score{r.exact_count > 1 ? 's' : ''} exact{r.exact_count > 1 ? 's' : ''} ·{' '}
                    {r.scorer_count} buteur{r.scorer_count > 1 ? 's' : ''} · {r.assister_count} passeur
                    {r.assister_count > 1 ? 's' : ''}
                  </p>
                </div>
                {delta !== 0 && (
                  <span
                    className={`tnum inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      delta > 0 ? 'bg-positive-soft text-[#1d9a45]' : 'bg-red-50 text-negative'
                    }`}
                  >
                    {delta > 0 ? '▲' : '▼'}
                    {Math.abs(delta)}
                  </span>
                )}
                <span className="tnum text-[20px] font-bold">{r.total_points}</span>
                <span className="-ml-1 pt-1 text-[12px] font-medium text-ink-3">pts</span>
                <span className="text-[18px] text-ink-3/60">›</span>
              </Link>
            )
          })}
          {rows.length === 0 && (
            <p className="px-5 py-10 text-center text-[15px] text-ink-2">Aucun participant pour l'instant.</p>
          )}
        </Card>
      )}

      <p className="mt-4 px-2 text-center text-[12px] leading-relaxed text-ink-3">
        Touche un participant pour voir le détail de ses points.
        <br />
        Égalité départagée par : scores exacts, puis buteurs trouvés, puis passeurs trouvés.
      </p>
        </>
      )}
      </div>
    </div>
  )
}
