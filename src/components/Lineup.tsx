import { useMemo } from 'react'
import type { LineupPlayer, MatchLineups, TeamLineup } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'

interface Placed {
  p: LineupPlayer
  x: number // %
  y: number // %
}

// "K. Mbappé" → "Mbappé" ; "Kylian Mbappé" → "Mbappé" ; garde "Van Dijk".
function shortName(name: string): string {
  const stripped = name.replace(/^\p{Lu}\.\s+/u, '').trim()
  const parts = stripped.split(/\s+/)
  if (parts.length <= 1) return stripped
  const particles = new Set(['van', 'de', 'der', 'den', 'el', 'al', 'da', 'dos', 'di', 'le', 'la'])
  // Recolle une particule au dernier mot ("van Dijk", "El Khannouss").
  const last = parts[parts.length - 1]
  const prev = parts[parts.length - 2].toLowerCase()
  return particles.has(prev) ? `${parts[parts.length - 2]} ${last}` : last
}

// Place les 11 titulaires depuis la grille API ("ligne:colonne", ligne 1 = gardien).
// L'équipe à domicile défend en bas, l'équipe extérieure en haut (miroir).
function placeTeam(team: TeamLineup, side: 'home' | 'away'): Placed[] {
  const xi = team.startXI
  const rowsMap = new Map<number, LineupPlayer[]>()
  xi.forEach((p, idx) => {
    const m = p.grid?.match(/^(\d+):(\d+)$/)
    const row = m ? Number(m[1]) : idx + 1 // sans grille : une ligne par joueur
    const arr = rowsMap.get(row) ?? []
    arr.push(p)
    rowsMap.set(row, arr)
  })
  const rows = [...rowsMap.keys()].sort((a, b) => a - b)
  const nRows = rows.length
  const placed: Placed[] = []
  rows.forEach((row, i) => {
    const players = rowsMap
      .get(row)!
      .slice()
      .sort((a, b) => Number(a.grid?.split(':')[1] ?? 0) - Number(b.grid?.split(':')[1] ?? 0))
    const n = players.length
    players.forEach((p, k) => {
      let xFrac = (k + 1) / (n + 1)
      if (side === 'away') xFrac = 1 - xFrac
      const band = (i + 0.5) / nRows
      const yFrac = side === 'home' ? 1 - 0.46 * band : 0.46 * band
      placed.push({ p, x: xFrac * 100, y: yFrac * 100 })
    })
  })
  return placed
}

function PlayerMarker({ placed, side }: { placed: Placed; side: 'home' | 'away' }) {
  const { p, x, y } = placed
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className={`grid size-8 place-items-center rounded-full text-[12px] font-bold text-white shadow-[0_2px_5px_rgb(0_0_0/0.35)] ring-1 ring-white/25 ${
          side === 'home' ? 'bg-accent' : 'bg-[#3a3a3c]'
        }`}
      >
        {p.n ?? ''}
      </span>
      <span className="mt-1 max-w-[64px] truncate rounded-[4px] bg-black/40 px-1 text-[9px] font-semibold leading-[1.4] text-white">
        {shortName(p.name)}
      </span>
    </div>
  )
}

function PitchMarkings() {
  // viewBox vertical 100×150 — traits blancs discrets.
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 150"
      preserveAspectRatio="none"
      fill="none"
      stroke="white"
      strokeOpacity={0.2}
      strokeWidth={0.5}
    >
      <rect x="2" y="2" width="96" height="146" rx="1.5" />
      <line x1="2" y1="75" x2="98" y2="75" />
      <circle cx="50" cy="75" r="11" />
      <circle cx="50" cy="75" r="0.8" fill="white" fillOpacity={0.3} stroke="none" />
      {/* Surfaces */}
      <rect x="28" y="2" width="44" height="20" />
      <rect x="40" y="2" width="20" height="8" />
      <rect x="28" y="128" width="44" height="20" />
      <rect x="40" y="140" width="20" height="8" />
    </svg>
  )
}

function SubsColumn({ team, align }: { team: TeamLineup; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      {team.subs.map((p, i) => (
        <p key={i} className="truncate text-[12px] text-ink-2">
          <span className="tnum text-ink-3">{p.n ?? '–'}</span> {shortName(p.name)}
        </p>
      ))}
    </div>
  )
}

export default function Lineup({
  lineups,
  home,
  away,
}: {
  lineups: MatchLineups
  home: { name: string; code: string | null }
  away: { name: string; code: string | null }
}) {
  const homePlaced = useMemo(() => placeTeam(lineups.home, 'home'), [lineups.home])
  const awayPlaced = useMemo(() => placeTeam(lineups.away, 'away'), [lineups.away])

  const TeamHead = ({
    t,
    team,
  }: {
    t: { name: string; code: string | null }
    team: TeamLineup
  }) => (
    <div className="flex items-center gap-2">
      <span className="text-[20px]">{teamFlag(t.code)}</span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold">{teamName(t.name, t.code)}</p>
        {team.formation && <p className="text-[12px] text-ink-3">{team.formation}</p>}
      </div>
    </div>
  )

  return (
    <div>
      {/* En-tête : extérieur (haut du terrain) à gauche, domicile à droite */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <TeamHead t={away} team={lineups.away} />
        <TeamHead t={home} team={lineups.home} />
      </div>

      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#2f9457] to-[#1d6b40]">
        {/* Bandes de tonte */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, #fff 0 7%, transparent 7% 14%)',
          }}
        />
        <PitchMarkings />
        {awayPlaced.map((pl, i) => (
          <PlayerMarker key={`a${i}`} placed={pl} side="away" />
        ))}
        {homePlaced.map((pl, i) => (
          <PlayerMarker key={`h${i}`} placed={pl} side="home" />
        ))}
      </div>

      {(lineups.home.subs.length > 0 || lineups.away.subs.length > 0) && (
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Remplaçants</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <SubsColumn team={lineups.away} align="left" />
            <SubsColumn team={lineups.home} align="right" />
          </div>
        </div>
      )}

      {(lineups.home.coach || lineups.away.coach) && (
        <div className="mt-3 flex justify-between text-[12px] text-ink-3">
          <span>{lineups.away.coach && `Sél. ${lineups.away.coach}`}</span>
          <span>{lineups.home.coach && `Sél. ${lineups.home.coach}`}</span>
        </div>
      )}
    </div>
  )
}
