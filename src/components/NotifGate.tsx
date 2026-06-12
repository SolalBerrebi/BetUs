import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Spinner } from './ui'
import {
  enablePush,
  getSubscription,
  isIOS,
  isStandalone,
  pushSupported,
  syncPushSubscription,
} from '../lib/push'

/**
 * Gate STRICT : l'app reste inaccessible tant que (1) elle n'est pas installée sur
 * l'écran d'accueil (iPhone) ET (2) les notifications ne sont pas activées sur cet
 * appareil. Pas de bouton « plus tard ». Chaque état affiche la marche à suivre —
 * y compris le cas « refusé », sinon ce serait un cul-de-sac sans retour possible.
 */
type Phase = 'checking' | 'install' | 'enable' | 'denied' | 'passed'

/** Évite un spinner infini si serviceWorker.ready ne résout jamais (cas pathologique iOS). */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default function NotifGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const evaluate = useCallback(async () => {
    // iPhone hors écran d'accueil → installation obligatoire d'abord
    if (isIOS() && !isStandalone()) {
      setPhase('install')
      return
    }
    // Navigateur incapable de push et hors iOS (ex. desktop sans push) : rien à forcer
    if (!pushSupported()) {
      setPhase(isIOS() ? 'install' : 'passed')
      return
    }
    const perm = Notification.permission
    if (perm === 'denied') {
      setPhase('denied')
      return
    }
    if (perm === 'granted') {
      let sub = await withTimeout(getSubscription().catch(() => null), 4000, null)
      if (!sub) {
        await withTimeout(syncPushSubscription(userId).catch(() => undefined), 4000, undefined)
        sub = await withTimeout(getSubscription().catch(() => null), 4000, null)
      }
      setPhase(sub ? 'passed' : 'enable')
      return
    }
    setPhase('enable') // 'default' : jamais demandé
  }, [userId])

  useEffect(() => {
    void evaluate()
    // Re-vérifie au retour sur l'app (après install, ou après un tour dans les Réglages)
    const onVis = () => {
      if (document.visibilityState === 'visible') void evaluate()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [evaluate])

  async function activate() {
    setBusy(true)
    setError(null)
    const err = await enablePush(userId)
    setBusy(false)
    if (!err) {
      setPhase('passed')
      return
    }
    setError(err)
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setPhase('denied')
    }
  }

  if (phase === 'passed') return <>{children}</>
  if (phase === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-7 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-5 text-6xl">🏆</div>

        {phase === 'install' && (
          <>
            <h1 className="text-[26px] font-bold tracking-tight">Installe BetUs</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Pour jouer, l'app doit être sur ton écran d'accueil — c'est aussi ce qui
              permet les notifications sur iPhone.
            </p>
            <ol className="mt-6 space-y-3 text-left">
              {[
                ['Touche le bouton Partager', 'en bas de Safari (le carré avec la flèche ⬆️).'],
                ['Choisis « Sur l’écran d’accueil »', 'fais défiler le menu si besoin.'],
                ['Ouvre BetUs depuis l’icône', 'puis reconnecte-toi ici.'],
              ].map(([t, d], i) => (
                <li key={i} className="flex gap-3 rounded-2xl bg-surface px-4 py-3 shadow-(--shadow-card)">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[14px] leading-snug">
                    <span className="font-semibold text-ink">{t}</span>
                    <span className="block text-ink-2">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[13px] text-ink-3">
              Déjà installée ? Ferme cet onglet Safari et ouvre BetUs depuis l'icône.
            </p>
          </>
        )}

        {phase === 'enable' && (
          <>
            <h1 className="text-[26px] font-bold tracking-tight">Active les notifications</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              BetUs te prévient au coup d'envoi, à chaque but de tes pronos, et dès que
              le classement bouge. C'est obligatoire pour entrer.
            </p>
            <Button onClick={activate} loading={busy} className="mt-7 w-full">
              Activer les notifications
            </Button>
            {error && <p className="mt-3 text-[13px] font-medium text-negative">{error}</p>}
          </>
        )}

        {phase === 'denied' && (
          <>
            <h1 className="text-[26px] font-bold tracking-tight">Notifications bloquées</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Tu les as refusées une fois — le navigateur ne peut plus les redemander.
              Pour débloquer :
            </p>
            <div className="mt-5 rounded-2xl bg-surface px-5 py-4 text-left text-[14px] leading-relaxed shadow-(--shadow-card)">
              Réglages iPhone → <span className="font-semibold">BetUs</span> → Notifications →
              active <span className="font-semibold">Autoriser les notifications</span>, puis reviens.
            </div>
            <Button onClick={() => void evaluate()} className="mt-6 w-full">
              J'ai activé — revérifier
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
