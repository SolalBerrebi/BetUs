import { toBlob } from 'html-to-image'

// Série en cours de pronos réussis/ratés. `results` du plus récent au plus ancien,
// un prono « réussi » = points marqués > 0 sur un match terminé pronostiqué.
export function computeStreak(
  results: { points: number }[],
): { kind: 'win' | 'loss'; count: number } | null {
  if (!results.length) return null
  const kind = results[0].points > 0 ? 'win' : 'loss'
  let count = 0
  for (const r of results) {
    if ((r.points > 0 ? 'win' : 'loss') !== kind) break
    count++
  }
  return { kind, count }
}

type ShareResult = 'shared' | 'downloaded' | 'cancelled'

// Rend un nœud DOM en PNG (html-to-image) puis le partage via le partage natif iOS
// (Web Share API, fichier). Sans support fichier : on télécharge l'image en fallback.
export async function shareNode(
  node: HTMLElement,
  opts: { filename: string; text?: string; title?: string },
): Promise<ShareResult> {
  const blob = await toBlob(node, { pixelRatio: 3, cacheBust: true })
  if (!blob) throw new Error('Génération de l’image impossible')
  const file = new File([blob], opts.filename, { type: 'image/png' })

  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
  }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: opts.text, title: opts.title })
      return 'shared'
    } catch (e) {
      // L'utilisateur a annulé la feuille de partage : pas une erreur.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      // Sinon on retombe sur le téléchargement.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
