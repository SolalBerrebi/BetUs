# Live Score Research — 2026 FIFA World Cup (free APIs)

**Need:** LIVE scoreline only (home/away goals + match status). No goalscorer names. Up to 8 simultaneous group-stage matches. Tournament: June 11 – July 19, 2026.

**Bottom line:** football-data.org's **free** tier does NOT serve live scores — it's delayed/next-day only. Live in-play scores on football-data.org require the paid €12/mo "Free w/ Livescores" plan. For free live scores, use **API-Football (api-sports.io)** instead.

---

## 1. football-data.org — detailed findings

### Q1. Free tier + World Cup (code WC)
- **Yes**, the FIFA World Cup IS one of the 12 free competitions. Competition code is **`WC`**. The 2026 season is covered on free (coverage page lists "World Cup" / "Worldcup" under the free tier).
- Endpoint: `GET /v4/competitions/WC/matches`.

### Q2. Live / in-play scores on free?
- **NO.** The free tier explicitly serves **delayed scores and schedules**. Live (in-play) scores are **paid-only**, starting at the €12/mo "Free w/ Livescores" tier.
- The API does expose the `status` machine (`SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, SUSPENDED, POSTPONED, CANCELLED, AWARDED`) and a `LIVE` pseudo-status filter (`IN_PLAY` + `PAUSED`) — but on **free**, the underlying score/status data is delayed, not real-time. No exact free-tier delay figure is published; vendor describes it as suitable only for "next-day reporting," not live apps.
- Conclusion: **unusable for our live-scoreline need on the free token.**

### Q3. Score + status fields (JSON shape)
```json
{
  "id": 330299,
  "utcDate": "2022-02-27T16:05:00Z",
  "status": "FINISHED",
  "homeTeam": { "id": 531, "name": "ES Troyes AC" },
  "awayTeam": { "id": 516, "name": "Olympique de Marseille" },
  "score": {
    "winner": "DRAW",
    "duration": "REGULAR",
    "fullTime": { "home": 1, "away": 1 },
    "halfTime": { "home": 0, "away": 1 }
  }
}
```
- Scoreline: `score.fullTime.home` / `score.fullTime.away` (running score during play). Half-time: `score.halfTime.*`. Status: `status`.

### Q4. Rate limits + auth (free)
- **10 requests / minute** on registered free tier. No documented daily cap (only the per-minute limit).
- Auth: HTTP header **`X-Auth-Token: <your_token>`**.

### Q5. Free API key signup
- Register at **https://www.football-data.org/client/register** — email signup, token issued instantly.

### Q6. Match identity / mapping to internal 1..104
- Each match has a stable integer **`id`**, plus **`utcDate`** (kickoff) and **`homeTeam.name` / `awayTeam.name`** (and team `id`s). That's enough to map their fixtures to our internal match number 1..104 by date + teams, and to cache the stable `id` per match.

---

## 2. Fallback comparison (same need: free live scoreline)

### API-Football — api-sports.io  ✅ recommended free option
- **Live scores on free: YES.** Real-time fixtures/events are updated **every ~15 seconds on ALL plans, including free.**
- Endpoint: `GET /fixtures?live=all` (or filter by league/date). Returns `goals.home` / `goals.away`, `fixture.status.short` (`1H`,`HT`,`2H`,`LIVE`,`FT`...), `fixture.id`, `fixture.date`, team names/ids. World Cup is covered.
- **Caveat: hard daily cap of 100 requests/day** on free (resets 00:00 UTC, unused lost). Vendor guidance: ~1 call/min while a fixture is in progress. Auth header `x-apisports-key` (direct) or `x-rapidapi-key` (via RapidAPI). Signup: https://dashboard.api-football.com/register (or api-sports.io).

### TheSportsDB — free  ❌ not viable for live
- **Livescore endpoint (V2 `/livescore`) is PAID-ONLY** ($9/mo supporters; ~2-min livescores). The free/test key does **not** include livescores — it's limited to lookup/search.
- Free rate limit ~30 req/min, but irrelevant since live scores aren't on free.

---

## Recommendation

Use **API-Football (api-sports.io) free tier** for live scorelines. It's the only one of the three giving real-time (~15s) live scores for free. The constraint is the **100 requests/day** cap, which dictates polling cadence (see budget below). football-data.org free is the better choice ONLY if a live feed is not required (it's delayed); TheSportsDB free has no livescore at all.

### Polling budget under 100 req/day (API-Football)
- `fixtures?live=all` returns **all in-progress matches in ONE call**, regardless of how many (so 8 simultaneous group matches = still 1 request per poll).
- Group stage match windows are roughly 2.5h. To stay safely under 100/day, poll **every ~60 seconds only while ≥1 match is live** (idle otherwise). Example: 2 daily match windows × ~3h each = ~360 min of live time ÷ 1/min ≈ would exceed 100; so use **~90–120s cadence during live windows** (≈ 30–48 calls per 3h window) to keep total/day under 100. Effective latency to user: ~90–120s + the API's 15s internal refresh.
- If higher cadence is wanted, the API-Football paid Pro tier (or football-data.org €12 livescores) removes the cap.
