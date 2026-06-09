import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ALL_TEAMS } from '../lib/teams'
import { Button, Card, Field, PageTitle, Spinner } from '../components/ui'

const TEAM_NAMES = Object.values(ALL_TEAMS).map((t) => t.name).sort((a, b) => a.localeCompare(b))

export default function AdminCompetition() {
  const [loaded, setLoaded] = useState(false)
  const [values, setValues] = useState({
    top_scorer: '',
    top_assister: '',
    best_keeper: '',
    finalist_a: '',
    finalist_b: '',
    winner: '',
    best_player: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('tournament_results').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setValues({
          top_scorer: data.top_scorer ?? '',
          top_assister: data.top_assister ?? '',
          best_keeper: data.best_keeper ?? '',
          finalist_a: data.finalist_a ?? '',
          finalist_b: data.finalist_b ?? '',
          winner: data.winner ?? '',
          best_player: data.best_player ?? '',
        })
      }
      setLoaded(true)
    })
  }, [])

  function set(k: keyof typeof values) {
    return (v: string) => setValues((prev) => ({ ...prev, [k]: v }))
  }

  async function submit() {
    setSaving(true)
    setError(null)
    const payload = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v.trim() || null]),
    )
    const { error: e } = await supabase.from('tournament_results').upsert({ id: true, ...payload })
    setSaving(false)
    if (e) setError(e.message)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (!loaded) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    )
  }

  const TeamSelect = ({ label, k }: { label: string; k: keyof typeof values }) => (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <select
        value={values[k]}
        onChange={(e) => set(k)(e.target.value)}
        className="h-12 w-full appearance-none rounded-xl bg-surface-2 px-4 text-[16px] outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Non déterminé</option>
        {TEAM_NAMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent">
        ‹ Admin
      </Link>
      <PageTitle sub="À saisir à la fin de la compétition — score les pronos d'avant-compétition (3 pts chacun).">
        Résultats finaux
      </PageTitle>

      <Card className="p-5">
        <div className="space-y-5">
          <Field label="Meilleur buteur" value={values.top_scorer} onChange={(e) => set('top_scorer')(e.target.value)} />
          <Field label="Meilleur passeur" value={values.top_assister} onChange={(e) => set('top_assister')(e.target.value)} />
          <Field label="Meilleur gardien" value={values.best_keeper} onChange={(e) => set('best_keeper')(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TeamSelect label="Finaliste 1" k="finalist_a" />
            <TeamSelect label="Finaliste 2" k="finalist_b" />
          </div>
          <TeamSelect label="Équipe gagnante" k="winner" />
          <Field label="Meilleur joueur" value={values.best_player} onChange={(e) => set('best_player')(e.target.value)} />
          {error && <p className="text-[14px] font-medium text-negative">{error}</p>}
          <Button onClick={submit} loading={saving} className="w-full">
            {saved ? 'Enregistré ✓' : 'Enregistrer les résultats'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
