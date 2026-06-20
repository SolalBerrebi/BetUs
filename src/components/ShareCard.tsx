import { forwardRef } from 'react'
import { teamFlag, teamName } from '../lib/teams'
import { matchGradient, GRAIN_DATA_URI } from '../lib/teamColors'

// Données d'une carte de partage (façon Strava / story Insta) — 4 variantes.
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
  | {
      kind: 'streak'
      name: string
      streakKind: 'win' | 'loss'
      count: number
      bestStreak: number
      hitRate: number
    }
  | {
      kind: 'rank'
      name: string
      rank: number
      totalPlayers: number
      totalPoints: number
      vsAverage: number
      beat: number
    }

const W = 340
const H = 430

// Fond accent BetUs (dégradé bleu profond → accent) pour les cartes hors-match.
const BRAND_BG: React.CSSProperties = {
  backgroundColor: '#0a1f3c',
  backgroundImage: 'linear-gradient(155deg, #0a1f3c 0%, #0a3a7a 60%, #0a7aff 130%)',
}

const numberGlow = { textShadow: '0 2px 24px rgba(0,0,0,0.28)' }

function Chip({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={`tnum inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-bold ring-1 ${
        strong ? 'bg-white text-[#0a2540] ring-white' : 'bg-white/15 text-white ring-white/25 backdrop-blur-sm'
      }`}
    >
      {children}
    </span>
  )
}

function Frame({
  name,
  bg,
  accent = 'rgba(10,122,255,0.9)',
  watermark,
  children,
}: {
  name: string
  bg: React.CSSProperties
  accent?: string
  watermark?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[30px] text-white"
      style={{ width: W, height: H, ...bg }}
    >
      {/* Halos lumineux pour la profondeur */}
      <div
        className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full opacity-60"
        style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.45), transparent)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 size-72 rounded-full opacity-50"
        style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }}
      />
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: GRAIN_DATA_URI, opacity: 0.07 }}
      />
      {/* Filigrane géant */}
      {watermark && <div className="pointer-events-none absolute inset-0">{watermark}</div>}
      {/* Liseré intérieur */}
      <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-1 ring-inset ring-white/15" />

      <div className="relative flex h-full flex-col p-6">
        {/* En-tête marque */}
        <div className="flex items-center justify-between">
          <span className="text-[19px] font-black tracking-tight">⚽️ BetUs</span>
          <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 ring-1 ring-white/20">
            CDM 2026
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>

        {/* Pied */}
        <div className="flex items-center justify-between border-t border-white/20 pt-3.5">
          <span className="text-[16px] font-extrabold">{name}</span>
          <span className="text-[11px] font-semibold tracking-wide text-white/55">pronos entre potes</span>
        </div>
      </div>
    </div>
  )
}

// Libellé d'accroche (uppercase) au-dessus du héros.
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.22em] text-white/65">{children}</p>
  )
}

