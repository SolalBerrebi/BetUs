import { Link } from 'react-router-dom'
import type { Match, Prediction } from '../lib/types'
import { teamFlag, teamName } from '../lib/teams'
import { ambiance, countdown, timeLabel } from '../lib/format'
import { Badge } from './ui'

function TeamRow({ name, code, score, winner }: { name: string; code: string | null; score: number | null; winner: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[22px] leading-none">{teamFlag(code)}</span>
      <span className={`flex-1 truncate text-[16px] ${winner ? 'font-semibold' : 'font-normal'}`}>
        {teamName(name, code)}
      </span>
      {score !== null && (
        <span className={`tnum text-[17px] ${winner ? 'font-bold' : 'font-medium text-ink-2'}`}>{score}</span>
      )}
    </div>
  )
}

export default function MatchCard({
  match,
  prediction,
  points,
  now,
}: {
  match: Match
  prediction?: Prediction
  points?: number
  now: number
}) {
  const finished = match.status === 'finished'
  const homeWins = finished && match.home_score !== null && match.away_score !== null &&
    (match.home_score > match.away_score || (match.home_score === match.away_score && match.winner_override === 'home'))
  const awayWins = finished && match.home_score !== null && match.away_score !== null &&
    (match.away_score > match.home_score || (match.home_score === match.away_score && match.winner_override === 'away'))
  const cd = countdown(match.kickoff_at, now)
  const amb = ambiance(match.kickoff_at, match.status, now)
  // Score affiché dès qu'il est connu en cours de match (live), pas seulement à la fin
  const showScore = (finished || amb === 'live') && match.home_score !== null

  return (
    <Link
      to={`/match/${match.id}`}
      className={`block rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card) transition-transform duration-150 active:scale-[0.98] ${
        amb === 'imminent' ? 'imminent-glow' : ''
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-3">
          {match.group_name ? `Groupe ${match.group_name}` : ''}
          {match.group_name ? ' · ' : ''}
          {timeLabel(match.kickoff_at)}
        </span>
        {finished ? (
          points !== undefined ? (
            <Badge tone={points > 0 ? 'positive' : 'neutral'}>{points > 0 ? `+${points} pts` : '0 pt'}</Badge>
          ) : (
            <Badge tone="neutral">Terminé</Badge>
          )
        ) : amb === 'live' ? (
          <Badge tone="warning">
            <span className="live-dot mr-0.5 inline-block size-1.5 rounded-full bg-warning" />
            En cours
          </Badge>
        ) : prediction ? (
          <Badge tone="positive">Prono ✓</Badge>
        ) : amb === 'imminent' ? (
          <Badge tone="warning">⏳ Ferme dans {cd}</Badge>
        ) : amb === 'soon' ? (
          <Badge tone="accent">Ferme dans {cd}</Badge>
        ) : (
          <Badge tone="neutral">À pronostiquer</Badge>
        )}
      </div>
      <div className="space-y-2">
        <TeamRow name={match.home_team} code={match.home_code} score={showScore ? match.home_score : null} winner={homeWins} />
        <TeamRow name={match.away_team} code={match.away_code} score={showScore ? match.away_score : null} winner={awayWins} />
      </div>
    </Link>
  )
}
