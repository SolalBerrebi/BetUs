// Calculs du « Tableau » : classements de groupe + arbre du tableau final.
// Tout est dérivé de la table matches (aucune donnée supplémentaire) :
//   - les classements se déduisent des matchs de poule terminés ;
//   - les arêtes du bracket se lisent dans home_slot/away_slot ('W73' = vainqueur du 73).
import type { Match, Stage } from './types'
import { teamName } from './teams'

// ---------------------------------------------------------------------------
// Classements de groupe
// ---------------------------------------------------------------------------

export interface StandingRow {
  code: string | null
  team: string
  played: number
  win: number
  draw: number
  loss: number
  gf: number
  ga: number
  gd: number
  pts: number
}

export interface GroupTable {
  group: string
  rows: StandingRow[]
}

export function groupStandings(matches: Match[]): GroupTable[] {
  const groups = new Map<string, Map<string, StandingRow>>()
  const keyOf = (code: string | null, name: string) => code ?? name

  const ensure = (g: string, code: string | null, name: string): StandingRow => {
    let gm = groups.get(g)
    if (!gm) {
      gm = new Map()
      groups.set(g, gm)
    }
    const k = keyOf(code, name)
    let r = gm.get(k)
    if (!r) {
      r = { code, team: name, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
      gm.set(k, r)
    }
    return r
  }

  for (const m of matches) {
    if (m.stage !== 'group' || !m.group_name) continue
    // On enregistre les 4 équipes même sans match joué (table complète d'entrée de jeu).
    const home = ensure(m.group_name, m.home_code, m.home_team)
    const away = ensure(m.group_name, m.away_code, m.away_team)
    if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue
    const hs = m.home_score
    const as_ = m.away_score
    home.played++
    away.played++
    home.gf += hs
    home.ga += as_
    away.gf += as_
    away.ga += hs
    if (hs > as_) {
      home.win++
      home.pts += 3
      away.loss++
    } else if (hs < as_) {
      away.win++
      away.pts += 3
      home.loss++
    } else {
      home.draw++
      away.draw++
      home.pts++
      away.pts++
    }
  }

  const out: GroupTable[] = []
  for (const [g, gm] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const rows = [...gm.values()]
    rows.forEach((r) => (r.gd = r.gf - r.ga))
    rows.sort(
      (a, b) =>
        b.pts - a.pts ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        teamName(a.team, a.code).localeCompare(teamName(b.team, b.code)),
    )
    out.push({ group: g, rows })
  }
  return out
}

// ---------------------------------------------------------------------------
// Arbre du tableau final
// ---------------------------------------------------------------------------

export const ROUND_ORDER: Stage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
]

export const ROUND_LABEL: Record<string, string> = {
  group: 'Groupes',
  round_of_32: '16es',
  round_of_16: '8es',
  quarter_final: 'Quarts',
  semi_final: 'Demies',
  final: 'Finale',
}

export interface BracketNode {
  match: Match
  col: number // index de la colonne (round_of_32 = 0 … final = 4)
  row: number // position verticale en « unités de feuille »
}

// 'W73' / l'ancien placeholder 'W73' encore dans home_team → 73. null sinon.
function winnerChildId(slot: string | null, fallback: string): number | null {
  const s = slot && /^W\d+$/.test(slot) ? slot : /^W\d+$/.test(fallback) ? fallback : null
  return s ? Number(s.slice(1)) : null
}

export interface BracketLayout {
  nodes: BracketNode[]
  leafCount: number
  thirdPlace: Match | null
  final: Match | null
}

/**
 * Place chaque match à élimination directe sur une grille (colonne = round,
 * ligne = ordre vertical). Les feuilles (16es) sont rangées par un parcours en
 * profondeur depuis la finale ; chaque match parent se centre sur ses deux
 * enfants → les connecteurs tombent juste, comme un vrai bracket.
 */
export function buildBracket(matches: Match[]): BracketLayout {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const final = matches.find((m) => m.stage === 'final') ?? null
  const thirdPlace = matches.find((m) => m.stage === 'third_place') ?? null

  const rowOf = new Map<number, number>()
  let leafCount = 0

  const dfs = (id: number): number => {
    const m = byId.get(id)
    if (!m) return 0
    const hc = winnerChildId(m.home_slot, m.home_team)
    const ac = winnerChildId(m.away_slot, m.away_team)
    if (hc == null && ac == null) {
      const r = leafCount++
      rowOf.set(id, r)
      return r
    }
    const rs: number[] = []
    if (hc != null) rs.push(dfs(hc))
    if (ac != null) rs.push(dfs(ac))
    const r = rs.reduce((a, b) => a + b, 0) / rs.length
    rowOf.set(id, r)
    return r
  }

  if (final) dfs(final.id)

  const nodes: BracketNode[] = []
  for (const m of matches) {
    if (m.stage === 'group' || m.stage === 'third_place') continue
    const col = ROUND_ORDER.indexOf(m.stage)
    const row = rowOf.get(m.id)
    if (col < 0 || row == null) continue
    nodes.push({ match: m, col, row })
  }

  return { nodes, leafCount, thirdPlace, final }
}
