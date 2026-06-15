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

// Roasts — vannes entre potes, travaillées, avec des clins d'œil à la commu (Chabbat,
// Kippour, Pessah, mazal, kiddouch…) façon auto-dérision affectueuse. Banter d'in-group :
// que du foot, du classement et de la vie de la commu — rien de méchant ni de physique.
const ROASTS = {
  // 0 point sur le match : il s'est planté sur toute la ligne
  zero: [
    'Zéro pointé. Même le jour de Kippour on a le droit de marquer un point — toi t\'as fait grève totale. 🕯️',
    'Ta grille, c\'est le ménage de Pessah : tu jures avoir tout couvert, en vrai il reste du \'hametz dans tous les coins. 🧹',
    'Rien, nada, walou. T\'as pronostiqué avec l\'élégance d\'un schlemiel qui fait tomber sa tartine côté beurre. 🍞',
    'Zéro point, zéro mazal. À ce stade c\'est plus la poisse, c\'est carrément un mauvais œil — sors le hamsa. 🧿',
    '0/6. T\'as bossé tes compos comme certains bossent la paracha : de loin, vite fait, en pensant au repas. 📖',
    'Un zéro grand comme la table d\'un soir de Chabbat. Impressionnant de vide. 🍽️',
  ],
  // a reculé au classement
  dropped: [
    'Tu dégringoles plus vite que la maison se vide une fois le dernier plat de Chabbat servi. 🏃',
    'Tu chutes façon soufflé de ta tante : magnifique deux secondes, puis ça s\'effondre dès qu\'on ouvre le four. 🥘',
    'Encore un rang de perdu. À ce rythme tu sors du classement avant même le birkat. 🪑',
    'Tu recules, tu recules… on dirait la queue au supermarché casher la veille de Roch Hachana. 🛒',
    'En pleine glissade. Garde un peu de dignité, là c\'est balagan complet. 🌀',
  ],
  // bon dernier au général
  last: [
    'Bon dernier. Comme à la synagogue, y\'en a toujours un qui ferme la marche — et c\'est encore toi. 🚪',
    'Lanterne rouge. Tes 30 balles, vois ça comme un don à la cagnotte des autres : au moins ça te fait une mitsva. 😇',
    'Dernier du classement avec le niveau d\'un invité qui débarque à un dîner de gala avec une bouteille à 3 €. 🍷',
    'Tout en bas du tableau. T\'es le nebech officiel de la compét, et ça se joue pas à grand-chose : personne d\'autre n\'en veut. 🎖️',
  ],
  // gros score : éloge ironique « t'es un tigre »
  fire: [
    'Énorme score. On dirait que t\'as récité le bon mizmor avant le match — t\'es béni là, profite. 🙏',
    'Carton plein. Savoure ton quart d\'heure de gloire, demain tu redeviens le nebech qu\'on connaît. ✨',
    'Gros match. Le talent ou un coup de mazal du Ciel ? Vu ton niveau habituel, on parie tous sur le Ciel. 🍀',
    'T\'es un tigre la vérité. Encadre la notif, ça reviendra pas avant la sortie d\'Égypte. 🐯',
  ],
  // n'a pas pronostiqué ce match
  noshow: [
    'T\'as zappé ce match. Aux abonnés absents, comme à l\'office du vendredi soir quand y\'a un gros match à la télé. 📺',
    'Zéro prono. Toujours présent pour le kiddouch, jamais pour le boulot, hein. 🍷',
    'Pas de prono de ta part. T\'es venu jouer ou juste pour le buffet ? 🥗',
    'Match zappé. T\'arrives toujours au moment du dessert, jamais pour mettre la table. 🍰',
  ],
}
const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)]

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

async function sendToSub(
  s: { endpoint: string; p256dh: string; auth: string },
  payload: Payload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(payload),
    )
    return true
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode
    if (code === 404 || code === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    } else {
      console.error('push error', code, s.endpoint.slice(0, 60))
    }
    return false
  }
}

async function broadcast(payload: Payload): Promise<number> {
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return 0
  const results = await Promise.all(subs.map((s) => sendToSub(s, payload)))
  return results.filter(Boolean).length
}

/** Envoi personnalisé : une fonction construit le payload par utilisateur (null = on saute). */
async function broadcastPerUser(build: (userId: string) => Payload | null): Promise<number> {
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return 0
  const results = await Promise.all(
    subs.map((s) => {
      const payload = build(s.user_id)
      return payload ? sendToSub(s, payload) : Promise.resolve(false)
    }),
  )
  return results.filter(Boolean).length
}

/** Envoi ciblé à un ensemble d'utilisateurs (ex. ceux qui ont pronostiqué le match). */
async function broadcastToUsers(userIds: Set<string>, payload: Payload): Promise<number> {
  if (!userIds.size) return 0
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return 0
  const targets = subs.filter((s) => userIds.has(s.user_id))
  const results = await Promise.all(targets.map((s) => sendToSub(s, payload)))
  return results.filter(Boolean).length
}

