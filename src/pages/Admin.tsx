import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import { teamFlag, teamName } from '../lib/teams'
import { dayLabel, hasStarted, timeLabel } from '../lib/format'
import { Badge, Card, PageTitle, Segmented } from '../components/ui'

export default function Admin() {
  const { profiles, matches, refresh } = useApp()
  const now = useNow()
  const [tab, setTab] = useState<'results' | 'payments'>('results')
  const [busyId, setBusyId] = useState<string | null>(null)

  const toFill = useMemo(
    () => matches.filter((m) => hasStarted(m.kickoff_at, now) && m.status !== 'finished'),
    [matches, now],
  )
  const finished = useMemo(
    () => matches.filter((m) => m.status === 'finished').reverse(),
    [matches],
  )
  const upcoming = useMemo(
    () => matches.filter((m) => !hasStarted(m.kickoff_at, now)).slice(0, 10),
    [matches, now],
  )

  async function togglePaid(id: string, paid: boolean) {
    setBusyId(id)
    await supabase.from('profiles').update({ has_paid: paid }).eq('id', id)
    await refresh()
    setBusyId(null)
  }

  const paidCount = profiles.filter((p) => p.has_paid).length

  function MatchRow({ id }: { id: number }) {
    const m = matches.find((x) => x.id === id)!
    return (
      <Link key={m.id} to={`/admin/match/${m.id}`} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2/60">
        <div>
          <p className="text-[15px] font-semibold">
            {teamFlag(m.home_code)} {teamName(m.home_team, m.home_code)} – {teamName(m.away_team, m.away_code)}{' '}
            {teamFlag(m.away_code)}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-3">
            M{m.id} · {dayLabel(m.kickoff_at)} {timeLabel(m.kickoff_at)}
          </p>
        </div>
        {m.status === 'finished' ? (
          <span className="tnum text-[16px] font-bold">
            {m.home_score}–{m.away_score}
          </span>
        ) : (
          <Badge tone={hasStarted(m.kickoff_at, now) ? 'warning' : 'neutral'}>
            {hasStarted(m.kickoff_at, now) ? 'À saisir' : 'À venir'}
          </Badge>
        )}
      </Link>
    )
  }

  return (
    <div>
      <PageTitle sub="Réservé à l'organisateur">Admin</PageTitle>

      <div className="mb-5">
        <Segmented
          options={[
            { value: 'results', label: 'Résultats' },
            { value: 'payments', label: `Paiements (${paidCount}/${profiles.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'results' ? (
        <div className="space-y-6">
          <Link
            to="/admin/competition"
            className="block rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card) transition-transform duration-150 active:scale-[0.98]"
          >
            <p className="text-[16px] font-semibold">🏆 Résultats finaux de la compétition</p>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Meilleur buteur, passeur, gardien, finale… — à saisir à la fin pour scorer l'avant-compétition.
            </p>
          </Link>

          {toFill.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Résultats à saisir</h2>
              <Card className="divide-y divide-line/60">
                {toFill.map((m) => (
                  <MatchRow key={m.id} id={m.id} />
                ))}
              </Card>
            </section>
          )}

          <section>
            <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Prochains matchs</h2>
            <Card className="divide-y divide-line/60">
              {upcoming.map((m) => (
                <MatchRow key={m.id} id={m.id} />
              ))}
            </Card>
            <p className="mt-2 px-1 text-[12px] text-ink-3">
              Astuce : ouvre un match à venir pour assigner les équipes des matchs à élimination directe.
            </p>
          </section>

          {finished.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink-2">Terminés (corriger si besoin)</h2>
              <Card className="divide-y divide-line/60">
                {finished.map((m) => (
                  <MatchRow key={m.id} id={m.id} />
                ))}
              </Card>
            </section>
          )}
        </div>
      ) : (
        <div>
          <Card className="divide-y divide-line/60">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[16px] font-semibold">
                    {p.display_name} {p.is_admin && <Badge tone="accent">admin</Badge>}
                  </p>
                </div>
                <button
                  onClick={() => togglePaid(p.id, !p.has_paid)}
                  disabled={busyId === p.id}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                    p.has_paid ? 'bg-positive-soft text-[#1d9a45]' : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {p.has_paid ? '30 € reçus ✓' : 'Marquer payé'}
                </button>
              </div>
            ))}
          </Card>
          <p className="mt-3 px-2 text-center text-[13px] text-ink-3">
            Cagnotte : {paidCount * 30} € — 1er : {Math.round(paidCount * 30 * 0.7)} €, 2e :{' '}
            {Math.round(paidCount * 30 * 0.3)} €.
          </p>
        </div>
      )}
    </div>
  )
}
