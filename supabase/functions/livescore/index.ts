// Edge Function `livescore` — score live + auto-import des résultats via API-Football.
// - matches.home_score/away_score + status='live' mis à jour pendant le match.
// - À la fin (FT/AET/PEN) : écrit un BROUILLON (result_draft) ; l'admin valide.
// Ne marque JAMAIS 'finished' et n'écrase jamais un match déjà validé par l'admin.
//
// Tâches :
//   { "task": "map" }   → (re)construit match_api depuis les fixtures CdM 2026 (à relancer pour les phases finales).
//   { "task": "live" }  → poll des scores + brouillons de fin de match (appelé par pg_cron, garde-fou inclus).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PLAYERS, type PlayerEntry } from '../../../src/lib/players.ts'

const API = 'https://v3.football.api-sports.io'
const KEY = Deno.env.get('APISPORTS_KEY')!
const LEAGUE = 1 // World Cup
const SEASON = 2026

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const LIVE_STATUS = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'])
const DONE_STATUS = new Set(['FT', 'AET', 'PEN'])
const PUSH_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/push`

const FR: Record<string, string> = {
  USA: 'États-Unis', MEX: 'Mexique', CAN: 'Canada', FRA: 'France', ENG: 'Angleterre',
  ESP: 'Espagne', GER: 'Allemagne', POR: 'Portugal', NED: 'Pays-Bas', BEL: 'Belgique',
  CRO: 'Croatie', SUI: 'Suisse', AUT: 'Autriche', SCO: 'Écosse', NOR: 'Norvège',
  SWE: 'Suède', TUR: 'Turquie', CZE: 'Tchéquie', BIH: 'Bosnie', ARG: 'Argentine',
  BRA: 'Brésil', URU: 'Uruguay', COL: 'Colombie', ECU: 'Équateur', PAR: 'Paraguay',
  MAR: 'Maroc', SEN: 'Sénégal', TUN: 'Tunisie', ALG: 'Algérie', EGY: 'Égypte',
  CIV: "Côte d'Ivoire", GHA: 'Ghana', RSA: 'Afrique du Sud', CPV: 'Cap-Vert',
  COD: 'RD Congo', JPN: 'Japon', KOR: 'Corée du Sud', IRN: 'Iran', AUS: 'Australie',
  KSA: 'Arabie saoudite', QAT: 'Qatar', UZB: 'Ouzbékistan', JOR: 'Jordanie', IRQ: 'Irak',
  NZL: 'Nouvelle-Zélande', PAN: 'Panama', HAI: 'Haïti', CUW: 'Curaçao',
}
const team = (name: string, code: string | null) => (code && FR[code]) || name

// Matching tolérant (mirroir léger de name_matches SQL) pour les notifs buteur
function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}
const nrm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/^[a-z]\. /, '')
    .replace(/[-'.’]/g, ' ').replace(/\s+/g, ' ').trim()
function nameMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const x = nrm(a), y = nrm(b)
  if (x === y) return true
  // L'un est contenu dans l'autre en mots entiers ("Hyeon-gyu" ⊂ "Oh Hyeon-Gyu")
  if (x.length >= 4 && ` ${y} `.includes(` ${x} `)) return true
  if (y.length >= 4 && ` ${x} `.includes(` ${y} `)) return true
  return x[0] === y[0] && Math.max(x.length, y.length) >= 5 &&
    lev(x, y) <= (Math.max(x.length, y.length) >= 9 ? 2 : 1)
}

async function pushDirect(items: unknown[]): Promise<void> {
  if (!items.length) return
  await fetch(PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-secret': Deno.env.get('PUSH_SECRET')! },
    body: JSON.stringify({ task: 'direct', items }),
  })
}

async function apiGet(path: string): Promise<any[]> {
  const res = await fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } })
  if (!res.ok) throw new Error(`api-football ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`api-football errors: ${JSON.stringify(json.errors)}`)
  }
  return json.response ?? []
}

