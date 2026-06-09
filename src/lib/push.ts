import { supabase } from './supabase'

const VAPID_PUBLIC_KEY =
  'BCFRY-eTnn6mm4aAofpwTajK6SLVVJRUEN3y6ZpRhrFcLZ06u6WkJpNb8VitC7cdkeTPCX7RNHmc64ICQnnfras'

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  }
}

/** Sur iOS, le push web n'existe que si l'app est installée sur l'écran d'accueil. */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush(userId: string): Promise<string | null> {
  if (!pushSupported()) return "Ce navigateur ne supporte pas les notifications."
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Notifications refusées — autorise-les dans les réglages.'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    user_id: userId,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
  })
  if (error) return error.message
  return null
}

export async function disablePush(): Promise<void> {
  const sub = await getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/**
 * Réabonnement silencieux au démarrage : si l'utilisateur a déjà accordé la
 * permission, on (re)crée l'abonnement et on le ré-enregistre en base. Évite
 * que le push se perde quand le navigateur fait expirer/tourner l'abonnement
 * (fréquent sur iOS) sur la durée du tournoi.
 */
export async function syncPushSubscription(userId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }))
    const json = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    })
  } catch {
    /* silencieux : l'utilisateur pourra réactiver manuellement dans Profil */
  }
}
