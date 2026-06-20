import { forwardRef } from 'react'
import { teamFlag, teamName } from '../lib/teams'
import { matchGradient, GRAIN_DATA_URI } from '../lib/teamColors'

// Données d'une carte de partage (façon Strava) — 4 variantes.
export type ShareData =
  | {
      kind: 'match'
      name: string
      home: { code: string | null; name: string }
      away: { code: string | null; name: string }
      homeScore: number
      awayScore: number
      badge: string
      points: number
    }
  | {
      kind: 'stats'
      name: string
      rank: number
      totalPlayers: number
      totalPoints: number
      vsAverage: number
      hitRate: number
      specialty: string | null
      bestMatchPoints: number | null
    }
  | { kind: 'streak'; name: string; streakKind: 'win' | 'loss'; count: number }
  | { kind: 'rank'; name: string; rank: number; totalPlayers: number; totalPoints: number }

// Fond accent BetUs pour les cartes hors-match (dégradé bleu profond → accent).
const BRAND_BG: React.CSSProperties = {
  backgroundColor: '#0a2540',
  backgroundImage:
    'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 55%), linear-gradient(160deg, #0a2540 0%, #0a7aff 130%)',
}

function Frame({
  name,
  bg,
  children,
}: {
  name: string
  bg: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[26px] text-white"
      style={{ width: 320, height: 400, ...bg }}
    >
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: GRAIN_DATA_URI, opacity: 0.06 }}
      />
      <div className="relative flex h-full flex-col p-5">
        {/* En-tête marque */}
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold tracking-tight">BetUs</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
            Coupe du Monde 2026
          </span>
        </div>

        {/* Contenu */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {children}
        </div>

        {/* Pied : nom du joueur */}
        <div className="flex items-center justify-between border-t border-white/20 pt-3">
          <span className="text-[15px] font-bold">{name}</span>
          <span className="text-[11px] font-medium text-white/65">pronos entre potes</span>
        </div>
      </div>
    </div>
  )
}

const ShareCard = forwardRef<HTMLDivElement, { data: ShareData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="inline-block">
      {data.kind === 'match' && (
        <Frame name={data.name} bg={matchGradient(data.home.code, data.away.code)}>
          <div className="flex items-center justify-center gap-3">
            <div className="flex w-20 flex-col items-center gap-1">
              <span className="text-[34px] leading-none">{teamFlag(data.home.code)}</span>
              <span className="text-[12px] font-semibold leading-tight">
                {teamName(data.home.name, data.home.code)}
              </span>
            </div>
            <span className="tnum text-[40px] font-extrabold">
              {data.homeScore}–{data.awayScore}
            </span>
            <div className="flex w-20 flex-col items-center gap-1">
              <span className="text-[34px] leading-none">{teamFlag(data.away.code)}</span>
              <span className="text-[12px] font-semibold leading-tight">
                {teamName(data.away.name, data.away.code)}
              </span>
            </div>
          </div>
          <p className="mt-5 rounded-full bg-white/15 px-3.5 py-1 text-[13px] font-semibold backdrop-blur-sm">
            {data.badge}
          </p>
          <p className="tnum mt-3 text-[44px] font-extrabold leading-none">
            {data.points > 0 ? `+${data.points}` : '0'}
            <span className="ml-1 text-[20px] font-bold text-white/80">pts</span>
          </p>
        </Frame>
      )}

      {data.kind === 'stats' && (
        <Frame name={data.name} bg={BRAND_BG}>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/70">
            {data.rank}{data.rank === 1 ? 'ᵉʳ' : 'ᵉ'} / {data.totalPlayers} au classement
          </p>
          <p className="tnum mt-1 text-[58px] font-extrabold leading-none">{data.totalPoints}</p>
          <p className="-mt-1 text-[14px] font-semibold text-white/80">points</p>
          <span className="tnum mt-2 rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-bold">
            {data.vsAverage >= 0 ? `+${data.vsAverage}` : data.vsAverage} vs la moyenne
          </span>
          <div className="mt-4 w-full space-y-1.5 rounded-2xl bg-white/10 p-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/75">Réussite</span>
              <span className="tnum font-bold">{data.hitRate}%</span>
            </div>
            {data.specialty && (
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-white/75">Spécialité</span>
                <span className="truncate font-bold">{data.specialty}</span>
              </div>
            )}
            {data.bestMatchPoints != null && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white/75">Meilleur coup</span>
                <span className="tnum font-bold">+{data.bestMatchPoints}</span>
              </div>
            )}
          </div>
        </Frame>
      )}

      {data.kind === 'streak' && (
        <Frame name={data.name} bg={BRAND_BG}>
          <p className="text-[64px] leading-none">{data.streakKind === 'win' ? '🔥' : '🥶'}</p>
          <p className="tnum mt-2 text-[56px] font-extrabold leading-none">{data.count}</p>
          <p className="mt-2 max-w-[14rem] text-[16px] font-bold leading-snug">
            {data.streakKind === 'win'
              ? `pronos gagnants d’affilée`
              : `pronos ratés d’affilée`}
          </p>
          <div className="mt-4 flex gap-1.5">
            {Array.from({ length: Math.min(data.count, 8) }).map((_, i) => (
              <span
                key={i}
                className={`grid size-6 place-items-center rounded-full text-[12px] font-bold ${
                  data.streakKind === 'win' ? 'bg-white text-[#1d9a45]' : 'bg-white/25 text-white'
                }`}
              >
                {data.streakKind === 'win' ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </Frame>
      )}

      {data.kind === 'rank' && (
        <Frame name={data.name} bg={BRAND_BG}>
          <p className="text-[44px] leading-none">
            {data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🏆'}
          </p>
          <p className="tnum mt-3 text-[64px] font-extrabold leading-none">
            {data.rank}
            <span className="text-[24px] font-bold text-white/70">/{data.totalPlayers}</span>
          </p>
          <p className="mt-1 text-[15px] font-semibold text-white/80">au classement</p>
          <p className="tnum mt-4 rounded-full bg-white/15 px-4 py-1.5 text-[15px] font-bold">
            {data.totalPoints} pts
          </p>
        </Frame>
      )}
    </div>
  )
})

ShareCard.displayName = 'ShareCard'
export default ShareCard