// L'API translittère certains noms autrement que les effectifs officiels (arabe surtout)
// ou utilise un surnom : on ramène au nom canonique de notre liste (src/lib/players.ts)
// pour que les pronos des joueurs valident. Clés = nom API normalisé (nrm, initiale ôtée).
const PLAYER_ALIAS: Record<string, string> = {
  'hassan tambakti': 'Al-Tambakti', tambakti: 'Al-Tambakti', // KSA
  'feras al brikan': 'Al-Buraikan', 'al brikan': 'Al-Buraikan', // KSA
  'ala al haji': 'Al-Hejji', 'al haji': 'Al-Hejji', // KSA
  'mousa tamari': 'Al-Taamari', tamari: 'Al-Taamari', // JOR
  'yazid abu layla': 'Abulaila', 'abu layla': 'Abulaila', // JOR
  'abu al dahab': 'Abu Dahab', // JOR
  'hossein kanani': 'Kanaanizadegan', kanani: 'Kanaanizadegan', // IRN
  'ben doak': 'Gannon-Doak', doak: 'Gannon-Doak', // SCO
  'lawrence zigi': 'Ati-Zigi', zigi: 'Ati-Zigi', // GHA
  'oston orunov': 'Urunov', orunov: 'Urunov', // UZB
  'zaid ismaeel': 'Ismail', ismaeel: 'Ismail', // IRQ
  'sultan al braik': 'Al-Brake', 'al braik': 'Al-Brake', // QAT
  'ahmed alaa': 'Alaaeldin', // QAT
  'sabri ben hsan': 'Ben Hessen', 'ben hsan': 'Ben Hessen', // TUN
  abdelmouhib: 'Chamakh', // TUN — Mouhib Chamakh
  pico: 'Lopes', // CPV — Roberto « Pico » Lopes
  'vinicius junior': 'Vini Jr.', // BRA
  'park jin seop': 'Jin-seob', 'jin seop': 'Jin-seob', // KOR
  'mostafa zico': 'Ziko', zico: 'Ziko', // EGY
  'van de ven': 'Ven', // NED
  'jose sa': 'Sá', // POR
  'mohammed abu zurayq': 'Abu Zrayq', 'abu zurayq': 'Abu Zrayq', // JOR
  'abdallah naseeb': 'Nasib', naseeb: 'Nasib', // JOR
  'ibrahim sa deh': 'Sadeh', 'sa deh': 'Sadeh', // JOR
  'mustafa saadoun': 'Saadoon', saadoun: 'Saadoon', // IRQ
  'rebin solaka': 'Sulaka', solaka: 'Sulaka', // IRQ
  'munaf younus': 'Younis', younus: 'Younis', // IRQ
  'ahmed fathi': 'Fathy', // QAT (clé complète : un autre Fathy existe en Égypte)
  // Noms trop courts pour le containment (< 4 lettres) : clés complètes uniquement
  'almoez ali': 'Ali', // QAT
  'hussein ali': 'Ali', 'mohanad ali': 'Ali', // IRQ
  'ricardo ade': 'Adé', // HAI
}

// Roster officiel indexé par équipe, pour résoudre les noms de l'API.
const ROSTER_BY_TEAM = (() => {
  const m = new Map<string, PlayerEntry[]>()
  for (const p of PLAYERS) {
    const arr = m.get(p.t)
    if (arr) arr.push(p)
    else m.set(p.t, [p])
  }
  return m
})()
// Pool de joueurs candidats = effectifs des (deux) équipes concernées par le match.
const poolFor = (...codes: (string | null)[]): PlayerEntry[] =>
  codes.filter(Boolean).flatMap((c) => ROSTER_BY_TEAM.get(c as string) ?? [])

