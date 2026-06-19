import { teamColor } from '../lib/teamColors'
import { teamFlag } from '../lib/teams'

// Momentum du match : value ∈ [-100, 100] (+ = domicile pousse, − = extérieur).
export interface MomentumPoint {
  min: number
  value: number
}

// Lissage Catmull-Rom → courbes de Bézier (courbe douce, façon Sofascore/Apple).
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

const W = 340
const H = 132
const MID = 66
const AMP = 54

export default function Momentum({
  home,
  away,
  data,
  goals = [],
}: {
  home: { code: string | null; name: string }
  away: { code: string | null; name: string }
  data: MomentumPoint[]
  goals?: { min: number; team: 'home' | 'away' }[]
}) {
  const hc = teamColor(home.code)
  const ac = teamColor(away.code)
  const maxMin = Math.max(90, data[data.length - 1]?.min ?? 90)
  const X = (m: number) => (m / maxMin) * W
  const Y = (v: number) => MID - (Math.max(-100, Math.min(100, v)) / 100) * AMP
  const pts = data.map((p) => [X(p.min), Y(p.value)] as [number, number])
  const line = smoothPath(pts)
  const area = pts.length
    ? `${line} L ${X(data[data.length - 1].min).toFixed(1)} ${MID} L ${X(data[0].min).toFixed(1)} ${MID} Z`
    : ''
  const last = data[data.length - 1]?.value ?? 0
  const homePct = Math.round((last + 100) / 2)
  const uid = (home.code ?? 'h') + (away.code ?? 'a')

  const valueAt = (min: number) => data.find((d) => d.min >= min)?.value ?? 0

  return (
    <div>
      {/* Jauge de pression instantanée */}
      <div className="mb-1.5 flex items-center justify-between text-[13px] font-bold">
        <span className="flex items-center gap-1.5">
          <span className="text-[15px]">{teamFlag(home.code)}</span>
          {homePct}%
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Momentum</span>
        <span className="flex items-center gap-1.5">
          {100 - homePct}%
          <span className="text-[15px]">{teamFlag(away.code)}</span>
        </span>
      </div>
      <div className="mb-4 flex h-2 overflow-hidden rounded-full">
        <div style={{ width: `${homePct}%`, background: hc }} />
        <div style={{ width: `${100 - homePct}%`, background: ac }} />
      </div>

      {/* Courbe lissée + aire en dégradé qui transite domicile (haut) → extérieur (bas) */}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hc} stopOpacity="0.85" />
            <stop offset="46%" stopColor={hc} stopOpacity="0.05" />
            <stop offset="54%" stopColor={ac} stopOpacity="0.05" />
            <stop offset="100%" stopColor={ac} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hc} stopOpacity="0.95" />
            <stop offset="48%" stopColor={hc} stopOpacity="0.55" />
            <stop offset="52%" stopColor={ac} stopOpacity="0.55" />
            <stop offset="100%" stopColor={ac} stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <line x1="0" y1={MID} x2={W} y2={MID} stroke="var(--color-line)" strokeWidth="1" />
        {area && <path d={area} fill={`url(#fill-${uid})`} />}
        {line && <path d={line} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2" strokeLinejoin="round" />}
        {goals.map((g, i) => (
          <g key={i}>
            <line x1={X(g.min)} y1="6" x2={X(g.min)} y2={H - 6} stroke={g.team === 'home' ? hc : ac} strokeOpacity="0.25" strokeWidth="1" />
            <circle cx={X(g.min)} cy={Y(valueAt(g.min))} r="3.5" fill={g.team === 'home' ? hc : ac} stroke="#fff" strokeWidth="1.5" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-ink-3">
        <span>0'</span>
        <span>45'</span>
        <span>90'</span>
      </div>
    </div>
  )
}
