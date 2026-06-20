import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ShareCard, { type ShareData } from './ShareCard'
import { shareNode } from '../lib/share'
import { FORMATS, FORMAT_DIM, THEMES, DEFAULT_TOGGLES } from '../lib/shareThemes'
import type { ShareFormat, StatToggles } from '../lib/shareThemes'
import { Spinner } from './ui'

const CAPTIONS: Record<ShareData['kind'], string> = {
  match: 'Mon prono BetUs 👇',
  stats: 'Mes stats BetUs 📊',
  streak: 'Ma série BetUs 🔥',
  rank: 'Mon rang BetUs 🏆',
}

const TOGGLE_LABELS: { key: keyof StatToggles; label: string }[] = [
  { key: 'vsAverage', label: 'vs moyenne' },
  { key: 'hitRate', label: 'Réussite' },
  { key: 'specialty', label: 'Spécialité' },
  { key: 'bestMatch', label: 'Meilleur coup' },
]

const PREVIEW_MAX_W = 250
const PREVIEW_MAX_H = 360

export default function ShareSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const [format, setFormat] = useState<ShareFormat>('portrait')
  const [themeId, setThemeId] = useState<string | null>(null) // null = auto (défaut du type)
  const [bgImage, setBgImage] = useState<string | undefined>(undefined)
  const [toggles, setToggles] = useState<StatToggles>(DEFAULT_TOGGLES)

  const dim = FORMAT_DIM[format]
  const scale = Math.min(PREVIEW_MAX_W / dim.w, PREVIEW_MAX_H / dim.h)

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBgImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function go(mode: 'share' | 'save') {
    if (!cardRef.current || busy) return
    setBusy(true)
    setDone(null)
    try {
      const res = await shareNode(cardRef.current, {
        filename: `betus-${data.kind}.png`,
        text: CAPTIONS[data.kind],
        title: 'BetUs',
        forceDownload: mode === 'save',
      })
      if (res === 'downloaded') setDone('Image enregistrée ✓')
      else if (res === 'shared') onClose()
    } catch {
      setDone('Oups, réessaie.')
    } finally {
      setBusy(false)
    }
  }

  const activeSwatch = bgImage ? 'photo' : themeId ?? 'auto'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/55 backdrop-blur-sm sm:justify-center"
      onClick={onClose}
    >
      <div
        className="max-h-[94vh] w-full max-w-sm overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'sheet-up 0.28s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ink-3/40" />

        {/* Aperçu live — coins arrondis purement cosmétiques (l'export reste full-bleed) */}
        <div className="flex items-center justify-center" style={{ height: PREVIEW_MAX_H }}>
          <div
            className="overflow-hidden rounded-[22px] shadow-(--shadow-float)"
            style={{ width: dim.w * scale, height: dim.h * scale }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: dim.w, height: dim.h }}>
              <ShareCard ref={cardRef} data={data} style={{ format, themeId: themeId ?? undefined, bgImage, toggles }} />
            </div>
          </div>
        </div>

        {/* Format */}
        <p className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Format</p>
        <div className="flex gap-1 rounded-[13px] bg-surface-2 p-1">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`flex-1 rounded-[10px] py-1.5 text-[12.5px] font-semibold transition-all ${
                format === f.id ? 'bg-surface text-ink shadow-(--shadow-card)' : 'text-ink-2'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Fond / thème */}
        <p className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Fond</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Swatch label="Auto" active={activeSwatch === 'auto'} onClick={() => { setBgImage(undefined); setThemeId(null) }}>
            <span className="text-[15px]">🎨</span>
          </Swatch>
          {THEMES.map((t) => (
            <Swatch
              key={t.id}
              label={t.label}
              active={activeSwatch === t.id}
              onClick={() => { setBgImage(undefined); setThemeId(t.id) }}
              bg={t.swatch}
            />
          ))}
          <Swatch label="Photo" active={activeSwatch === 'photo'} onClick={() => fileRef.current?.click()}>
            <span className="text-[15px]">📷</span>
          </Swatch>
        </div>

        {/* Stats à afficher (carte stats uniquement) */}
        {data.kind === 'stats' && (
          <>
            <p className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-3">À afficher</p>
            <div className="flex flex-wrap gap-2">
              {TOGGLE_LABELS.map(({ key, label }) => {
                const on = toggles[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 transition-colors ${
                      on ? 'bg-accent-soft text-accent ring-accent/30' : 'bg-surface-2 text-ink-3 ring-transparent'
                    }`}
                  >
                    {on ? '✓ ' : ''}{label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={() => go('share')}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? <Spinner className="on-accent" /> : 'Partager'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go('save')}
              disabled={busy}
              className="h-11 flex-1 rounded-2xl bg-surface-2 text-[15px] font-semibold text-ink-2 transition-colors active:bg-line/60 disabled:opacity-60"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl bg-surface-2 text-[15px] font-semibold text-ink-2 transition-colors active:bg-line/60"
            >
              Fermer
            </button>
          </div>
          {done && <p className="text-center text-[13px] font-medium text-ink-2">{done}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Swatch({
  label,
  active,
  onClick,
  bg,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  bg?: string
  children?: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1">
      <span
        className={`grid size-12 place-items-center rounded-2xl ring-2 transition-all ${
          active ? 'ring-accent' : 'ring-transparent'
        }`}
        style={bg ? { backgroundImage: bg } : { background: 'var(--color-surface-2)' }}
      >
        {children}
      </span>
      <span className={`text-[10.5px] font-semibold ${active ? 'text-accent' : 'text-ink-3'}`}>{label}</span>
    </button>
  )
}