// Ramène un nom renvoyé par l'API au nom de famille canonique du roster — c.-à-d. la
// valeur EXACTE choisie dans le dropdown par les joueurs — en le cherchant parmi les
// effectifs des deux équipes du match (≈ 50 candidats, donc fuzzy sans faux positifs).
// Gère "K. Mbappé"→"Mbappé", "Vinicius Junior"→"Vini Jr.", translittérations (Younus/Younis).
// Retombe sur l'alias manuel puis sur le nom brut si aucun candidat ne correspond.
function resolveRoster(name: string | null, pool: PlayerEntry[]): string | null {
  if (!name) return null
  const mInit = name.match(/^\p{L}+\.\s+(.+)$/u)
  const stripped = (mInit ? mInit[1] : name).trim()
  const aliased = PLAYER_ALIAS[nrm(stripped)] ?? stripped
  const q = nrm(aliased)     // nom de famille recherché (alias appliqué)
  const full = nrm(stripped) // nom complet renvoyé par l'API (initiale ôtée)
  let bestS: string | null = null
  let bestD = Infinity
  for (const p of pool) {
    const s = nrm(p.s), f = nrm(p.f)
    if (s === q) return p.s // nom de famille identique : match parfait
    // 1) nom de famille contenu en mots entiers ("Hyeon-gyu" ⊂ "Oh Hyeon-Gyu")
    // 2) le nom complet API correspond-il au nom complet du joueur ?
    //    ("Vinicius Junior" = f ; "Kylian Mbappe" ⊃ "mbappe")
    // 3) tolérance orthographe sur le nom de famille (même initiale, distance courte)
    const contained = (q.length >= 4 && ` ${q} `.includes(` ${s} `)) ||
      (s.length >= 4 && ` ${s} `.includes(` ${q} `))
    const fullHit = f === full || (full.length >= 5 && (f.includes(full) || full.includes(f)))
    const d = lev(s, q)
    const fuzzy = s[0] === q[0] && Math.max(s.length, q.length) >= 5 &&
      d <= (Math.max(s.length, q.length) >= 9 ? 2 : 1)
    if ((contained || fullHit || fuzzy) && d < bestD) {
      bestD = d
      bestS = p.s
    }
  }
  return bestS ?? aliased
}

// --- Compositions --------------------------------------------------------
interface LineupPlayer {
  n: number | null
  name: string
  pos: string | null
  grid: string | null
}
interface TeamLineup {
  formation: string | null
  coach: string | null
  startXI: LineupPlayer[]
  subs: LineupPlayer[]
}

const mapLineupPlayer = (p: any): LineupPlayer => ({
  n: p?.number ?? null,
  name: p?.name ?? '',
  pos: p?.pos ?? null,
  grid: p?.grid ?? null,
})
const mapLineupTeam = (t: any): TeamLineup => ({
  formation: t?.formation ?? null,
  coach: t?.coach?.name ?? null,
  startXI: (t?.startXI ?? []).map((e: any) => mapLineupPlayer(e.player)),
  subs: (t?.substitutes ?? []).map((e: any) => mapLineupPlayer(e.player)),
})

// L'API renvoie un tableau de 2 équipes (vide tant que les compos ne sont pas
// publiées, ~40-90 min avant le coup d'envoi). On range home/away via le nom
// d'équipe (teamKey) → fonctionne sans la réponse /fixtures (préchargement).
function parseLineups(resp: any[], homeKey: string): { home: TeamLineup; away: TeamLineup } | null {
  if (!resp || resp.length < 2) return null
  if (!(resp[0]?.startXI?.length)) return null // compos pas encore dispo
  const homeEntry = resp.find((t) => teamKey(t.team?.name ?? '') === homeKey) ?? resp[0]
  const awayEntry = resp.find((t) => t !== homeEntry) ?? resp[1]
  return { home: mapLineupTeam(homeEntry), away: mapLineupTeam(awayEntry) }
}

