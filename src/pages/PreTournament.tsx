import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useNow } from '../lib/AppContext'
import { Button, Card, PageTitle } from '../components/ui'
import PlayerInput from '../components/PlayerInput'
import { countdown } from '../lib/format'
import { ALL_TEAMS } from '../lib/teams'

const TEAM_OPTIONS = Object.values(ALL_TEAMS)
  .map((t) => t.name)
  .sort((a, b) => a.localeCompare(b))

function TeamSelect({ label, value, onChange, disabled, options = TEAM_OPTIONS, placeholder = 'Choisir…' }: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  options?: string[]
  placeholder?: string
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
        <option value="">{placeholder}</option>
        {options.map((t) => (
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

  // Cohérence finale / vainqueur :
  //   • les deux finalistes doivent être différents → on retire l'un de la liste de l'autre ;
  //   • le vainqueur est forcément l'un des deux finalistes → on restreint la liste à ceux-ci.
  const finalistAOptions = TEAM_OPTIONS.filter((t) => t !== finalistB)
  const finalistBOptions = TEAM_OPTIONS.filter((t) => t !== finalistA)
  const winnerOptions = [finalistA, finalistB].filter(Boolean)

  // Si le vainqueur choisi n'est plus un finaliste (finaliste changé), on le réinitialise.
  useEffect(() => {
    if (winner && winner !== finalistA && winner !== finalistB) setWinner('')
  }, [finalistA, finalistB, winner])

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
              ? `Jusqu'à 65 pts en jeu. Ferme dans ${countdown(tournamentStart, now)}.`
              : "Jusqu'à 65 pts en jeu."
        }
      >
        Avant-compétition
      </PageTitle>

      <Card className="p-5">
        <div className="space-y-5">
          <PlayerInput
            label="Meilleur buteur · 6 pts"
            value={topScorer}
            onChange={setTopScorer}
            placeholder="Tape un nom…"
            hint="Choisis dans la liste, ou tape le nom de famille."
            disabled={locked}
          />
          <PlayerInput
            label="Meilleur passeur · 8 pts"
            value={topAssister}
            onChange={setTopAssister}
            placeholder="Tape un nom…"
            disabled={locked}
          />
          <PlayerInput
            label="Meilleur gardien · 10 pts"
            value={bestKeeper}
            onChange={setBestKeeper}
            placeholder="Tape un nom…"
            disabled={locked}
          />
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Finale · 20 pts (les deux équipes, peu importe l'ordre)</p>
            <div className="grid grid-cols-2 gap-3">
              <TeamSelect label="Finaliste 1" value={finalistA} onChange={setFinalistA} disabled={locked} options={finalistAOptions} />
              <TeamSelect label="Finaliste 2" value={finalistB} onChange={setFinalistB} disabled={locked} options={finalistBOptions} />
            </div>
          </div>
          <div>
            <TeamSelect
              label="Équipe gagnante · 15 pts"
              value={winner}
              onChange={setWinner}
              disabled={locked || winnerOptions.length === 0}
              options={winnerOptions}
              placeholder={winnerOptions.length ? 'Choisir…' : 'Choisis d’abord les finalistes'}
            />
            {!locked && winnerOptions.length === 0 && (
              <p className="mt-1 text-[12px] text-ink-3">Le vainqueur doit être l'un des deux finalistes.</p>
            )}
          </div>
          <PlayerInput
            label="Meilleur joueur · 6 pts"
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
