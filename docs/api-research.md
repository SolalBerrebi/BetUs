# Free Football Data APIs for Auto-Filling WC 2026 Results

**Goal:** auto-fill final score + goalscorers (+ live status) for FIFA World Cup 2026
(June 11 – July 19, 2026) to cut manual admin entry in the betting app.
**Constraint:** free tier only. Assists stay manual. Researched June 10, 2026.

---

## Comparison

| API | WC 2026 coverage | Goalscorers on FREE tier | Live or post-match | Rate limit (free) | Auth | Key gotchas |
|---|---|---|---|---|---|---|
| **API-Football** (api-sports.io) | **Yes** — league `id=1`, season `2026`, all 104 fixtures | **Yes** — `/fixtures/events?type=goal` returns scorer names; every endpoint open on free | **Live** — events update every ~15s | **100 req/day** (resets 00:00 UTC) | `x-apisports-key` header | 100/day is the real constraint; scorer availability "may vary match-to-match early in tournament"; goal sub-types incl. Own Goal / VAR |
| **football-data.org** | **Yes** (competition is in the 12 free comps) | **No (effectively)** — per-match `goals[]` array and "Goal scorers" feature sit behind paid **Deep Data €29/mo**; free per-match goals come back empty. Aggregate top-scorers endpoint reported free but that is tournament totals, not per-match | **Delayed** (free tier scores + schedules are delayed; live needs "Free w/ Livescores"/paid) | **10 req/min** | `X-Auth-Token` header | Score + fixtures are free and clean, but **scorer names are not usable for free** — this is the disqualifier for our use case |
| **TheSportsDB** | Unclear/partial — has a FIFA World Cup league page, but no confirmed per-match goal-event coverage for 2026 | **Unreliable** — `lookuptimeline` exists but free-tier scorer timeline coverage for live international matches is not guaranteed; single-result limit on free lookups | Livescore endpoints exist but **2-min livescores are premium ($9/mo)**; free is slower/post-match | **30 req/min** (test key `123` / `3`) | API key in URL path | Crowd/volunteer-sourced data → spelling and completeness inconsistent; timeline often lags or is missing for less-covered matches |
| **Sportmonks (free plan)** | **No** — free plan is **only Danish Superliga + Scottish Premiership** | n/a | live (but irrelevant) | — | API token | WC is paid-only; free plan is a demo. **Ruled out.** |

---

## Recommendation: **API-Football (api-sports.io), free plan**

It is the only genuinely free option that gives **WC 2026 + per-match goalscorer names + live status** in one place. football-data.org is free and reliable for *scores* but its goalscorer data is paid, which kills it for our requirement (score **and** scorers). TheSportsDB is free but its scorer data quality/latency is too unreliable to drive auto-scoring. Sportmonks free doesn't cover the WC at all.

### Polling within 100 req/day

- Group stage peak: up to **8 matches/day**, then fewer in knockouts.
- Pull the day's fixtures once (`/fixtures?league=1&season=2026&date=YYYY-MM-DD`) = ~1 req.
- During live windows, poll only **in-progress fixtures**: 1 batched `/fixtures` call returns all live matches' scores/status, and you only hit `/fixtures/events?fixture=ID` per match when its score changes or it finishes.
- Suggested cadence: poll live status every **~10 minutes** while matches are live (90+ min window → ~10–12 status calls/day), and fetch events for a match **once at FT** (8 calls) plus on detected score changes. Realistic peak ≈ **40–60 req/day** — comfortably under 100. Avoid blind per-minute polling; gate event calls on score/status deltas.
- Safest pattern: a single post-match sweep at FT (status `FT`) pulls final score + full goal list in ~2 calls/match (~16/day) if you don't need live in-app.

### Mapping scorer names to the fuzzy matcher

- API-Football returns the scorer in `events[].player.name` (and `player.id`). Use the **`type=Goal`** filter; each event has a `detail` field: `Normal Goal`, `Own Goal`, `Penalty`, `Missed Penalty`.
- Player names are typically "Given Surname" or a single common name (e.g. `K. Mbappé`, `Vinícius Júnior`, `Son Heung-Min`). Our matcher keys on **surname, accent-insensitive** — normalize (NFD strip diacritics, lowercase, take last token / or full string fallback) before matching. Keep `player.id` as a stable secondary key so re-runs are idempotent even if the display name string changes.

---

## Reliability of goalscorer NAMES (scoring-critical)

- **Format inconsistency:** API-Football uses abbreviated givens (`K. Mbappé`) and varying transliteration for non-Latin names (Korean/Arabic/Japanese squads). Accent-insensitive **surname** matching is the right call; also handle hyphenated and two-part surnames (Heung-Min, De Bruyne). Always carry `player.id` alongside the name.
- **Own goals (high risk):** an Own Goal credits the *opponent's* scoreline but the `player` is the defender who scored into his own net. If auto-fill naively attributes the goal to that player for our scorers market, it will mis-score. **Filter/branch on `detail == "Own Goal"`** and route to manual review — do not auto-credit.
- **VAR / disallowed goals (high risk):** goals can be added then **removed** after VAR. Events can change up to and shortly after FT. Mitigation: **do not finalize on live data** — only commit scorers when fixture `status == FT` (or `AET`/`PEN`), and re-fetch events once at FT to overwrite any provisional live entries. VAR events exist in the feed but reversals mean live state is provisional by nature.
- **Early-tournament caveat:** API-Football itself notes coverage flags are `true` but per-match availability "may vary, especially early in the tournament" — keep a manual-override path for the first matchdays.

**Net correctness posture:** auto-fill from API-Football at **FT only**, treat Own Goal and any VAR-flagged event as manual-review, keep human override always available. This realizes most of the admin-time savings while containing the two known correctness risks.

---

## Sources

- football-data.org — [Coverage](https://www.football-data.org/coverage), [Pricing](https://www.football-data.org/pricing), [Match resource docs](https://docs.football-data.org/general/v4/match.html), [API reference](https://www.football-data.org/documentation/api)
- [TheStatsAPI — football-data.org Free Tier Limits 2026](https://www.thestatsapi.com/blog/football-data-org-free-tier-limits-2026)
- API-Football — [Coverage](https://www.api-football.com/coverage), [WC 2026 guide](https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports), [Docs v3](https://www.api-football.com/documentation-v3), [Getting started](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide), [Leagues/Teams IDs](https://www.api-football.com/news/post/leagues-teams-ids)
- [TheSportsDB — Free API](https://www.thesportsdb.com/free_sports_api), [Documentation](https://www.thesportsdb.com/documentation), [FIFA World Cup league page](https://www.thesportsdb.com/league/4429-fifa-world-cup)
- Sportmonks — [Free Plan](https://www.sportmonks.com/football-api/free-plan/), [Plans & Pricing](https://www.sportmonks.com/football-api/plans-pricing/), [Free vs Paid](https://www.sportmonks.com/blogs/free-vs-paid-football-apis-choosing-the-right-option-for-your-project/)
