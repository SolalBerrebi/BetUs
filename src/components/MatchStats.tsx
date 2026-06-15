import type { MatchStats as MatchStatsT, TeamStats } from '../lib/types'
import { teamColor } from '../lib/teamColors'
import { teamFlag } from '../lib/teams'

type Row = {
  key: keyof TeamStats
  label: string
  pct?: boolean // valeur en %
  dec?: boolean // un chiffre après la virgule (xG)
  redOnly?: boolean // ligne masquée si zéro des deux côtés (cartons rouges)
}

// Ordre d'affichage. Une ligne est masquée si l'info manque des deux côtés.
const ROWS: Row[] = [
  { key: 'xg', label: 'Buts attendus', dec: true },
  { key: 'shots_total', label: 'Tirs' },
  { key: 'shots_on', label: 'Tirs cadrés' },
  { key: 'shots_off', label: 'Tirs non cadrés' },
  { key: 'shots_blocked', label: 'Tirs bloqués' },
  { key: 'corners', label: 'Corners' },
  { key: 'offsides', label: 'Hors-jeu' },
  { key: 'fouls', label: 'Fautes' },
  { key: 'passes_pct', label: 'Passes réussies', pct: true },
  { key: 'saves', label: 'Arrêts' },
  { key: 'yellow', label: 'Cartons jaunes' },
  { key: 'red', label: 'Cartons rouges', redOnly: true },
]

function fmt(v: number | null, row: Row): string {
  if (v == null) return '–'
  if (row.pct) return `${Math.round(v)}%`
  if (row.dec) return v.toFixed(1)
  return String(v)
}

function Pill({ color, value, lead }: { color: string; value: string; lead: boolean }) {
  return (
    <span
      className={`tnum inline-flex min-w-[3.25rem] items-center justify-center rounded-full px-3 py-1 text-[15px] tabular-nums transition-all ${lead ? 'font-bold text-ink' : 'font-semibold text-ink-2'}`}
      style={{
        background: `color-mix(in srgb, ${color} ${lead ? 24 : 9}%, transparent)`,
        boxShadow: lead ? `inset 0 0 0 1.5px color-mix(in srgb, ${color} 48%, transparent)` : undefined,
      }}
    >
      {value}
    </span>
  )
}

export default function MatchStats({
  stats,
  home,
  away,
}: {
  stats: MatchStatsT
  home: { code: string | null }
  away: { code: string | null }
}) {
  const hc = teamColor(home.code)
  const ac = teamColor(away.code)

  const rows = ROWS.filter((r) => {
    const h = stats.home[r.key]
    const a = stats.away[r.key]
    if (h == null && a == null) return false
    if (r.redOnly && !h && !a) return false
    return true
  })

  // Possession : la barre vedette en haut (dégradé des deux couleurs).
  const ph = stats.home.possession
  const pa = stats.away.possession
  const hasPoss = ph != null || pa != null
  const homePct = hasPoss ? Math.round(ph ?? (pa != null ? 100 - pa : 50)) : 50

  if (!rows.length && !hasPoss) return null

  return (
    <div>
      {hasPoss && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-[15px] font-bold">
            <span className="flex items-center gap-1.5" style={{ color: `color-mix(in srgb, ${hc} 78%, var(--color-ink))` }}>
              {teamFlag(home.code)} {homePct}%
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Possession</span>
            <span className="flex items-center gap-1.5" style={{ color: `color-mix(in srgb, ${ac} 78%, var(--color-ink))` }}>
              {100 - homePct}% {teamFlag(away.code)}
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${ac} 22%, transparent)` }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${homePct}%`, background: `linear-gradient(90deg, ${hc}, color-mix(in srgb, ${hc} 70%, #fff))` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {rows.map((r) => {
          const h = stats.home[r.key]
          const a = stats.away[r.key]
          const hv = h ?? 0
          const av = a ?? 0
          return (
            <div key={r.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex justify-end">
                <Pill color={hc} value={fmt(h, r)} lead={hv > av} />
              </div>
              <span className="whitespace-nowrap px-1 text-center text-[12px] font-medium uppercase tracking-wide text-ink-3">
                {r.label}
              </span>
              <div className="flex justify-start">
                <Pill color={ac} value={fmt(a, r)} lead={av > hv} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
