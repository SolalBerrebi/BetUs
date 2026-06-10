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

async function apiGet(path: string): Promise<any[]> {
  const res = await fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } })
  if (!res.ok) throw new Error(`api-football ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`api-football errors: ${JSON.stringify(json.errors)}`)
  }
  return json.response ?? []
}

// "K. Mbappé" → "Mbappé" ; "A. Mac Allister" → "Mac Allister" ; sinon tel quel
function surname(name: string | null): string | null {
  if (!name) return null
  const m = name.match(/^\p{L}+\.\s+(.+)$/u)
  return (m ? m[1] : name).trim()
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

async function live(): Promise<Record<string, number>> {
  const now = Date.now()
  // Garde-fou quota : n'appelle l'API que s'il y a un match dans sa fenêtre, non encore validé.
  const { data: windowRows } = await supabase
    .from('matches')
    .select('id')
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
  const windowIds = new Set(windowRows.map((r) => r.id))

  // Un seul appel renvoie tous les matchs CdM avec score + statut courant
  const fixtures = await apiGet(`/fixtures?league=${LEAGUE}&season=${SEASON}`)
  let live = 0
  let imported = 0
  for (const f of fixtures) {
    const ourId = ourIdByFixture.get(f.fixture.id)
    if (!ourId || !windowIds.has(ourId)) continue
    const st = f.fixture.status.short
    if (LIVE_STATUS.has(st) && f.goals.home != null) {
      await supabase
        .from('matches')
        .update({ home_score: f.goals.home, away_score: f.goals.away, status: 'live' })
        .eq('id', ourId)
        .neq('status', 'finished')
      live++
    } else if (DONE_STATUS.has(st) && !drafted.has(ourId)) {
      await importDraft(ourId, f.fixture.id, f)
      imported++
    }
  }
  return { live, imported }
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
