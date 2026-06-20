import type { PersoStats } from '../lib/stats'
import { pct } from '../lib/stats'
import { Card } from './ui'

const CAT_COLORS = {
  exact: '#0a7aff',
  winner: '#34c759',
  scorer: '#ff9500',
  assister: '#af52de',
  tournament: '#5ac8fa',
}
const CAT_LABEL = {
  exact: 'Score exact',
  winner: 'Vainqueur',
  scorer: 'Buteur',
  assister: 'Passeur',
  tournament: 'Tournoi',
}

function AccuracyBar({ label, hits, tries }: { label: string; hits: number; tries: number }) {
  const p = pct({ hits, tries })
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="text-[12px] text-ink-3">
          <span className="tnum font-semibold text-ink">{p}%</span> · {hits}/{tries}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

function SuperRow({ icon, title, value }: { icon: string; title: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[18px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink-3">{title}</p>
        <p className="truncate text-[15px] font-semibold">{value}</p>
      </div>
    </div>
  )
}

export default function StatsDashboard({ stats }: { stats: PersoStats }) {
  const bd = stats.breakdown
  const bdTotal = bd.exact + bd.winner + bd.scorer + bd.assister + bd.tournament || 1
  const segs = (['exact', 'winner', 'scorer', 'assister', 'tournament'] as const).filter((k) => bd[k] > 0)

  return (
    <>
      {/* Bilan : hero + comparaison au groupe */}
      <Card className="mb-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Total</p>
            <p className="tnum text-[44px] font-extrabold leading-none">{stats.totalPoints}</p>
            <p className="-mt-0.5 text-[14px] text-ink-2">points</p>
          </div>
          <div className="text-right">
            <p className="text-[34px] leading-none">
              {stats.rank === 1 ? '🥇' : stats.rank === 2 ? '🥈' : stats.rank === 3 ? '🥉' : '🏆'}
            </p>
            <p className="tnum mt-1 text-[15px] font-bold">
              {stats.rank}
              <span className="text-[13px] font-medium text-ink-3">/{stats.totalPlayers}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`tnum rounded-full px-3 py-1 text-[13px] font-semibold ${
              stats.vsAverage >= 0 ? 'bg-positive-soft text-[#1d9a45]' : 'bg-red-50 text-negative'
            }`}
          >
            {stats.vsAverage >= 0 ? `+${stats.vsAverage}` : stats.vsAverage} vs la moyenne
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-2">
            Tu bats <span className="tnum font-semibold text-ink">{stats.beat}</span>/{stats.totalPlayers - 1}
          </span>
          {stats.avgPerProno > 0 && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-2">
              <span className="tnum font-semibold text-ink">{stats.avgPerProno}</span> pts / prono
            </span>
          )}
        </div>
      </Card>

      {/* Réussite par catégorie */}
      <Card className="mb-4 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold">Réussite</h2>
          <span className="text-[13px] text-ink-3">
            <span className="tnum text-[22px] font-extrabold text-accent">{stats.hitRate}%</span> des pronos payent
          </span>
        </div>
        <div className="space-y-3">
          <AccuracyBar label="Vainqueur" {...stats.accuracy.winner} />
          <AccuracyBar label="Score exact" {...stats.accuracy.exact} />
          <AccuracyBar label="Buteur" {...stats.accuracy.scorer} />
          <AccuracyBar label="Passeur" {...stats.accuracy.assister} />
        </div>
      </Card>

      {/* Répartition des points */}
      {bdTotal > 1 && (
        <Card className="mb-4 p-5">
          <h2 className="mb-3 text-[17px] font-bold">D'où viennent tes points</h2>
          <div className="flex h-3.5 overflow-hidden rounded-full">
            {segs.map((k) => (
              <div key={k} style={{ width: `${(bd[k] / bdTotal) * 100}%`, background: CAT_COLORS[k] }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {segs.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[k] }} />
                <span className="flex-1 text-[13px] text-ink-2">{CAT_LABEL[k]}</span>
                <span className="tnum text-[13px] font-semibold">{bd[k]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Temps forts */}
      {(stats.bestMatch || stats.bestStreak >= 2 || stats.specialty) && (
        <Card className="mb-4 divide-y divide-line/60 px-5 py-2">
          {stats.specialty && (
            <SuperRow
              icon="🏅"
              title={`Spécialité · ${stats.specialty.rankInGroup}${stats.specialty.rankInGroup === 1 ? 'ᵉʳ' : 'ᵉ'} du groupe`}
              value={stats.specialty.title}
            />
          )}
          {stats.bestMatch && (
            <SuperRow icon="💥" title="Meilleur coup" value={`+${stats.bestMatch.points} · ${stats.bestMatch.label}`} />
          )}
          {stats.bestStreak >= 2 && (
            <SuperRow
              icon="🔥"
              title="Série record"
              value={`${stats.bestStreak} pronos gagnants${
                stats.currentStreak?.kind === 'win' && stats.currentStreak.count >= 2
                  ? ` · ${stats.currentStreak.count} en cours`
                  : ''
              }`}
            />
          )}
        </Card>
      )}
    </>
  )
}