const minuteKey = (iso: string) => new Date(iso).toISOString().slice(0, 16)

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Écarts de nommage API-Football → nos noms en base
const TEAM_ALIAS: Record<string, string> = {
  'bosnia & herzegovina': 'bosnia and herzegovina',
  'cape verde islands': 'cape verde',
  'congo dr': 'dr congo',
  'czech republic': 'czechia',
  usa: 'united states',
}
const teamKey = (name: string) => {
  const n = norm(name)
  return TEAM_ALIAS[n] ?? n
}
// Clé d'un match : heure + équipes (orientation domicile/extérieur conservée)
const matchKey = (iso: string, home: string, away: string) =>
  `${minuteKey(iso)}|${home}|${away}`

// Préchargement des compositions pour les prochains matchs, indépendamment du
// score live. On vise les ~4 prochains matchs jusqu'à 3 h avant le coup d'envoi
// et on les sonde dès maintenant : dès que l'API publie les compos (~40-90 min
// avant), on les stocke. Cadence réduite quand c'est loin (> 90 min) pour
// préserver le quota — un appel /fixtures/lineups par match et par tentative.
const PREFETCH_HORIZON_MIN = 180 // jusqu'à 3 h avant le coup d'envoi
const PREFETCH_MAX_MATCHES = 4
async function prefetchLineups(now: number, minute: number): Promise<number> {
  const { data: ups } = await supabase
    .from('matches')
    .select('id, home_team, kickoff_at')
    .neq('status', 'finished')
    .is('lineups', null)
    .gte('kickoff_at', new Date(now - 150 * 60_000).toISOString()) // inclut les matchs en cours
    .lte('kickoff_at', new Date(now + PREFETCH_HORIZON_MIN * 60_000).toISOString())
    .order('kickoff_at')
    .limit(PREFETCH_MAX_MATCHES)
  if (!ups?.length) return 0

  const { data: mapRows } = await supabase.from('match_api').select('match_id, fixture_id')
  const fxByMatch = new Map((mapRows ?? []).map((r) => [r.match_id, r.fixture_id]))

  let added = 0
  for (const m of ups) {
    const fx = fxByMatch.get(m.id)
    if (!fx) continue
    const toKo = new Date(m.kickoff_at).getTime() - now
    // Loin du coup d'envoi (> 90 min) : on ne tente qu'une fois tous les ~15 min.
    if (toKo > 90 * 60_000 && minute % 15 !== 0) continue
    try {
      const lu = parseLineups(await apiGet(`/fixtures/lineups?fixture=${fx}`), teamKey(m.home_team))
      if (lu) {
        await supabase.from('matches').update({ lineups: lu }).eq('id', m.id)
        added++
      }
    } catch { /* compos indispo : prochain tick */ }
  }
  return added
}

async function buildMap(): Promise<Record<string, number>> {
  const fixtures = await apiGet(`/fixtures?league=${LEAGUE}&season=${SEASON}`)
  const { data: ours } = await supabase.from('matches').select('id, kickoff_at, home_team, away_team')
  const byKey = new Map<string, number>()
  for (const m of ours ?? []) {
    byKey.set(matchKey(m.kickoff_at, teamKey(m.home_team), teamKey(m.away_team)), m.id)
  }

  const byMatch = new Map<number, number>() // match_id → fixture_id (dédup)
  const unmatched: string[] = []
  for (const f of fixtures) {
    const key = matchKey(f.fixture.date, teamKey(f.teams.home.name), teamKey(f.teams.away.name))
    const ourId = byKey.get(key)
    if (ourId) byMatch.set(ourId, f.fixture.id)
    else unmatched.push(`${f.teams.home.name}-${f.teams.away.name}`)
  }
  const rows = [...byMatch].map(([match_id, fixture_id]) => ({ match_id, fixture_id }))
  if (rows.length) {
    const { error } = await supabase.from('match_api').upsert(rows)
    if (error) throw new Error(`upsert match_api: ${error.message}`)
  }
  return { fixtures: fixtures.length, mapped: rows.length, unmatched: unmatched as unknown as number }
}

