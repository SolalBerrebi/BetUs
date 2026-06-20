import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow, MatchPoints } from '../lib/types'
import { Badge, Button, Card, Field, PageTitle } from '../components/ui'
import { disablePush, enablePush, getSubscription, isIOS, isStandalone, pushSupported } from '../lib/push'
import ShareSheet from '../components/ShareSheet'
import type { ShareData } from '../components/ShareCard'
import { computeStreak } from '../lib/share'

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
  const { profile, profiles, matches, signOut, refresh } = useApp()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [stats, setStats] = useState<LeaderboardRow | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [streak, setStreak] = useState<{ kind: 'win' | 'loss'; count: number } | null>(null)
  const [share, setShare] = useState<ShareData | null>(null)

  useEffect(() => {
    if (!profile) return
    setName(profile.display_name)
    supabase.from('leaderboard').select('*').eq('user_id', profile.id).maybeSingle().then(({ data }) => {
      if (data) setStats(data as LeaderboardRow)
    })
    supabase.from('ranked_leaderboard').select('rank').eq('user_id', profile.id).maybeSingle().then(({ data }) => {
      if (data) setRank((data as { rank: number }).rank)
    })
    // Série en cours : pronos terminés, du plus récent au plus ancien.
    supabase.from('match_points').select('*').eq('user_id', profile.id).then(({ data }) => {
      const byId = new Map(matches.map((m) => [m.id, m]))
      const results = ((data as MatchPoints[]) ?? [])
        .map((mp) => ({ mp, m: byId.get(mp.match_id) }))
        .filter((x) => x.m && x.m.status === 'finished')
        .sort((a, b) => new Date(b.m!.kickoff_at).getTime() - new Date(a.m!.kickoff_at).getTime())
        .map((x) => ({ points: x.mp.winner_pts + x.mp.scorer_pts + x.mp.assister_pts + x.mp.exact_pts }))
      setStreak(computeStreak(results))
    })
  }, [profile, matches])

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

      {stats && (
        <Card className="mb-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-bold">Mes stats</h2>
            {streak && streak.count >= 2 && (
              <Badge tone={streak.kind === 'win' ? 'positive' : 'warning'}>
                {streak.kind === 'win' ? '🔥' : '🥶'} {streak.count} d'affilée
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            {[
              [stats.total_points, 'points'],
              [stats.predictions_scored, 'pronos comptés'],
              [stats.exact_count, 'scores exacts'],
              [stats.scorer_count, 'buteurs trouvés'],
              [stats.assister_count, 'passeurs trouvés'],
              [stats.winner_count, 'vainqueurs trouvés'],
            ].map(([v, label]) => (
              <div key={label as string} className="rounded-xl bg-surface-2 px-3 py-3">
                <p className="tnum text-[24px] font-bold">{v}</p>
                <p className="text-[12px] text-ink-2">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() =>
                setShare({
                  kind: 'stats',
                  name: profile?.display_name ?? 'Moi',
                  rank,
                  totalPlayers: profiles.length || null,
                  totalPoints: stats.total_points,
                  exact: stats.exact_count,
                  scorers: stats.scorer_count,
                  assisters: stats.assister_count,
                  winners: stats.winner_count,
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
        </Card>
      )}

      {share && <ShareSheet data={share} onClose={() => setShare(null)} />}

      <Button variant="destructive" onClick={signOut} className="w-full">
        Se déconnecter
      </Button>
    </div>
  )
}
