// Edge Function `push` — envoi des notifications Web Push (VAPID).
// Appelée par pg_cron (rappels 1 h avant match) et par trigger (résultat saisi).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const FR: Record<string, string> = {
  USA: 'États-Unis', MEX: 'Mexique', CAN: 'Canada', FRA: 'France', ENG: 'Angleterre',
  ESP: 'Espagne', GER: 'Allemagne', POR: 'Portugal', NED: 'Pays-Bas', BEL: 'Belgique',
  CRO: 'Croatie', SUI: 'Suisse', AUT: 'Autriche', SCO: 'Écosse', NOR: 'Norvège',
  SWE: 'Suède', TUR: 'Turquie', CZE: 'Tchéquie', BIH: 'Bosnie-Herzégovine',
  ARG: 'Argentine', BRA: 'Brésil', URU: 'Uruguay', COL: 'Colombie', ECU: 'Équateur',
  PAR: 'Paraguay', MAR: 'Maroc', SEN: 'Sénégal', TUN: 'Tunisie', ALG: 'Algérie',
  EGY: 'Égypte', CIV: "Côte d'Ivoire", GHA: 'Ghana', RSA: 'Afrique du Sud',
  CPV: 'Cap-Vert', COD: 'RD Congo', JPN: 'Japon', KOR: 'Corée du Sud', IRN: 'Iran',
  AUS: 'Australie', KSA: 'Arabie saoudite', QAT: 'Qatar', UZB: 'Ouzbékistan',
  JOR: 'Jordanie', IRQ: 'Irak', NZL: 'Nouvelle-Zélande', PAN: 'Panama', HAI: 'Haïti',
  CUW: 'Curaçao',
}

const team = (name: string, code: string | null) => (code && FR[code]) || name

webpush.setVapidDetails(
  'mailto:solal@verss.ai',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface Payload {
  title: string
  body: string
  url: string
  tag: string
}

async function broadcast(payload: Payload): Promise<number> {
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return 0
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        )
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        } else {
          console.error('push error', code, s.endpoint.slice(0, 60))
        }
      }
    }),
  )
  return sent
}

/** Réserve l'envoi (kind, match_id) ; false si déjà envoyé. */
async function claim(kind: string, matchId: number): Promise<boolean> {
  const { error } = await supabase.from('push_log').insert({ kind, match_id: matchId })
  return !error
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const task = body.task as string
  const results: Record<string, number> = {}

  if (task === 'reminders') {
    const { data: due } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'scheduled')
      .gt('kickoff_at', new Date().toISOString())
      .lte('kickoff_at', new Date(Date.now() + 62 * 60_000).toISOString())
    for (const m of due ?? []) {
      if (!(await claim('reminder', m.id))) continue
      results[`match_${m.id}`] = await broadcast({
        title: `⚽️ ${team(m.home_team, m.home_code)} – ${team(m.away_team, m.away_code)} dans 1 h`,
        body: 'Envoie ton prono avant le coup d’envoi !',
        url: `/BetUs/#/match/${m.id}`,
        tag: `reminder-${m.id}`,
      })
    }
  } else if (task === 'result') {
    const matchId = Number(body.match_id)
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).single()
    if (m && (await claim('result', m.id))) {
      results[`match_${m.id}`] = await broadcast({
        title: `🔔 ${team(m.home_team, m.home_code)} ${m.home_score} – ${m.away_score} ${team(m.away_team, m.away_code)}`,
        body: 'Résultat saisi, classement mis à jour — viens voir tes points.',
        url: `/BetUs/#/match/${m.id}`,
        tag: `result-${m.id}`,
      })
    }
  } else if (task === 'test') {
    results.test = await broadcast({
      title: 'BetUs 🏆',
      body: 'Les notifications fonctionnent !',
      url: '/BetUs/',
      tag: 'test',
    })
  } else {
    return new Response('unknown task', { status: 400 })
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  })
})
