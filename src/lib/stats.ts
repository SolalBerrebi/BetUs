// Stats perso « frappantes » dérivées des données existantes (aucun backend) :
// précision par catégorie, superlatifs (meilleur coup / série / spécialité),
// comparaison au groupe et répartition des points.
import type { LeaderboardRow, Match, MatchPoints, Prediction } from './types'
import { teamName } from './teams'
import { computeStreak } from './share'

export interface CatAccuracy { hits: number; tries: number }

export interface PersoStats {
  totalPoints: number
  rank: number
  totalPlayers: number
  vsAverage: number // écart à la moyenne du groupe
  beat: number // nb de joueurs strictement derrière moi
  hitRate: number // % de pronos terminés qui rapportent ≥ 1 pt
  scoredCount: number
  accuracy: { winner: CatAccuracy; exact: CatAccuracy; scorer: CatAccuracy; assister: CatAccuracy }
  bestMatch: { points: number; label: string } | null
  currentStreak: { kind: 'win' | 'loss'; count: number } | null
  bestStreak: number
  specialty: { title: string; label: string; rankInGroup: number } | null
  avgPerProno: number
  breakdown: { exact: number; winner: number; scorer: number; assister: number; tournament: number }
}

const total = (mp: MatchPoints) => mp.winner_pts + mp.scorer_pts + mp.assister_pts + mp.exact_pts

export function computeStats(args: {
  me: string
  myPoints: MatchPoints[]
  myPreds: Prediction[]
  matches: Match[]
  board: LeaderboardRow[]
}): PersoStats | null {
  const { me, myPoints, myPreds, matches, board } = args
  const myRow = board.find((r) => r.user_id === me)
  if (!myRow || board.length === 0) return null

  const byId = new Map(matches.map((m) => [m.id, m]))
  // Pronos terminés (stables) avec mes points.
  const scored = myPoints
    .map((mp) => ({ mp, m: byId.get(mp.match_id) }))
    .filter((x): x is { mp: MatchPoints; m: Match } => !!x.m && x.m.status === 'finished')

  const finishedIds = new Set(scored.map((x) => x.mp.match_id))
  const tries = (pred: (p: Prediction) => boolean) =>
    myPreds.filter((p) => finishedIds.has(p.match_id) && pred(p)).length
  const hits = (sel: (mp: MatchPoints) => number) => scored.filter((x) => sel(x.mp) > 0).length

  const accuracy = {
    winner: { hits: hits((mp) => mp.winner_pts), tries: tries((p) => p.winner != null) },
    exact: { hits: hits((mp) => mp.exact_pts), tries: tries((p) => p.pred_home_score != null) },
    scorer: { hits: hits((mp) => mp.scorer_pts), tries: tries((p) => !!p.scorer) },
    assister: { hits: hits((mp) => mp.assister_pts), tries: tries((p) => !!p.assister) },
  }

  const withPts = scored.filter((x) => total(x.mp) > 0).length
  const hitRate = scored.length ? Math.round((withPts / scored.length) * 100) : 0

  // Meilleur coup (plus gros total sur un match).
  let bestMatch: PersoStats['bestMatch'] = null
  for (const { mp, m } of scored) {
    const t = total(mp)
    if (t > 0 && (!bestMatch || t > bestMatch.points)) {
      bestMatch = {
        points: t,
        label: `${teamName(m.home_team, m.home_code)} ${m.home_score}-${m.away_score} ${teamName(m.away_team, m.away_code)}`,
      }
    }
  }

  // Séries (chronologique pour le record, anti-chrono pour la série en cours).
  const chrono = scored.slice().sort((a, b) => +new Date(a.m.kickoff_at) - +new Date(b.m.kickoff_at))
  let bestStreak = 0
  let run = 0
  for (const x of chrono) {
    if (total(x.mp) > 0) {
      run++
      bestStreak = Math.max(bestStreak, run)
    } else run = 0
  }
  const recent = scored.slice().sort((a, b) => +new Date(b.m.kickoff_at) - +new Date(a.m.kickoff_at))
  const currentStreak = computeStreak(recent.map((x) => ({ points: total(x.mp) })))

  // Spécialité : la catégorie où je suis le mieux classé dans le groupe.
  const cats = [
    { title: 'As du score exact 🎯', label: 'scores exacts', val: (r: LeaderboardRow) => r.exact_count },
    { title: 'Dénicheur de buteurs ⚽️', label: 'buteurs trouvés', val: (r: LeaderboardRow) => r.scorer_count },
    { title: 'Œil du passeur 🅰️', label: 'passeurs trouvés', val: (r: LeaderboardRow) => r.assister_count },
    { title: 'Lecteur de matchs 🔮', label: 'vainqueurs trouvés', val: (r: LeaderboardRow) => r.winner_count },
  ]
  let specialty: PersoStats['specialty'] = null
  let bestRank = Infinity
  let bestVal = 0
  for (const c of cats) {
    const v = c.val(myRow)
    if (v <= 0) continue
    const rankInGroup = board.filter((r) => c.val(r) > v).length + 1
    if (rankInGroup < bestRank || (rankInGroup === bestRank && v > bestVal)) {
      bestRank = rankInGroup
      bestVal = v
      specialty = { title: c.title, label: c.label, rankInGroup }
    }
  }

  const avg = board.reduce((s, r) => s + r.total_points, 0) / board.length
  const vsAverage = Math.round(myRow.total_points - avg)
  const beat = board.filter((r) => r.total_points < myRow.total_points).length
  const rank = board.filter((r) => r.total_points > myRow.total_points).length + 1

  const breakdown = {
    exact: scored.reduce((s, x) => s + x.mp.exact_pts, 0),
    winner: scored.reduce((s, x) => s + x.mp.winner_pts, 0),
    scorer: scored.reduce((s, x) => s + x.mp.scorer_pts, 0),
    assister: scored.reduce((s, x) => s + x.mp.assister_pts, 0),
    tournament: myRow.tournament_points,
  }
  const avgPerProno = scored.length ? Math.round((myRow.match_points / scored.length) * 10) / 10 : 0

  return {
    totalPoints: myRow.total_points,
    rank,
    totalPlayers: board.length,
    vsAverage,
    beat,
    hitRate,
    scoredCount: scored.length,
    accuracy,
    bestMatch,
    currentStreak,
    bestStreak,
    specialty,
    avgPerProno,
    breakdown,
  }
}

export const pct = (a: CatAccuracy) => (a.tries ? Math.round((a.hits / a.tries) * 100) : 0)
