import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import type { Match } from '../lib/types'
import { teamFlag, teamName, isPlaceholder } from '../lib/teams'
import {
  buildBracket,
  groupStandings,
  resolveGroupSlot,
  ROUND_LABEL,
  ROUND_ORDER,
  type GroupTable,
  type StandingRow,
} from '../lib/bracket'

// Géométrie du bracket (px)
const CARD_W = 150
const CARD_H = 58
const COL_GAP = 28
const ROW_PITCH = 82
const PAD_TOP = 12
const COL_STRIDE = CARD_W + COL_GAP

type Tab = 'group' | (typeof ROUND_ORDER)[number]

function winnerSide(m: Match): 'home' | 'away' | null {
  if (m.home_score == null || m.away_score == null) return null
  if (m.home_score > m.away_score) return 'home'
  if (m.away_score > m.home_score) return 'away'
  return m.winner_override
}

// Équipe à afficher pour un côté : l'équipe réelle si connue, sinon résolution
// du placeholder de 16e via le classement de groupe (provisoire si groupe en cours).
function effectiveTeam(
  code: string | null,
  name: string,
  standings: GroupTable[],
): { code: string | null; name: string; provisional: boolean } {
  if (!isPlaceholder(code)) return { code, name, provisional: false }
  const r = resolveGroupSlot(name, standings)
  return r ?? { code, name, provisional: false }
}

function TeamRow({
  eff,
  score,
  win,
}: {
  eff: { code: string | null; name: string; provisional: boolean }
  score: number | null
  win: boolean
}) {
  const tbd = isPlaceholder(eff.code)
  return (
    <div className="flex items-center gap-1.5 px-2">
      <span className="w-4 shrink-0 text-center text-[13px]">{teamFlag(eff.code)}</span>
      <span
        className={`min-w-0 flex-1 truncate text-[12px] ${
          tbd
            ? 'text-ink-3'
            : win
              ? 'font-bold text-ink'
              : eff.provisional
                ? 'font-medium italic text-ink-2'
                : 'font-medium text-ink-2'
        }`}
      >
        {teamName(eff.name, eff.code)}
      </span>
      <span className={`tnum shrink-0 text-[12px] ${win ? 'font-bold text-ink' : 'text-ink-3'}`}>
        {score ?? ''}
      </span>
    </div>
  )
}

function MatchCard({
  m,
  x,
  y,
  standings,
  onTap,
}: {
  m: Match
  x: number
  y: number
  standings: GroupTable[]
  onTap: () => void
}) {
  const win = winnerSide(m)
  const live = m.status === 'live'
  const home = effectiveTeam(m.home_code, m.home_team, standings)
  const away = effectiveTeam(m.away_code, m.away_team, standings)
  return (
    <button
      type="button"
      onClick={onTap}
      className="absolute flex flex-col justify-center overflow-hidden rounded-[13px] border border-line/70 bg-surface shadow-(--shadow-card) transition-transform duration-150 active:scale-[0.97]"
      style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
    >
      {live && (
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-warning live-dot" />
      )}
      <TeamRow eff={home} score={m.home_score} win={win === 'home'} />
      <div className="mx-2 my-[3px] h-px bg-line/60" />
      <TeamRow eff={away} score={m.away_score} win={win === 'away'} />
    </button>
  )
}

function KnockoutCanvas({ matches, standings }: { matches: Match[]; standings: GroupTable[] }) {
  const navigate = useNavigate()
  const { nodes, leafCount, thirdPlace, final } = useMemo(() => buildBracket(matches), [matches])

  const totalW = ROUND_ORDER.length * COL_STRIDE - COL_GAP
  const colX = (c: number) => c * COL_STRIDE
  const rowY = (r: number) => PAD_TOP + r * ROW_PITCH
  const centerY = (r: number) => rowY(r) + CARD_H / 2

  // 3e place : posée sous la finale, à hauteur de la dernière feuille.
  const thirdY = PAD_TOP + (leafCount - 1) * ROW_PITCH
  const totalH = Math.max(leafCount, 1) * ROW_PITCH + PAD_TOP + 8

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.match.id, n])), [nodes])

  // Connecteurs : du bord droit de chaque enfant vers le bord gauche du parent.
  const links: string[] = []
  for (const n of nodes) {
    const childIds = [n.match.home_slot, n.match.away_slot, n.match.home_team, n.match.away_team]
      .map((s) => (s && /^W\d+$/.test(s) ? Number(s.slice(1)) : null))
      .filter((v): v is number => v != null)
    const px = colX(n.col)
    const py = centerY(n.row)
    for (const cid of childIds) {
      const child = nodeById.get(cid)
      if (!child) continue
      const cx = colX(child.col) + CARD_W
      const cy = centerY(child.row)
      const midX = (cx + px) / 2
      links.push(`M${cx} ${cy} H${midX} V${py} H${px}`)
    }
  }

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      <svg
        className="pointer-events-none absolute inset-0"
        width={totalW}
        height={totalH}
        fill="none"
      >
        {links.map((d, i) => (
          <path key={i} d={d} stroke="var(--color-ink-3)" strokeOpacity={0.5} strokeWidth={1.5} />
        ))}
      </svg>

      {/* En-têtes de colonne */}
      {ROUND_ORDER.map((stage, c) => (
        <div
          key={stage}
          className="absolute text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3"
          style={{ left: colX(c), top: -2, width: CARD_W }}
        >
          {ROUND_LABEL[stage]}
        </div>
      ))}

      {nodes.map((n) => (
        <MatchCard
          key={n.match.id}
          m={n.match}
          x={colX(n.col)}
          y={rowY(n.row)}
          standings={standings}
          onTap={() => navigate(`/match/${n.match.id}`)}
        />
      ))}

      {thirdPlace && final && (
        <>
          <div
            className="absolute text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3"
            style={{ left: colX(ROUND_ORDER.length - 1), top: thirdY - 18, width: CARD_W }}
          >
            Petite finale
          </div>
          <MatchCard
            m={thirdPlace}
            x={colX(ROUND_ORDER.length - 1)}
            y={thirdY}
            standings={standings}
            onTap={() => navigate(`/match/${thirdPlace.id}`)}
          />
        </>
      )}
    </div>
  )
}