/** Réserve l'envoi (kind, match_id) ; false si déjà envoyé. */
async function claim(kind: string, matchId: number): Promise<boolean> {
  const { error } = await supabase.from('push_log').insert({ kind, match_id: matchId })
  return !error
}

/** Les utilisateurs ayant pronostiqué ce match (audience naturelle du salon). */
async function predictorIds(matchId: number): Promise<Set<string>> {
  const { data } = await supabase.from('predictions').select('user_id').eq('match_id', matchId)
  return new Set((data ?? []).map((r) => r.user_id as string))
}

// --- Tâches périodiques (appelées par pg_cron via `tick`) ---

async function runReminders(out: Record<string, number>): Promise<void> {
  const { data: due } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'scheduled')
    .gt('kickoff_at', new Date().toISOString())
    .lte('kickoff_at', new Date(Date.now() + 62 * 60_000).toISOString())
  for (const m of due ?? []) {
    if (!(await claim('reminder', m.id))) continue
    out[`reminder_${m.id}`] = await broadcast({
      title: `⚽️ ${team(m.home_team, m.home_code)} – ${team(m.away_team, m.away_code)} dans 1 h`,
      body: 'Envoie ton prono avant le coup d’envoi !',
      url: `/BetUs/#/match/${m.id}`,
      tag: `reminder-${m.id}`,
    })
  }
}

/** Au coup d'envoi : on invite les pronostiqueurs à rejoindre le salon. */
async function runKickoff(out: Record<string, number>): Promise<void> {
  const now = Date.now()
  const { data: started } = await supabase
    .from('matches')
    .select('*')
    .neq('status', 'finished')
    .gte('kickoff_at', new Date(now - 6 * 60_000).toISOString())
    .lte('kickoff_at', new Date(now).toISOString())
  for (const m of started ?? []) {
    if (!(await claim('kickoff', m.id))) continue
    out[`kickoff_${m.id}`] = await broadcastToUsers(await predictorIds(m.id), {
      title: `🟢 Coup d'envoi ! ${team(m.home_team, m.home_code)} – ${team(m.away_team, m.away_code)}`,
      body: 'Le salon est ouvert — viens réagir en direct avec les copains 💬',
      url: `/BetUs/#/match/${m.id}/chat`,
      tag: `kickoff-${m.id}`,
    })
  }
}

