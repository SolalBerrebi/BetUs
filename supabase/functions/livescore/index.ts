// Edge Function `livescore` — score en direct via football-data.org.
// Met à jour matches.home_score/away_score + status='live' pendant le match.
// Ne marque JAMAIS 'finished' : c'est l'admin qui valide le résultat (et donc le scoring).
//
// Deux tâches :
//   { "task": "map" }  → (re)construit la correspondance match_fd (1 appel API). À lancer une fois.
//   { "task": "poll" } → met à jour les scores des matchs en cours (appelé par pg_cron, garde-fou inclus).
import { createClient } from 'npm:@supabase/supabase-js@2'

const FD_BASE = 'https://api.football-data.org/v4'
const FD_TOKEN = Deno.env.get('FOOTBALL_DATA_TOKEN')!

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface FdMatch {
  id: number
  utcDate: string
  status: string
  homeTeam: { name: string }
  awayTeam: { name: string }
  score: { fullTime: { home: number | null; away: number | null } }
}

async function fdMatches(): Promise<FdMatch[]> {
  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { 'X-Auth-Token': FD_TOKEN },
  })
  if (!res.ok) throw new Error(`football-data ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return (json.matches ?? []) as FdMatch[]
}

const minuteKey = (iso: string) => new Date(iso).toISOString().slice(0, 16) // aligne à la minute

/** Correspondance par horaire de coup d'envoi (officiel des deux côtés), repli par date+équipes. */
async function buildMap(): Promise<Record<string, number>> {
  const fd = await fdMatches()
  const { data: ours } = await supabase.from('matches').select('id, kickoff_at, home_team, away_team')
  const byTime = new Map<string, number>()
  for (const m of ours ?? []) byTime.set(minuteKey(m.kickoff_at), m.id)

  const rows: { match_id: number; fd_id: number }[] = []
  const unmatched: number[] = []
  for (const f of fd) {
    const ourId = byTime.get(minuteKey(f.utcDate))
    if (ourId) rows.push({ match_id: ourId, fd_id: f.id })
    else unmatched.push(f.id)
  }
  if (rows.length) await supabase.from('match_fd').upsert(rows)
  return { mapped: rows.length, unmatched: unmatched.length } as unknown as Record<string, number>
}

async function poll(): Promise<Record<string, number>> {
  const now = Date.now()
  // Garde-fou : on n'appelle l'API que s'il y a au moins un match dans sa fenêtre de jeu.
  const { data: window } = await supabase
    .from('matches')
    .select('id')
    .neq('status', 'finished')
    .gte('kickoff_at', new Date(now - 150 * 60_000).toISOString())
    .lte('kickoff_at', new Date(now + 5 * 60_000).toISOString())
  if (!window?.length) return { skipped: 1 }

  const { data: mapRows } = await supabase.from('match_fd').select('match_id, fd_id')
  const ourIdByFd = new Map((mapRows ?? []).map((r) => [r.fd_id, r.match_id]))

  const fd = await fdMatches()
  let updated = 0
  for (const f of fd) {
    if (f.status !== 'IN_PLAY' && f.status !== 'PAUSED') continue
    const ourId = ourIdByFd.get(f.id)
    if (!ourId || f.score.fullTime.home === null) continue
    await supabase
      .from('matches')
      .update({
        home_score: f.score.fullTime.home,
        away_score: f.score.fullTime.away,
        status: 'live',
      })
      .eq('id', ourId)
      .neq('status', 'finished') // ne jamais écraser un résultat validé par l'admin
    updated++
  }
  return { updated }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  try {
    const out = body.task === 'map' ? await buildMap() : await poll()
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
