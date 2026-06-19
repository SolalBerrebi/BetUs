import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TopPlayer } from '../lib/types'
import { teamFlag } from '../lib/teams'
import { Card, Spinner } from './ui'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Le pari du joueur (nom canonique) correspond-il à ce buteur/passeur ?
function matchesPick(player: string, pick: string | null): boolean {
  if (!pick) return false
  const a = norm(player)
  const b = norm(pick)
  return a === b || (b.length >= 4 && a.includes(b)) || (a.length >= 4 && b.includes(a))
}

export default function TopPlayers({
  category,
  myPick,
}: {
  category: 'scorer' | 'assister'
  myPick: string | null
}) {
  const [rows, setRows] = useState<TopPlayer[] | null>(null)

  useEffect(() => {
    setRows(null)
    supabase
      .from('top_players')
      .select('*')
      .eq('category', category)
      .order('rank')
      .then(({ data }) => {
        if (data) setRows(data as TopPlayer[])
      })
  }, [category])

  const unit = category === 'scorer' ? 'buts' : 'passes'
  const mine = rows?.find((r) => matchesPick(r.player, myPick))

  if (rows === null) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <p className="px-5 py-10 text-center text-[15px] text-ink-2">
          Le classement s'affichera dès les premiers buts.
        </p>
      </Card>
    )
  }

  return (
    <div>
      {myPick && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-(--radius-card) bg-accent-soft px-4 py-3">
          <span className="text-[14px] text-accent">
            <span className="font-semibold">Ton pari · {myPick}</span>
          </span>
          <span className="text-[14px] font-semibold text-accent">
            {mine
              ? `${mine.rank}${mine.rank === 1 ? 'ᵉʳ' : 'ᵉ'} · ${mine.value} ${unit}`
              : 'pas encore classé'}
          </span>
        </div>
      )}

      <Card className="divide-y divide-line/60">
        {rows.map((r) => {
          const mineRow = matchesPick(r.player, myPick)
          return (
            <div
              key={r.rank}
              className={`flex items-center gap-3 px-4 py-3 ${mineRow ? 'bg-accent-soft/50' : ''}`}
            >
              <span className="tnum w-6 text-center text-[15px] font-bold text-ink-2">{r.rank}</span>
              <span className="text-[20px] leading-none">{teamFlag(r.team_code)}</span>
              <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                {r.player}
                {mineRow && (
                  <span className="ml-2 inline-block rounded-full bg-accent px-2 py-0.5 align-middle text-[10px] font-bold text-white">
                    ton pari
                  </span>
                )}
              </span>
              <span className="tnum text-[18px] font-bold">{r.value}</span>
              <span className="-ml-1 pt-1 text-[11px] font-medium text-ink-3">{unit}</span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