const ShareCard = forwardRef<HTMLDivElement, { data: ShareData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="inline-block">
      {data.kind === 'match' && (
        <Frame name={data.name} bg={matchGradient(data.home.code, data.away.code)} accent="rgba(0,0,0,0.5)">
          <Kicker>{data.points > 0 ? 'Mon prono · gagné' : 'Mon prono'}</Kicker>
          <div className="flex items-center justify-center gap-3">
            <div className="flex w-20 flex-col items-center gap-1">
              <span className="text-[38px] leading-none">{teamFlag(data.home.code)}</span>
              <span className="text-[12px] font-semibold leading-tight">
                {teamName(data.home.name, data.home.code)}
              </span>
            </div>
            <span className="tnum text-[44px] font-black" style={numberGlow}>
              {data.homeScore}<span className="px-1 text-white/55">–</span>{data.awayScore}
            </span>
            <div className="flex w-20 flex-col items-center gap-1">
              <span className="text-[38px] leading-none">{teamFlag(data.away.code)}</span>
              <span className="text-[12px] font-semibold leading-tight">
                {teamName(data.away.name, data.away.code)}
              </span>
            </div>
          </div>
          <p className="mt-5 rounded-full bg-white/15 px-4 py-1.5 text-[13.5px] font-bold ring-1 ring-white/25 backdrop-blur-sm">
            {data.badge}
          </p>
          <p className="tnum mt-4 text-[58px] font-black leading-none" style={numberGlow}>
            {data.points > 0 ? `+${data.points}` : '0'}
            <span className="ml-1 text-[24px] font-extrabold text-white/80">pts</span>
          </p>
        </Frame>
      )}

      {data.kind === 'stats' && (
        <Frame
          name={data.name}
          bg={BRAND_BG}
          watermark={
            <span
              className="absolute -right-5 -top-6 text-[150px] font-black leading-none text-white/[0.06]"
              style={{ transform: 'rotate(-8deg)' }}
            >
              #{data.rank}
            </span>
          }
        >
          <Kicker>
            {data.rank}
            {data.rank === 1 ? 'ᵉʳ' : 'ᵉ'} / {data.totalPlayers} · classement
          </Kicker>
          <p className="tnum text-[76px] font-black leading-none" style={numberGlow}>
            {data.totalPoints}
          </p>
          <p className="-mt-1 text-[15px] font-bold uppercase tracking-[0.2em] text-white/75">points</p>
          <div className="mt-3">
            <Chip strong>{data.vsAverage >= 0 ? `+${data.vsAverage}` : data.vsAverage} vs la moyenne</Chip>
          </div>
          <div className="mt-4 w-full space-y-2 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15">
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-white/70">Réussite</span>
              <span className="tnum font-extrabold">{data.hitRate}%</span>
            </div>
            {data.specialty && (
              <div className="flex items-center justify-between gap-2 text-[13.5px]">
                <span className="text-white/70">Spécialité</span>
                <span className="truncate font-extrabold">{data.specialty}</span>
              </div>
            )}
            {data.bestMatchPoints != null && (
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="text-white/70">Meilleur coup</span>
                <span className="tnum font-extrabold">+{data.bestMatchPoints}</span>
              </div>
            )}
          </div>
        </Frame>
      )}

      {data.kind === 'streak' && (
        <Frame
          name={data.name}
          bg={
            data.streakKind === 'win'
              ? { backgroundColor: '#7a1f00', backgroundImage: 'linear-gradient(155deg, #7a1f00 0%, #ff6a00 75%, #ffb020 130%)' }
              : { backgroundColor: '#0a2540', backgroundImage: 'linear-gradient(155deg, #0a2540 0%, #1f6fb0 120%)' }
          }
          accent={data.streakKind === 'win' ? 'rgba(255,176,32,0.9)' : 'rgba(90,200,250,0.8)'}
          watermark={
            <span className="absolute -bottom-8 -right-6 text-[150px] leading-none opacity-10">
              {data.streakKind === 'win' ? '🔥' : '🥶'}
            </span>
          }
        >
          <Kicker>{data.streakKind === 'win' ? 'En feu' : 'Coup de froid'}</Kicker>
          <p className="text-[72px] leading-none">{data.streakKind === 'win' ? '🔥' : '🥶'}</p>
          <p className="tnum -mt-2 text-[68px] font-black leading-none" style={numberGlow}>
            {data.count}
          </p>
          <p className="mt-1 max-w-[15rem] text-[16px] font-extrabold leading-snug">
            pronos {data.streakKind === 'win' ? 'gagnants' : 'ratés'} d’affilée
          </p>
          <div className="mt-4 flex gap-1.5">
            {Array.from({ length: Math.min(data.count, 8) }).map((_, i) => (
              <span
                key={i}
                className={`grid size-6 place-items-center rounded-full text-[12px] font-black ${
                  data.streakKind === 'win' ? 'bg-white text-[#d2611a]' : 'bg-white/25 text-white'
                }`}
              >
                {data.streakKind === 'win' ? '✓' : '✗'}
              </span>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Chip>Record : {data.bestStreak}</Chip>
            <Chip>Réussite {data.hitRate}%</Chip>
          </div>
        </Frame>
      )}

      {data.kind === 'rank' && (
        <Frame
          name={data.name}
          bg={BRAND_BG}
          watermark={
            <span
              className="absolute -bottom-12 -right-4 text-[190px] font-black leading-none text-white/[0.06]"
              style={{ transform: 'rotate(-6deg)' }}
            >
              {data.rank}
            </span>
          }
        >
          <Kicker>Top {Math.max(1, Math.round((data.rank / data.totalPlayers) * 100))}% du groupe</Kicker>
          <p className="text-[52px] leading-none">
            {data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🏆'}
          </p>
          <p className="tnum mt-2 text-[80px] font-black leading-none" style={numberGlow}>
            {data.rank}
            <span className="text-[28px] font-extrabold text-white/65">/{data.totalPlayers}</span>
          </p>
          <p className="mt-1 text-[15px] font-bold uppercase tracking-[0.2em] text-white/75">au classement</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Chip strong>{data.totalPoints} pts</Chip>
            <Chip>{data.vsAverage >= 0 ? `+${data.vsAverage}` : data.vsAverage} vs moyenne</Chip>
          </div>
          {data.beat > 0 && (
            <p className="tnum mt-3 text-[13px] font-semibold text-white/70">
              Tu bats {data.beat} joueur{data.beat > 1 ? 's' : ''} sur {data.totalPlayers - 1}
            </p>
          )}
        </Frame>
      )}
    </div>
  )
})

ShareCard.displayName = 'ShareCard'
export default ShareCard
