import { forwardRef } from 'react'
import { teamFlag, teamName } from '../lib/teams'
import { matchGradient, GRAIN_DATA_URI } from '../lib/teamColors'
import { FORMAT_DIM, themeById, DEFAULT_TOGGLES } from '../lib/shareThemes'
import type { ShareFormat, StatToggles } from '../lib/shareThemes'

export type ShareData =
  | {
      kind: 'match'
      name: string
      home: { code: string | null; name: string }
      away: { code: string | null; name: string }
      homeScore: number
      awayScore: number
      points: number
      items: { label: string; pick: string; ok: boolean }[]
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

// Réglages choisis par l'utilisateur dans le studio de partage.
export interface ShareStyle {
  format?: ShareFormat
  themeId?: string // si défini, écrase le fond par défaut
  bgImage?: string // photo de fond (prioritaire)
  toggles?: StatToggles
}

const numberGlow = { textShadow: '0 2px 24px rgba(0,0,0,0.30)' }

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

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.22em] text-white/65">{children}</p>
}

function Frame({
  name,
  w,
  h,
  bg,
  accent,
  watermark,
  bgImage,
  children,
}: {
  name: string
  w: number
  h: number
  bg: React.CSSProperties
  accent: string
  watermark?: React.ReactNode
  bgImage?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[30px] text-white"
      style={{ width: w, height: h, ...(bgImage ? { backgroundColor: '#0a1f3c' } : bg) }}
    >
      {bgImage ? (
        <>
          <img src={bgImage} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.82) 100%)',
            }}
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute size-64 rounded-full opacity-60"
            style={{ left: -80, top: -96, background: 'radial-gradient(closest-side, rgba(255,255,255,0.45), transparent)' }}
          />
          <div
            className="pointer-events-none absolute size-72 rounded-full opacity-50"
            style={{ right: -64, bottom: -112, background: `radial-gradient(closest-side, ${accent}, transparent)` }}
          />
          {watermark && <div className="pointer-events-none absolute inset-0">{watermark}</div>}
        </>
      )}
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN_DATA_URI, opacity: 0.07 }} />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-1 ring-inset ring-white/15" />

      <div className="relative flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <span className="text-[19px] font-black tracking-tight">⚽️ BetUs</span>
          <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 ring-1 ring-white/20">
            CDM 2026
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>
        <div className="flex items-center justify-between border-t border-white/20 pt-3.5">
          <span className="text-[16px] font-extrabold">{name}</span>
          <span className="text-[11px] font-semibold tracking-wide text-white/55">pronos entre potes</span>
        </div>
      </div>
    </div>
  )
}