interface GoalEvent {
  min: number
  team: 'home' | 'away'
  scorer: string | null
  assist: string | null
}
interface ParsedEvents {
  scorers: string[]
  assisters: string[]
  ownGoals: string[]
  subs: Array<{ out: string; in: string }>
  timeline: GoalEvent[]
}

/** Buteurs/passeurs/CSC (TAB exclus) + remplacements + timeline des buts depuis les
 *  events d'un fixture. Les chaînes de remplacements sont aplaties : A sorti pour B,
 *  B sorti pour C → paires (A,B), (B,C) et (A,C), pour créditer le prono du joueur sorti.
 *  homeId = id de l'équipe à domicile, pour ranger chaque but du bon côté.
 *  pool = effectifs des deux équipes, pour résoudre les noms API vers le roster. */
function parseEvents(events: any[], homeId: number | undefined, pool: PlayerEntry[]): ParsedEvents {
  const scorers: string[] = []
  const assisters: string[] = []
  const ownGoals: string[] = []
  const subs: Array<{ out: string; in: string }> = []
  const timeline: GoalEvent[] = []
  for (const e of events) {
    if (e.type === 'subst') {
      // API-Football : player = sortant, assist = entrant
      const out = resolveRoster(e.player?.name, pool)
      const inn = resolveRoster(e.assist?.name, pool)
      if (!out || !inn) continue
      for (const s of [...subs]) {
        if (nameMatch(s.in, out)) subs.push({ out: s.out, in: inn })
      }
      subs.push({ out, in: inn })
      continue
    }
    if (e.type !== 'Goal') continue
    if (e.comments === 'Penalty Shootout') continue // tirs au but : hors score
    if (e.detail === 'Missed Penalty') continue
    const sc = resolveRoster(e.player?.name, pool)
    const min = (e.time?.elapsed ?? 0) + (e.time?.extra ?? 0)
    const scoringTeamIsHome = e.team?.id === homeId
    if (e.detail === 'Own Goal') {
      if (sc) ownGoals.push(sc)
      // Un CSC compte pour l'équipe adverse au tableau d'affichage
      timeline.push({
        min,
        team: scoringTeamIsHome ? 'away' : 'home',
        scorer: sc ? `${sc} (csc)` : null,
        assist: null,
      })
      continue // un CSC n'est pas un "buteur" pronostiquable
    }
    if (sc) scorers.push(sc)
    const as = resolveRoster(e.assist?.name, pool)
    if (as) assisters.push(as)
    timeline.push({ min, team: scoringTeamIsHome ? 'home' : 'away', scorer: sc, assist: as })
  }
  timeline.sort((a, b) => a.min - b.min)
  return {
    scorers: [...new Set(scorers)],
    assisters: [...new Set(assisters)],
    ownGoals: [...new Set(ownGoals)],
    subs,
    timeline,
  }
}

/** Construit le brouillon de résultat à partir des events (buteurs/passeurs). */
async function importDraft(m: WindowMatch, fixtureId: number, f: any): Promise<void> {
  const matchId = m.id
  const events = await apiGet(`/fixtures/events?fixture=${fixtureId}`)
  const pool = poolFor(m.home_code, m.away_code)
  const { scorers, assisters, ownGoals, subs, timeline } = parseEvents(events, f.teams?.home?.id, pool)
  // Qualifié aux tirs au but (phases finales) si match nul après prolongation
  let override: 'home' | 'away' | null = null
  const pen = f.score?.penalty
  if (pen && pen.home != null && pen.away != null && f.goals.home === f.goals.away) {
    override = pen.home > pen.away ? 'home' : 'away'
  }
  await supabase.from('result_draft').upsert({
    match_id: matchId,
    home_score: f.goals.home,
    away_score: f.goals.away,
    winner_override: override,
    scorers,
    assisters,
    own_goals: ownGoals,
    fixture_status: f.fixture.status.short,
    fetched_at: new Date().toISOString(),
  })
  // Score + buteurs/passeurs/remplacements finaux : le classement compte le match
  // dès la fin (statut 'live' tant que l'admin n'a pas validé — il reste souverain).
  // winner_override inclus → les pts vainqueur sur un match aux t.a.b. sont justes en live.
  await supabase
    .from('matches')
    .update({
      home_score: f.goals.home,
      away_score: f.goals.away,
      scorers,
      assisters,
      subs,
      goals_timeline: timeline,
      winner_override: override,
      minute: null, // match terminé : plus de minute qui tourne
      period: f.fixture.status.short,
      status: 'live',
    })
    .eq('id', matchId)
    .neq('status', 'finished')
}

