import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ShareCard, { type ShareData } from './ShareCard'
import { shareNode } from '../lib/share'
import { Spinner } from './ui'

const CAPTIONS: Record<ShareData['kind'], string> = {
  match: 'Mon prono BetUs 👇',
  stats: 'Mes stats BetUs 📊',
  streak: 'Ma série BetUs 🔥',
  rank: 'Mon rang BetUs 🏆',
}

export default function ShareSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [bgImage, setBgImage] = useState<string | undefined>(undefined)

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBgImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = '' // permet de re-choisir le même fichier
  }

  async function go() {
    if (!cardRef.current || busy) return
    setBusy(true)
    setDone(null)
    try {
      const res = await shareNode(cardRef.current, {
        filename: `betus-${data.kind}.png`,
        text: CAPTIONS[data.kind],
        title: 'BetUs',
      })
      if (res === 'downloaded') setDone('Image enregistrée ✓')
      else if (res === 'shared') onClose()
    } catch {
      setDone('Oups, réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/55 backdrop-blur-sm sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-[28px] bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'sheet-up 0.28s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ink-3/40" />

        {/* Aperçu de la carte */}
        <div className="flex justify-center">
          <ShareCard ref={cardRef} data={data} bgImage={bgImage} />
        </div>

        {/* Photo de fond (façon Strava) */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-[14px] font-semibold text-ink-2 transition-colors active:bg-line/60"
          >
            📷 {bgImage ? 'Changer la photo' : 'Photo de fond'}
          </button>
          {bgImage && (
            <button
              type="button"
              onClick={() => setBgImage(undefined)}
              className="rounded-full bg-surface-2 px-4 py-2 text-[14px] font-semibold text-ink-2 transition-colors active:bg-line/60"
            >
              Retirer
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={go}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? <Spinner className="on-accent" /> : 'Partager'}
          </button>
          {done && <p className="text-center text-[13px] font-medium text-ink-2">{done}</p>}
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full text-[16px] font-medium text-ink-2 transition-colors active:text-ink"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
