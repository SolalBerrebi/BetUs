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
  // Slots d'origine du tableau final ('W73', 'L101'…) — stables, pour câbler le bracket.
  home_slot: string | null
  away_slot: string | null
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
  lineups: MatchLineups | null
  stats: MatchStats | null
  odds: MatchOdds | null
  momentum: MomentumPoint[] | null
}

export interface MomentumPoint {
  min: number
  value: number // -100..100, + = domicile pousse
}

export interface MatchOdds {
  home: number
  draw: number
  away: number
  book: string | null // nom du bookmaker
}

// Statistiques live d'une équipe (API-Football /fixtures/statistics). null = indispo.
export interface TeamStats {
  possession: number | null // %
  shots_total: number | null
  shots_on: number | null
  shots_off: number | null
  shots_blocked: number | null
  corners: number | null
  offsides: number | null
  fouls: number | null
  passes_pct: number | null // % de passes réussies
  saves: number | null // arrêts du gardien
  yellow: number | null
  red: number | null
  xg: number | null // buts attendus (si le plan le fournit)
}

export interface MatchStats {
  home: TeamStats
  away: TeamStats
}

export interface LineupPlayer {
  n: number | null // numéro de maillot
  name: string // nom affiché (tel que renvoyé par l'API)
  pos: string | null // G/D/M/F
  grid: string | null // "ligne:colonne" depuis le but (1 = gardien)
}

export interface TeamLineup {
  formation: string | null // ex. "4-3-3"
  coach: string | null
  startXI: LineupPlayer[]
  subs: LineupPlayer[]
}

export interface MatchLineups {
  home: TeamLineup
  away: TeamLineup
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

export interface TopPlayer {
  category: 'scorer' | 'assister'
  rank: number
  player: string
  full_name: string | null
  team_code: string | null
  value: number
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
