import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { Button, Card, PageTitle } from '../components/ui'
import PlayerInput from '../components/PlayerInput'
import { countdown } from '../lib/format'
import { ALL_TEAMS } from '../lib/teams'

const TEAM_OPTIONS = Object.values(ALL_TEAMS)
  .map((t) => t.name)
  .sort((a, b) => a.localeCompare(b))

function TeamSelect({ label, value, onChange, disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const id = label.toLowerCase().replace(/\W+/g, '-')
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-12 w-full appearance-none rounded-xl bg-surface-2 px-4 text-[17px] text-ink outline-none transition-shadow duration-150 focus:ring-2 focus:ring-accent disabled:opacity-50"
      >
        <option value="">Choisir…</option>
        {TEAM_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function PreTournament() {
  const { session, tournamentStart, myTournamentPrediction, saveTournamentPrediction } = useApp()
  const now = useNow()
  const navigate = useNavigate()
  const locked = tournamentStart != null && now >= new Date(tournamentStart).getTime()

  const p = myTournamentPrediction
  const [topScorer, setTopScorer] = useState(p?.top_scorer ?? '')
  const [topAssister, setTopAssister] = useState(p?.top_assister ?? '')
  const [bestKeeper, setBestKeeper] = useState(p?.best_keeper ?? '')
  const [finalistA, setFinalistA] = useState(p?.finalist_a ?? '')
  const [finalistB, setFinalistB] = useState(p?.finalist_b ?? '')
  const [winner, setWinner] = useState(p?.winner ?? '')
  const [bestPlayer, setBestPlayer] = useState(p?.best_player ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!session) return
    setSaving(true)
    setError(null)
    const err = await saveTournamentPrediction({
      user_id: session.user.id,
      top_scorer: topScorer.trim() || null,
      top_assister: topAssister.trim() || null,
      best_keeper: bestKeeper.trim() || null,
      finalist_a: finalistA || null,
      finalist_b: finalistB || null,
      winner: winner || null,
      best_player: bestPlayer.trim() || null,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-[16px] font-medium text-accent">
        ‹ Retour
      </button>
      <PageTitle
        sub={
          locked
            ? 'La compétition a commencé — pronostics verrouillés.'
            : tournamentStart
              ? `3 pts par bonne réponse. Ferme dans ${countdown(tournamentStart, now)}.`
              : '3 pts par bonne réponse.'
        }
      >
        Avant-compétition
      </PageTitle>

      <Card className="p-5">
        <div className="space-y-5">
          <PlayerInput
            label="Meilleur buteur · 3 pts"
            value={topScorer}
            onChange={setTopScorer}
            placeholder="Tape un nom…"
            hint="Choisis dans la liste, ou tape le nom de famille."
            disabled={locked}
          />
          <PlayerInput
            label="Meilleur passeur · 3 pts"
            value={topAssister}
            onChange={setTopAssister}
            placeholder="Tape un nom…"
            disabled={locked}
          />
          <PlayerInput
            label="Meilleur gardien · 3 pts"
            value={bestKeeper}
            onChange={setBestKeeper}
            placeholder="Tape un nom…"
            disabled={locked}
          />
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Finale · 3 pts (les deux équipes, peu importe l'ordre)</p>
            <div className="grid grid-cols-2 gap-3">
              <TeamSelect label="Finaliste 1" value={finalistA} onChange={setFinalistA} disabled={locked} />
              <TeamSelect label="Finaliste 2" value={finalistB} onChange={setFinalistB} disabled={locked} />
            </div>
          </div>
          <TeamSelect label="Équipe gagnante · 3 pts" value={winner} onChange={setWinner} disabled={locked} />
          <PlayerInput
            label="Meilleur joueur · 3 pts"
            value={bestPlayer}
            onChange={setBestPlayer}
            placeholder="Tape un nom…"
            disabled={locked}
          />

          {error && <p className="text-[14px] font-medium text-negative">{error}</p>}
          {!locked && (
            <Button onClick={submit} loading={saving} className="w-full">
              {saved ? 'Enregistré ✓' : 'Valider mes pronostics'}
            </Button>
          )}
        </div>
      </Card>

      {locked && (
        <p className="mt-4 text-center text-[13px] text-ink-3">
          <Link to="/pronos" className="text-accent">
            Voir mes pronostics
          </Link>
        </p>
      )}
    </div>
  )
}