/** En cours de match : si le salon s'anime, on prévient ceux qui ne sont pas (encore) venus. */
async function runSalon(out: Record<string, number>): Promise<void> {
  const now = Date.now()
  const { data: live } = await supabase
    .from('matches')
    .select('*')
    .neq('status', 'finished')
    .gte('kickoff_at', new Date(now - 110 * 60_000).toISOString())
    .lte('kickoff_at', new Date(now - 15 * 60_000).toISOString())
  for (const m of live ?? []) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', m.id)
    if ((count ?? 0) < 3) continue // on n'anime que les salons déjà vivants
    if (!(await claim('salon', m.id))) continue
    out[`salon_${m.id}`] = await broadcastToUsers(await predictorIds(m.id), {
      title: `🔥 Ça chauffe ! ${team(m.home_team, m.home_code)} – ${team(m.away_team, m.away_code)}`,
      body: 'Le salon s’enflamme, rejoins la discussion 💬',
      url: `/BetUs/#/match/${m.id}/chat`,
      tag: `salon-${m.id}`,
    })
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const task = body.task as string
  const results: Record<string, number> = {}

  if (task === 'tick') {
    // Tick périodique (pg_cron toutes les 5 min) : rappels + coup d'envoi + animation salon
    await runReminders(results)
    await runKickoff(results)
    await runSalon(results)
  } else if (task === 'reminders') {
    await runReminders(results)
  } else if (task === 'result') {
    const matchId = Number(body.match_id)
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).single()
    if (m && (await claim('result', m.id))) {
      const title = `🔔 ${team(m.home_team, m.home_code)} ${m.home_score} – ${m.away_score} ${team(m.away_team, m.away_code)}`
      const url = `/BetUs/#/match/${m.id}`

      // Rangs avant (snapshot) vs après (classement courant) + points de CE match par joueur
      const [{ data: before }, { data: after }, { data: mp }] = await Promise.all([
        supabase.from('rank_snapshot').select('user_id, rank'),
        supabase.from('ranked_leaderboard').select('user_id, rank, total_points, display_name'),
        supabase
          .from('match_points')
          .select('user_id, winner_pts, scorer_pts, assister_pts, exact_pts')
          .eq('match_id', m.id),
      ])
      const prevRank = new Map((before ?? []).map((r) => [r.user_id, r.rank]))
      const cur = new Map((after ?? []).map((r) => [r.user_id, r]))
      const rows = [...cur.values()]
      const lastRank = rows.length ? Math.max(...rows.map((r) => r.rank)) : 0
      // points marqués sur ce match ; absent de la map = n'a pas pronostiqué
      const matchPts = new Map(
        (mp ?? []).map((r) => [
          r.user_id,
          r.winner_pts + r.scorer_pts + r.assister_pts + r.exact_pts,
        ]),
      )

      // "Léa", "Léa et Max", "Léa, Max et 2 autres"
      const nameList = (arr: { display_name: string }[]): string => {
        const n = arr.map((r) => r.display_name)
        if (n.length === 1) return n[0]
        if (n.length === 2) return `${n[0]} et ${n[1]}`
        return `${n[0]}, ${n[1]} et ${n.length - 2} autre${n.length - 2 > 1 ? 's' : ''}`
      }

      results[`match_${m.id}`] = await broadcastPerUser((userId) => {
        const c = cur.get(userId)
        if (!c) return null
        const prev = prevRank.get(userId)
        const pts = matchPts.get(userId) // undefined = n'a pas pronostiqué ce match
        let body: string
        if (pts === undefined) {
          // Pas de prono sur ce match → petite vanne d'absent
          body = pick(ROASTS.noshow)
        } else if (pts === 0) {
          // Tout faux sur le match → roast cru, peu importe le classement
          body = pick(ROASTS.zero)
        } else if (prev && c.rank < prev) {
          // Monté : qui ai-je doublé ? (était au-dessus avant, en-dessous maintenant)
          const passed = rows
            .filter((o) => o.user_id !== userId && (prevRank.get(o.user_id) ?? 1e9) < prev && o.rank > c.rank)
            .sort((a, b) => a.rank - b.rank)
          body = passed.length
            ? `🔼 Tu doubles ${nameList(passed)} — te voilà ${c.rank}e !`
            : `🔼 Tu remontes ${prev}e → ${c.rank}e au classement !`
        } else if (prev && c.rank > prev) {
          // Descendu → roast cru sur la chute
          body = pick(ROASTS.dropped)
        } else if (c.rank === lastRank && lastRank > 1) {
          // Bon dernier → roast lanterne rouge
          body = pick(ROASTS.last)
        } else if (prev && prev === c.rank && c.rank === 1) {
          body = '👑 Toujours en tête du classement !'
        } else if (pts >= 8) {
          // Gros score sur le match → éloge ironique
          body = pick(ROASTS.fire)
        } else {
          body = 'Résultat saisi, classement mis à jour — viens voir tes points.'
        }
        return { title, body, url, tag: `result-${m.id}` }
      })

      // Met à jour le snapshot pour le prochain résultat
      if (after?.length) {
        await supabase.from('rank_snapshot').upsert(
          after.map((r) => ({ user_id: r.user_id, rank: r.rank, total_points: r.total_points })),
        )
      }
    }
  } else if (task === 'direct') {
    // Envoi personnalisé : liste {user_id, title, body, url, tag} (appelée par livescore)
    const items = (body.items ?? []) as Array<Payload & { user_id: string }>
    const { data: subs } = await supabase.from('push_subscriptions').select('*')
    const byUser = new Map<string, typeof subs>()
    for (const s of subs ?? []) {
      const arr = byUser.get(s.user_id) ?? []
      arr.push(s)
      byUser.set(s.user_id, arr)
    }
    let sent = 0
    await Promise.all(
      items.flatMap((it) =>
        (byUser.get(it.user_id) ?? []).map((s) =>
          sendToSub(s, { title: it.title, body: it.body, url: it.url, tag: it.tag }).then((ok) => {
            if (ok) sent++
          }),
        ),
      ),
    )
    results.direct = sent
  } else if (task === 'roast') {
    // Roast à la demande : vanne chaque joueur selon sa place au classement général.
    // Le dernier prend cher, le 1er se fait charrier ironiquement, le reste a une vanne.
    const { data: ranked } = await supabase
      .from('ranked_leaderboard')
      .select('user_id, rank, display_name')
    const byUser = new Map((ranked ?? []).map((r) => [r.user_id, r]))
    const lastRank = ranked?.length ? Math.max(...ranked.map((r) => r.rank)) : 0
    results.roast = await broadcastPerUser((userId) => {
      const r = byUser.get(userId)
      if (!r) return null
      let bodyTxt: string
      if (r.rank === 1) bodyTxt = pick(ROASTS.fire)
      else if (r.rank === lastRank && lastRank > 1) bodyTxt = pick(ROASTS.last)
      else bodyTxt = pick(ROASTS.dropped)
      return { title: '🔥 Petit point classement', body: bodyTxt, url: '/BetUs/#/classement', tag: 'roast' }
    })
  } else if (task === 'lineup') {
    // Compo officielle publiée (appelée par livescore dès qu'elle sort) → tout le groupe.
    const matchId = Number(body.match_id)
    if (await claim('lineup', matchId)) {
      results.lineup = await broadcast({
        title: String(body.title ?? '📋 Compo officielle'),
        body: String(body.body ?? 'La composition vient de tomber.'),
        url: String(body.url ?? `/BetUs/#/match/${matchId}`),
        tag: `lineup-${matchId}`,
      })
    }
  } else if (task === 'announce') {
    // Annonce libre à tout le monde (titre/corps personnalisés)
    results.announce = await broadcast({
      title: String(body.title ?? 'BetUs 🏆'),
      body: String(body.body ?? ''),
      url: String(body.url ?? '/BetUs/'),
      tag: 'announce',
    })
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