const ShareCard = forwardRef<HTMLDivElement, { data: ShareData; style?: ShareStyle }>(({ data, style }, ref) => {
  const fmt = FORMAT_DIM[style?.format ?? 'portrait']
  const theme = themeById(style?.themeId ?? 'ocean')
  const bgImage = style?.bgImage
  const tg = style?.toggles ?? DEFAULT_TOGGLES
  const common = { w: fmt.w, h: fmt.h, accent: theme.accent, bgImage }

  return (
    <div ref={ref} className="inline-block">
      {data.kind === 'match' && (
        <Frame name={data.name} {...common} bg={style?.themeId ? theme.bg : matchGradient(data.home.code, data.away.code)}>
          <Kicker>Mon prono</Kicker>
          <div className="flex items-center justify-center gap-2.5">
            <span className="text-[30px] leading-none">{teamFlag(data.home.code)}</span>
            <span className="tnum text-[30px] font-black" style={numberGlow}>
              {data.homeScore}<span className="px-1 text-white/55">–</span>{data.awayScore}
            </span>
            <span className="text-[30px] leading-none">{teamFlag(data.away.code)}</span>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-white/70">
            {teamName(data.home.name, data.home.code)} – {teamName(data.away.name, data.away.code)}
          </p>
          <div className="mt-4 w-full space-y-1.5">
            {data.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/15">
                <span className="shrink-0 text-[11.5px] font-medium uppercase tracking-wide text-white/65">{it.label}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`truncate text-[14px] font-bold ${it.ok ? '' : 'text-white/60 line-through'}`}>{it.pick}</span>
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                      it.ok ? 'bg-[#34c759] text-white' : 'bg-white/20 text-white/70'
                    }`}
                  >
                    {it.ok ? '✓' : '✗'}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {data.points > 0 && <p className="tnum mt-3 text-[13px] font-bold text-white/80">+{data.points} pts</p>}
        </Frame>
      )}

      {data.kind === 'stats' && (
        <Frame
          name={data.name}
          {...common}
          bg={theme.bg}
          watermark={
            <span className="absolute -right-5 -top-6 text-[150px] font-black leading-none text-white/[0.06]" style={{ transform: 'rotate(-8deg)' }}>
              #{data.rank}
            </span>
          }
        >
          <Kicker>
            {data.rank}{data.rank === 1 ? 'ᵉʳ' : 'ᵉ'} / {data.totalPlayers} · classement
          </Kicker>
          <p className="tnum text-[76px] font-black leading-none" style={numberGlow}>{data.totalPoints}</p>
          <p className="-mt-1 text-[15px] font-bold uppercase tracking-[0.2em] text-white/75">points</p>
          {tg.vsAverage && (
            <div className="mt-3">
              <Chip strong>{data.vsAverage >= 0 ? `+${data.vsAverage}` : data.vsAverage} vs la moyenne</Chip>
            </div>
          )}
          {(tg.hitRate || (tg.specialty && data.specialty) || (tg.bestMatch && data.bestMatchPoints != null)) && (
            <div className="mt-4 w-full space-y-2 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15">
              {tg.hitRate && (
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-white/70">Réussite</span>
                  <span className="tnum font-extrabold">{data.hitRate}%</span>
                </div>
              )}
              {tg.specialty && data.specialty && (
                <div className="flex items-center justify-between gap-2 text-[13.5px]">
                  <span className="text-white/70">Spécialité</span>
                  <span className="truncate font-extrabold">{data.specialty}</span>
                </div>
              )}
              {tg.bestMatch && data.bestMatchPoints != null && (
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-white/70">Meilleur coup</span>
                  <span className="tnum font-extrabold">+{data.bestMatchPoints}</span>
                </div>
              )}
            </div>
          )}
        </Frame>
      )}

      {data.kind === 'streak' && (
        <Frame
          name={data.name}
          {...common}
          bg={
            style?.themeId
              ? theme.bg
              : data.streakKind === 'win'
                ? { backgroundColor: '#7a1f00', backgroundImage: 'linear-gradient(155deg, #7a1f00 0%, #ff6a00 75%, #ffb020 130%)' }
                : { backgroundColor: '#0a2540', backgroundImage: 'linear-gradient(155deg, #0a2540 0%, #1f6fb0 120%)' }
          }
          watermark={
            <span className="absolute -bottom-8 -right-6 text-[150px] leading-none opacity-10">
              {data.streakKind === 'win' ? '🔥' : '🥶'}
            </span>
          }
        >
          <Kicker>{data.streakKind === 'win' ? 'En feu' : 'Coup de froid'}</Kicker>
          <p className="text-[72px] leading-none">{data.streakKind === 'win' ? '🔥' : '🥶'}</p>
          <p className="tnum -mt-2 text-[68px] font-black leading-none" style={numberGlow}>{data.count}</p>
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
          {...common}
          bg={theme.bg}
          watermark={
            <span className="absolute -bottom-12 -right-4 text-[190px] font-black leading-none text-white/[0.06]" style={{ transform: 'rotate(-6deg)' }}>
              {data.rank}
            </span>
          }
        >
          <Kicker>Top {Math.max(1, Math.round((data.rank / data.totalPlayers) * 100))}% du groupe</Kicker>
          <p className="text-[52px] leading-none">
            {data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🏆'}
          </p>
          <p className="tnum mt-2 text-[80px] font-black leading-none" style={numberGlow}>
            {data.rank}<span className="text-[28px] font-extrabold text-white/65">/{data.totalPlayers}</span>
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
