import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow } from '../lib/types'
import { Card, PageTitle, Spinner } from '../components/ui'

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

export default function Leaderboard() {
  const { session, matches, profiles } = useApp()
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)

  useEffect(() => {
    supabase.from('leaderboard').select('*').then(({ data }) => {
      if (data) setRows((data as LeaderboardRow[]).sort(rankSort))
    })
    // `matches`/`profiles` changent via realtime → re-fetch du classement
  }, [matches, profiles])

  const paidCount = profiles.filter((p) => p.has_paid).length
  const pot = paidCount * 30

  return (
    <div>
      <PageTitle sub={pot > 0 ? `Cagnotte ${pot} € — 70 % au 1er, 30 % au 2e` : 'Mis à jour en temps réel'}>
        Classement
      </PageTitle>

      {rows === null ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y divide-line/60">
          {rows.map((r, i) => {
            const isMe = r.user_id === session?.user.id
            return (
              <div key={r.user_id} className={`flex items-center gap-3 px-4 py-3.5 ${isMe ? 'bg-accent-soft/50' : ''}`}>
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
                <span className="tnum text-[20px] font-bold">{r.total_points}</span>
                <span className="-ml-2 pt-1 text-[12px] font-medium text-ink-3">pts</span>
              </div>
            )
          })}
          {rows.length === 0 && (
            <p className="px-5 py-10 text-center text-[15px] text-ink-2">Aucun participant pour l'instant.</p>
          )}
        </Card>
      )}

      <p className="mt-4 px-2 text-center text-[12px] leading-relaxed text-ink-3">
        Égalité départagée par : scores exacts, puis buteurs trouvés, puis passeurs trouvés.
      </p>
    </div>
  )
}
