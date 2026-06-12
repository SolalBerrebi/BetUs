// Edge Function `livescore` — score live + auto-import des résultats via API-Football.
// - matches.home_score/away_score + status='live' mis à jour pendant le match.
// - À la fin (FT/AET/PEN) : écrit un BROUILLON (result_draft) ; l'admin valide.
// Ne marque JAMAIS 'finished' et n'écrase jamais un match déjà validé par l'admin.
//
// Tâches :
//   { "task": "map" }   → (re)construit match_api depuis les fixtures CdM 2026 (à relancer pour les phases finales).
//   { "task": "live" }  → poll des scores + brouillons de fin de match (appelé par pg_cron, garde-fou inclus).
import { createClient } from 'npm:@supabase/supabase-js@2'

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

// "K. Mbappé" → "Mbappé" ; "A. Mac Allister" → "Mac Allister" ; sinon tel quel.
// Applique ensuite PLAYER_ALIAS pour ramener au nom canonique.
function surname(name: string | null): string | null {
  if (!name) return null
  const m = name.match(/^\p{L}+\.\s+(.+)$/u)
  const stripped = (m ? m[1] : name).trim()
  return PLAYER_ALIAS[nrm(stripped)] ?? stripped
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

/** Construit le brouillon de résultat à partir des events (buteurs/passeurs). */
async function importDraft(matchId: number, fixtureId: number, f: any): Promise<void> {
  const events = await apiGet(`/fixtures/events?fixture=${fixtureId}`)
  const scorers: string[] = []
  const assisters: string[] = []
  const ownGoals: string[] = []
  for (const e of events) {
    if (e.type !== 'Goal') continue
    if (e.comments === 'Penalty Shootout') continue // tirs au but : hors score
    if (e.detail === 'Missed Penalty') continue
    const sc = surname(e.player?.name)
    if (e.detail === 'Own Goal') {
      if (sc) ownGoals.push(sc)
      continue // un CSC n'est pas un "buteur" pronostiquable
    }
    if (sc) scorers.push(sc)
    const as = surname(e.assist?.name)
    if (as) assisters.push(as)
  }
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
    scorers: [...new Set(scorers)],
    assisters: [...new Set(assisters)],
    own_goals: [...new Set(ownGoals)],
    fixture_status: f.fixture.status.short,
    fetched_at: new Date().toISOString(),
  })
  // Met aussi le score final à l'affichage (statut 'live' tant que l'admin n'a pas validé)
  await supabase
    .from('matches')
    .update({ home_score: f.goals.home, away_score: f.goals.away, status: 'live' })
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
async function liveGoalNotifs(m: WindowMatch, h: number, a: number, fixtureId: number): Promise<number> {
  const events = await apiGet(`/fixtures/events?fixture=${fixtureId}`)
  const scorers: string[] = []
  for (const e of events) {
    if (e.type !== 'Goal' || e.comments === 'Penalty Shootout') continue
    if (e.detail === 'Missed Penalty' || e.detail === 'Own Goal') continue
    const sc = surname(e.player?.name)
    if (sc) scorers.push(sc)
  }
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
      add('scorer', `⚽️ ${cap(p.scorer)} a marqué !`, `Ton buteur trouve le filet sur ${homeName}–${awayName} — +3 pts en vue !`)
    }
    if (p.pred_home_score != null) {
      if (h === p.pred_home_score && a === p.pred_away_score) {
        add('exact_hit', '🎯 Score exact, là tout de suite !', `${homeName} ${h}–${a} ${awayName} : pile ton prono, +5 pts si ça tient.`)
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
  // Garde-fou quota : n'appelle l'API que s'il y a un match dans sa fenêtre, non encore validé.
  const { data: windowRows } = await supabase
    .from('matches')
    .select('id, home_score, away_score, home_team, away_team, home_code, away_code')
    .neq('status', 'finished')
    .gte('kickoff_at', new Date(now - 200 * 60_000).toISOString())
    .lte('kickoff_at', new Date(now + 10 * 60_000).toISOString())
  if (!windowRows?.length) return { skipped: 1 }

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
      await supabase
        .from('matches')
        .update({ home_score: f.goals.home, away_score: f.goals.away, status: 'live' })
        .eq('id', ourId)
        .neq('status', 'finished')
      live++
      if (newTotal > oldTotal) {
        notified += await liveGoalNotifs(m, f.goals.home, f.goals.away, f.fixture.id)
      }
    } else if (DONE_STATUS.has(st) && !drafted.has(ourId)) {
      await importDraft(ourId, f.fixture.id, f)
      imported++
    }
  }
  return { live, imported, notified }
}

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
