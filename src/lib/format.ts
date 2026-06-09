const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (dayKey(iso) === dayKey(today.toISOString())) return "Aujourd'hui"
  if (dayKey(iso) === dayKey(tomorrow.toISOString())) return 'Demain'
  const label = DAY_FMT.format(d)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function timeLabel(iso: string): string {
  return TIME_FMT.format(new Date(iso))
}

export function countdown(iso: string, now: number): string | null {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const totalMin = Math.floor(ms / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const min = totalMin % 60
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${String(min).padStart(2, '0')}`
  return `${min} min`
}

export function hasStarted(kickoffIso: string, now: number = Date.now()): boolean {
  return now >= new Date(kickoffIso).getTime()
}

/**
 * Ambiance d'un match (sans API live) selon l'état et la proximité du coup d'envoi.
 * - 'finished'  : terminé
 * - 'live'      : coup d'envoi passé, pas encore marqué terminé
 * - 'imminent'  : < 15 min → ça chauffe, fermeture imminente des pronos
 * - 'soon'      : < 2 h → fenêtre de pronostic ouverte
 * - 'upcoming'  : plus loin
 */
export type Ambiance = 'finished' | 'live' | 'imminent' | 'soon' | 'upcoming'

export function ambiance(kickoffIso: string, status: string, now: number): Ambiance {
  if (status === 'finished') return 'finished'
  const ms = new Date(kickoffIso).getTime() - now
  if (ms <= 0) return 'live'
  if (ms < 15 * 60_000) return 'imminent'
  if (ms < 2 * 3600_000) return 'soon'
  return 'upcoming'
}
