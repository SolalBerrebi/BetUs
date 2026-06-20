// Pastille « stats à voir » sur l'onglet Profil : signale les matchs terminés que
// le joueur a pronostiqués mais dont il n'a pas encore vu le résultat dans ses stats.
// On mémorise les IDs déjà vus (localStorage) → précis quel que soit le timing.
import type { Match, Prediction } from './types'

const KEY = 'betus:statsSeenIds'
const EVENT = 'betus:stats-seen'

const finishedPredicted = (matches: Match[], preds: Map<number, Prediction>): number[] =>
  matches.filter((m) => m.status === 'finished' && preds.has(m.id)).map((m) => m.id)

function readSeen(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[])
  } catch {
    return new Set()
  }
}

// Nombre de résultats nouveaux (terminés, pronostiqués, jamais vus dans les stats).
export function newStatsCount(matches: Match[], preds: Map<number, Prediction>): number {
  const seen = readSeen()
  return finishedPredicted(matches, preds).filter((id) => !seen.has(id)).length
}

// Marque tous les résultats actuels comme vus + notifie l'UI (pastille effacée).
export function markStatsSeen(matches: Match[], preds: Map<number, Prediction>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(finishedPredicted(matches, preds)))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* localStorage indispo : pas grave */
  }
}

export const STATS_SEEN_EVENT = EVENT