interface WindowMatch {
  id: number
  home_score: number | null
  away_score: number | null
  home_team: string
  away_team: string
  home_code: string | null
  away_code: string | null
}

// Notifs personnalisées au moment d'un but (buteur trouvé, score exact, vainqueur en bonne voie).
async function liveGoalNotifs(m: WindowMatch, h: number, a: number, parsed: ParsedEvents): Promise<number> {
  const { scorers } = parsed
  const [{ data: preds }, { data: sent }] = await Promise.all([
    supabase.from('predictions')
      .select('user_id, winner, pred_home_score, pred_away_score, scorer').eq('match_id', m.id),
    supabase.from('live_notif').select('user_id, kind').eq('match_id', m.id),
  ])
  const already = new Set((sent ?? []).map((r) => `${r.user_id}|${r.kind}`))
  const homeName = team(m.home_team, m.home_code)
  const awayName = team(m.away_team, m.away_code)
  const outcome = h > a ? 'home' : h < a ? 'away' : 'draw'
  const url = `/BetUs/#/match/${m.id}/chat`
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const items: Array<Record<string, string>> = []
  const log: Array<{ match_id: number; user_id: string; kind: string }> = []
  for (const p of preds ?? []) {
    const add = (kind: string, title: string, bodyTxt: string) => {
      if (already.has(`${p.user_id}|${kind}`)) return
      already.add(`${p.user_id}|${kind}`)
      items.push({ user_id: p.user_id, title, body: bodyTxt, url, tag: `live-${m.id}-${kind}` })
      log.push({ match_id: m.id, user_id: p.user_id, kind })
    }
    if (p.scorer && scorers.some((s) => nameMatch(s, p.scorer))) {
      add('scorer', `⚽️ ${cap(p.scorer)} a marqué !`, `Ton buteur trouve le filet sur ${homeName}–${awayName} — +4 pts en vue !`)
    } else if (
      p.scorer && parsed.subs.some((sub) =>
        nameMatch(sub.out, p.scorer) && scorers.some((s) => nameMatch(s, sub.in)))
    ) {
      add('scorer', `⚽️ Son remplaçant a marqué !`, `${cap(p.scorer)} était sorti, mais son remplaçant marque sur ${homeName}–${awayName} — ton prono compte, +4 pts en vue !`)
    }
    if (p.pred_home_score != null) {
      if (h === p.pred_home_score && a === p.pred_away_score) {
        add('exact_hit', '🎯 Score exact, là tout de suite !', `${homeName} ${h}–${a} ${awayName} : pile ton prono, +6 pts si ça tient.`)
      } else if (h > p.pred_home_score || a > p.pred_away_score) {
        add('exact_broken', '😬 Ton score exact est tombé', `Le ${p.pred_home_score}–${p.pred_away_score} n'est plus jouable sur ${homeName}–${awayName}.`)
      }
    }
    if (p.winner && p.winner !== 'draw' && outcome === p.winner) {
      add('winner_lead', '👍 Sur la bonne voie', `${p.winner === 'home' ? homeName : awayName} mène — ton pari vainqueur est bien parti.`)
    }
  }
  if (log.length) {
    await supabase.from('live_notif').insert(log)
    await pushDirect(items)
  }
  return items.length
}

