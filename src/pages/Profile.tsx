import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow, MatchPoints, Prediction } from '../lib/types'
import { Badge, Button, Card, Field, PageTitle } from '../components/ui'
import { disablePush, enablePush, getSubscription, isIOS, isStandalone, pushSupported } from '../lib/push'
import ShareSheet from '../components/ShareSheet'
import type { ShareData } from '../components/ShareCard'
import StatsDashboard from '../components/StatsDashboard'
import { computeStats, type PersoStats } from '../lib/stats'

function NotificationsCard({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSubscription().then((s) => setEnabled(!!s))
  }, [])

  const needsInstall = isIOS() && !isStandalone()

  async function toggle() {
    setBusy(true)
    setError(null)
    if (enabled) {
      await disablePush()
      setEnabled(false)
    } else {
      const err = await enablePush(userId)
      if (err) setError(err)
      else setEnabled(true)
    }
    setBusy(false)
  }

  return (
    <Card className="mb-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold">Notifications</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Rappel 1 h avant chaque match, et résultats dès qu'ils tombent.
          </p>
        </div>
      </div>
      {needsInstall ? (
        <p className="mt-3 rounded-xl bg-warning-soft px-4 py-3 text-[13px] leading-relaxed text-[#c77700]">
          Sur iPhone : ajoute d'abord l'app à ton écran d'accueil (bouton Partager →
          « Sur l'écran d'accueil »), puis reviens ici activer les notifications.
        </p>
      ) : !pushSupported() ? (
        <p className="mt-3 text-[13px] text-ink-3">Ce navigateur ne supporte pas les notifications.</p>
      ) : (
        <>
          <Button
            variant={enabled ? 'secondary' : 'primary'}
            onClick={toggle}
            loading={busy || enabled === null}
            className="mt-4 w-full"
          >
            {enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
          </Button>
          {enabled && <p className="mt-2 text-center text-[12px] text-positive">Notifications activées sur cet appareil ✓</p>}
          {error && <p className="mt-2 text-[13px] font-medium text-negative">{error}</p>}
        </>
      )}
    </Card>
  )
}

export default function Profile() {
  const { profile, matches, signOut, refresh } = useApp()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [perso, setPerso] = useState<PersoStats | null>(null)
  const [share, setShare] = useState<ShareData | null>(null)

  useEffect(() => {
    if (!profile) return
    setName(profile.display_name)
    Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('predictions').select('*').eq('user_id', profile.id),
      supabase.from('match_points').select('*').eq('user_id', profile.id),
    ]).then(([lb, pr, mp]) => {
      setPerso(
        computeStats({
          me: profile.id,
          myPoints: (mp.data as MatchPoints[]) ?? [],
          myPreds: (pr.data as Prediction[]) ?? [],
          matches,
          board: (lb.data as LeaderboardRow[]) ?? [],
        }),
      )
    })
  }, [profile, matches])

  const streak = perso?.currentStreak ?? null

  async function saveName() {
    if (!profile || !name.trim()) return
    setSaving(true)
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile.id)
    await refresh()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageTitle sub={profile?.is_admin ? 'Organisateur' : undefined}>Profil</PageTitle>

      <Card className="mb-4 p-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="Prénom affiché" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={saveName} loading={saving} className="h-12">
            {saved ? '✓' : 'OK'}
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-4">
          <span className="text-[14px] text-ink-2">Participation 30 €</span>
          <Badge tone={profile?.has_paid ? 'positive' : 'warning'}>
            {profile?.has_paid ? 'Payée ✓' : 'En attente'}
          </Badge>
        </div>
        {!profile?.has_paid && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            Envoie 30 € sur le Revolut de l'organisateur — il validera ton paiement ici.
          </p>
        )}
      </Card>

      {profile && <NotificationsCard userId={profile.id} />}

      {perso && (
        <section className="mb-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[17px] font-bold">Mes stats</h2>
            {streak && streak.count >= 2 && (
              <Badge tone={streak.kind === 'win' ? 'positive' : 'warning'}>
                {streak.kind === 'win' ? '🔥' : '🥶'} {streak.count} d'affilée
              </Badge>
            )}
          </div>
          <StatsDashboard stats={perso} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() =>
                setShare({
                  kind: 'stats',
                  name: profile?.display_name ?? 'Moi',
                  rank: perso.rank,
                  totalPlayers: perso.totalPlayers,
                  totalPoints: perso.totalPoints,
                  vsAverage: perso.vsAverage,
                  hitRate: perso.hitRate,
                  specialty: perso.specialty?.title ?? null,
                  bestMatchPoints: perso.bestMatch?.points ?? null,
                })
              }
            >
              Partager mes stats
            </Button>
            {streak && streak.count >= 2 && (
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() =>
                  setShare({
                    kind: 'streak',
                    name: profile?.display_name ?? 'Moi',
                    streakKind: streak.kind,
                    count: streak.count,
                  })
                }
              >
                Partager ma série
              </Button>
            )}
          </div>
        </section>
      )}

      {share && <ShareSheet data={share} onClose={() => setShare(null)} />}

      <Button variant="destructive" onClick={signOut} className="w-full">
        Se déconnecter
      </Button>
    </div>
  )
}