function StandingsTable({ group, rows }: { group: string; rows: StandingRow[] }) {
  return (
    <div className="rounded-(--radius-card) bg-surface shadow-(--shadow-card)">
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
        <h3 className="text-[15px] font-bold">Groupe {group}</h3>
        <div className="tnum flex gap-3 pr-0.5 text-[11px] font-semibold uppercase text-ink-3">
          <span className="w-4 text-center">J</span>
          <span className="w-7 text-center">Diff</span>
          <span className="w-5 text-center">Pts</span>
        </div>
      </div>
      <div className="px-2 pb-2">
        {rows.map((r, i) => {
          const qualifies = i < 2
          return (
            <div
              key={r.code ?? r.team}
              className="flex items-center gap-2 rounded-[10px] px-2 py-1.5"
            >
              <span
                className={`w-4 shrink-0 text-center text-[12px] font-bold ${
                  qualifies ? 'text-positive' : i === 2 ? 'text-warning' : 'text-ink-3'
                }`}
              >
                {i + 1}
              </span>
              <span className="w-5 shrink-0 text-center text-[15px]">{teamFlag(r.code)}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {teamName(r.team, r.code)}
              </span>
              <div className="tnum flex gap-3 text-[13px] text-ink-2">
                <span className="w-4 text-center">{r.played}</span>
                <span className="w-7 text-center">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </span>
                <span className="w-5 text-center font-bold text-ink">{r.pts}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Bracket() {
  const { matches } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('group')
  const scrollRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(false) // évite la lutte scroll programmatique / sync

  const groups = useMemo(() => groupStandings(matches), [matches])

  // Clic onglet round → scroll horizontal vers la colonne.
  useEffect(() => {
    if (tab === 'group') return
    const col = ROUND_ORDER.indexOf(tab)
    const el = scrollRef.current
    if (!el || col < 0) return
    lockRef.current = true
    el.scrollTo({ left: col * COL_STRIDE - 8, behavior: 'smooth' })
    const t = setTimeout(() => (lockRef.current = false), 400)
    return () => clearTimeout(t)
  }, [tab])

  const onScroll = () => {
    if (lockRef.current || tab === 'group') return
    const el = scrollRef.current
    if (!el) return
    const col = Math.round((el.scrollLeft + 8) / COL_STRIDE)
    const stage = ROUND_ORDER[Math.max(0, Math.min(ROUND_ORDER.length - 1, col))]
    if (stage && stage !== tab) setTab(stage)
  }

  const TABS: Tab[] = ['group', ...ROUND_ORDER]

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header
        className="sticky top-0 z-10 bg-bg/80 px-4 pb-2 backdrop-blur-xl"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-1 inline-flex items-center gap-0.5 text-[16px] font-medium text-accent active:opacity-60"
          >
            ‹ Matchs
          </button>
          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[17px] font-bold">
            Tableau
          </h1>
        </div>

        {/* Chips de phase, défilables */}
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-1.5">
            {TABS.map((t) => {
              const active = t === tab
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                    active ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {ROUND_LABEL[t]}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {tab === 'group' ? (
        <div
          className="space-y-3 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          {groups.map((g) => (
            <StandingsTable key={g.group} group={g.group} rows={g.rows} />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="grow overflow-auto px-4 pt-7"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          <KnockoutCanvas matches={matches} standings={groups} />
        </div>
      )}
    </div>
  )
}