async function live(): Promise<Record<string, number>> {
  const now = Date.now()
  // Préchargement des compos des prochains matchs (jusqu'à 3 h avant), indépendant
  // du score live → tourne même quand aucun match n'est en cours.
  const lineupsAdded = await prefetchLineups(now, new Date(now).getUTCMinutes())

  // Garde-fou quota : n'appelle l'API score que s'il y a un match dans sa fenêtre, non encore validé.
  const { data: windowRows } = await supabase
    .from('matches')
    .select('id, home_score, away_score, home_team, away_team, home_code, away_code')
    .neq('status', 'finished')
    .gte('kickoff_at', new Date(now - 200 * 60_000).toISOString())
    .lte('kickoff_at', new Date(now + 10 * 60_000).toISOString())
  if (!windowRows?.length) return { skipped: 1, lineupsAdded }

  const [{ data: mapRows }, { data: drafts }] = await Promise.all([
    supabase.from('match_api').select('match_id, fixture_id'),
    supabase.from('result_draft').select('match_id'),
  ])
  const ourIdByFixture = new Map((mapRows ?? []).map((r) => [r.fixture_id, r.match_id]))
  const drafted = new Set((drafts ?? []).map((d) => d.match_id))
  const matchById = new Map((windowRows as WindowMatch[]).map((m) => [m.id, m]))

  // Un seul appel renvoie tous les matchs CdM avec score + statut courant
  const fixtures = await apiGet(`/fixtures?league=${LEAGUE}&season=${SEASON}`)
  let live = 0
  let imported = 0
  let notified = 0
  for (const f of fixtures) {
    const ourId = ourIdByFixture.get(f.fixture.id)
    const m = ourId ? matchById.get(ourId) : undefined
    if (!ourId || !m) continue
    const st = f.fixture.status.short
    if (LIVE_STATUS.has(st) && f.goals.home != null) {
      const oldTotal = (m.home_score ?? 0) + (m.away_score ?? 0)
      const newTotal = f.goals.home + f.goals.away
      // Minute + statut : gratuits (déjà dans la réponse), mis à jour chaque tick
      // pour que la minute tourne dans le salon.
      const elapsed = f.fixture.status.elapsed
      const patch: Record<string, unknown> = {
        home_score: f.goals.home,
        away_score: f.goals.away,
        minute: elapsed != null ? elapsed + (f.fixture.status.extra ?? 0) : null,
        period: st,
        status: 'live',
      }
      // But marqué : on récupère les events (1 appel) pour buteurs/passeurs/remplacements
      // + timeline en direct → le classement et le fil du salon bougent pendant le match.
      let parsed: ParsedEvents | null = null
      if (newTotal > oldTotal) {
        parsed = parseEvents(
          await apiGet(`/fixtures/events?fixture=${f.fixture.id}`),
          f.teams.home.id,
          poolFor(m.home_code, m.away_code),
        )
        patch.scorers = parsed.scorers
        patch.assisters = parsed.assisters
        patch.subs = parsed.subs
        patch.goals_timeline = parsed.timeline
      }
      await supabase.from('matches').update(patch).eq('id', ourId).neq('status', 'finished')
      live++
      if (parsed) {
        notified += await liveGoalNotifs(m, f.goals.home, f.goals.away, parsed)
      }
    } else if (DONE_STATUS.has(st) && !drafted.has(ourId)) {
      await importDraft(m, f.fixture.id, f)
      imported++
    }
  }
  return { live, imported, notified, lineupsAdded }
}

// (lineupsAdded provient du préchargement en tête de live().)

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  try {
    const out = body.task === 'map' ? await buildMap() : await live()
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
