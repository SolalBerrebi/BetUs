import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { supabase } from '../lib/supabase'
import { ALL_TEAMS, isPlaceholder, teamName } from '../lib/teams'
import { STAGE_LABELS } from '../lib/types'
import { Button, Card, PageTitle, Segmented, Spinner } from '../components/ui'

function ChipsInput({ label, values, onChange }: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v) return
    onChange([...values, v])
    setDraft('')
  }
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink-2">{label}</p>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={`${v}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-medium text-accent">
              {v}
              <button
                type="button"
                aria-label={`Retirer ${v}`}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="text-accent/60 hover:text-accent"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Nom du joueur"
          className="h-11 flex-1 rounded-xl bg-surface-2 px-4 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-accent"
        />
        <Button type="button" variant="secondary" onClick={add} className="h-11 px-4">
          Ajouter
        </Button>
      </div>
    </div>
  )
}

const TEAM_ENTRIES = Object.entries(ALL_TEAMS).sort((a, b) => a[1].name.localeCompare(b[1].name))

function TeamAssign({ label, code, onChange }: {
  label: string
  code: string
  onChange: (code: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <select
        value={code}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full appearance-none rounded-xl bg-surface-2 px-4 text-[16px] outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Non déterminée</option>
        {TEAM_ENTRIES.map(([c, t]) => (
          <option key={c} value={c}>
            {t.flag} {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function AdminMatch() {
  const { id } = useParams()
  const { matches, refresh } = useApp()
  const match = matches.find((m) => m.id === Number(id))

  const [hs, setHs] = useState<string>(match?.home_score?.toString() ?? '')
  const [as_, setAs] = useState<string>(match?.away_score?.toString() ?? '')
  const [scorers, setScorers] = useState<string[]>(match?.scorers ?? [])
  const [assisters, setAssisters] = useState<string[]>(match?.assisters ?? [])
  const [override, setOverride] = useState<'home' | 'away' | null>(match?.winner_override ?? null)
  const [homeCode, setHomeCode] = useState(match?.home_code ?? '')
  const [awayCode, setAwayCode] = useState(match?.away_code ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!match) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    )
  }

  const placeholder = isPlaceholder(match.home_code) || isPlaceholder(match.away_code)
  const isDraw = hs !== '' && as_ !== '' && Number(hs) === Number(as_)
  const knockout = match.stage !== 'group'

  async function saveTeams() {
    if (!match) return
    setSaving(true)
    setError(null)
    const patch: Record<string, unknown> = {}
    if (homeCode) {
      patch.home_code = homeCode
      patch.home_team = ALL_TEAMS[homeCode].name
    }
    if (awayCode) {
      patch.away_code = awayCode
      patch.away_team = ALL_TEAMS[awayCode].name
    }
    const { error: e } = await supabase.from('matches').update(patch).eq('id', match.id)
    setSaving(false)
    if (e) setError(e.message)
    else await refresh()
  }

  async function saveResult(finish: boolean) {
    if (!match) return
    if (finish && (hs === '' || as_ === '')) {
      setError('Renseigne le score final.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: e } = await supabase
      .from('matches')
      .update({
        home_score: hs === '' ? null : Number(hs),
        away_score: as_ === '' ? null : Number(as_),
        scorers,
        assisters,
        winner_override: isDraw && knockout ? override : null,
        status: finish ? 'finished' : match.status,
      })
      .eq('id', match.id)
    setSaving(false)
    if (e) setError(e.message)
    else {
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent">
        ‹ Admin
      </Link>
      <PageTitle sub={`Match ${match.id} · ${STAGE_LABELS[match.stage]}${match.group_name ? ` · Groupe ${match.group_name}` : ''}`}>
        {teamName(match.home_team, match.home_code)} – {teamName(match.away_team, match.away_code)}
      </PageTitle>

      {placeholder && (
        <Card className="mb-4 p-5">
          <h2 className="mb-3 text-[17px] font-bold">Assigner les équipes</h2>
          <div className="grid grid-cols-2 gap-3">
            <TeamAssign label={`Domicile (${match.home_team})`} code={homeCode} onChange={setHomeCode} />
            <TeamAssign label={`Extérieur (${match.away_team})`} code={awayCode} onChange={setAwayCode} />
          </div>
          <Button variant="secondary" onClick={saveTeams} loading={saving} className="mt-4 w-full">
            Enregistrer les équipes
          </Button>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-4 text-[17px] font-bold">Résultat</h2>
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-4">
            {[
              { v: hs, set: setHs, team: teamName(match.home_team, match.home_code) },
              { v: as_, set: setAs, team: teamName(match.away_team, match.away_code) },
            ].map((x, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="max-w-28 truncate text-[13px] font-medium text-ink-2">{x.team}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={x.v}
                  onChange={(e) => x.set(e.target.value)}
                  className="tnum h-14 w-16 rounded-xl bg-surface-2 text-center text-[26px] font-bold outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            ))}
          </div>

          {isDraw && knockout && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Qualifié aux tirs au but</p>
              <Segmented
                options={[
                  { value: 'home', label: teamName(match.home_team, match.home_code) },
                  { value: 'away', label: teamName(match.away_team, match.away_code) },
                ]}
                value={override}
                onChange={setOverride}
              />
            </div>
          )}

          <ChipsInput label="Buteurs (tous, dans n'importe quel ordre)" values={scorers} onChange={setScorers} />
          <ChipsInput label="Passeurs décisifs" values={assisters} onChange={setAssisters} />

          {error && <p className="text-[14px] font-medium text-negative">{error}</p>}

          <div className="space-y-2.5">
            <Button onClick={() => saveResult(true)} loading={saving} className="w-full">
              {saved ? 'Enregistré ✓' : 'Valider le résultat (calcule les points)'}
            </Button>
            {match.status === 'finished' && (
              <p className="text-center text-[12px] text-ink-3">
                Le match est déjà marqué terminé — revalider écrase le résultat et recalcule tout.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
