export type Stage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final'

export interface Profile {
  id: string
  display_name: string
  is_admin: boolean
  has_paid: boolean
  pronos_note: string | null
}

export interface PlayerComment {
  id: number
  target_user_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Match {
  id: number
  stage: Stage
  group_name: string | null
  home_team: string
  away_team: string
  home_code: string | null
  away_code: string | null
  kickoff_at: string
  city: string | null
  venue: string | null
  status: 'scheduled' | 'live' | 'finished'
  home_score: number | null
  away_score: number | null
  winner_override: 'home' | 'away' | null
  scorers: string[]
  assisters: string[]
  minute: number | null
  period: string | null
  goals_timeline: GoalEvent[]
}

export interface GoalEvent {
  min: number
  team: 'home' | 'away'
  scorer: string | null
  assist: string | null
}

export interface Prediction {
  id?: number
  user_id: string
  match_id: number
  winner: 'home' | 'draw' | 'away' | null
  pred_home_score: number | null
  pred_away_score: number | null
  scorer: string | null
  assister: string | null
}

export interface TournamentPrediction {
  user_id: string
  top_scorer: string | null
  top_assister: string | null
  best_keeper: string | null
  finalist_a: string | null
  finalist_b: string | null
  winner: string | null
  best_player: string | null
}

export interface TournamentResults extends Omit<TournamentPrediction, 'user_id'> {
  id: boolean
}

export interface LeaderboardRow {
  user_id: string
  display_name: string
  has_paid: boolean
  total_points: number
  match_points: number
  tournament_points: number
  exact_count: number
  scorer_count: number
  assister_count: number
  winner_count: number
  predictions_scored: number
}

export interface MatchPoints {
  user_id: string
  match_id: number
  winner_pts: number
  scorer_pts: number
  assister_pts: number
  exact_pts: number
}

export interface Message {
  id: number
  match_id: number
  user_id: string
  body: string
  created_at: string
}

export interface TournamentBreakdownRow {
  user_id: string
  slot: number
  item: string
  pick: string | null
  answer: string | null
  points: number
}

export const STAGE_LABELS: Record<Stage, string> = {
  group: 'Phase de groupes',
  round_of_32: '16es de finale',
  round_of_16: '8es de finale',
  quarter_final: 'Quarts de finale',
  semi_final: 'Demi-finales',
  third_place: 'Petite finale',
  final: 'Finale',
}
