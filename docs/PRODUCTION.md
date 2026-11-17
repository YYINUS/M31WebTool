# Taking the GP Daily Brief to production

**For:** Jen, or a Claude session working in `YYINUS/YIm31-paradigm-dashboard`.
**Status:** Nov 17, 2026.

## Where things stand

The approved GP Daily Brief (`gp-brief/` on branch `feat/gp-daily-brief` of the dashboard repo) now also runs as a standalone site:

- **Site:** https://yyinus.github.io/M31WebTool/ (Daily Brief, Fringe Foundation Weekly, home page, all in the M31 design)
- **Code:** https://github.com/YYINUS/M31WebTool, folder `gp-brief/` (a copy of the dashboard's `gp-brief/`, plus the fixes below)
- **Reference issue:** https://yyinus.github.io/M31WebTool/daily/2026-11-16.html. This is the approved Nov 16 partner copy, unchanged except for an "Updated" time, a Refresh button and archive links.

Running it outside the dashboard surfaced fixes that the dashboard branch needs before going live. The production target is still the one in `gp-brief/HANDOFF.md`: Vercel cron, Supabase `gp_briefs`, the `/brief` pages and Slack delivery (Steps 3–7).

## 1. Port these changes into the dashboard's `gp-brief/`

Compare each file with https://github.com/YYINUS/M31WebTool/tree/main/gp-brief.

| File | Change | Why |
|---|---|---|
| `llm.mjs` | **Must port.** No `temperature`; streams the response (SSE); throws on `stop_reason: refusal` or `max_tokens`; optional `GP_BRIEF_JUDGE_MODEL` (the HANDOFF's suggestion). Copy the file as is. | Claude Sonnet 5.5 rejects non-default sampling values with a **400**. The current branch sends `temperature: 0.3` (writer) and `0` (judge), so every live run would fail. It never showed up because all sample issues ran in manual mode. Streaming also stops long thinking plus a large JSON brief from timing out. |
| `run.mjs` | Judge call uses `judge: true` instead of `temperature: 0`; writer uses the client's larger default `max_tokens` instead of 16000; records `collectedAt` when news is gathered and passes it as `meta.generatedAt`; top-level error handler doesn't echo model output (`SyntaxError` → generic message). | The first change goes with `llm.mjs`. The timestamp feeds the "Updated" line. Safe logs matter because Vercel and CI logs are wider-read than the brief. |
| `collect.mjs` | 400 ms pause between Google News queries, and up to 2 retries with backoff on HTTP 429; failure log prints counts by type, not query text. | This was **Step 1, tested live** from a cloud container. 3 query groups gave 271 items in 11 s, but with 429s. After pacing, ~50 queries gave 472 items with one 429 in about 2 minutes. A full run (~145 queries) should take about 6 minutes; check it fits `maxDuration`. |
| `llm.mjs` (speed) | `output_config.effort` configurable (`GP_BRIEF_EFFORT`, `GP_BRIEF_JUDGE_EFFORT`, default `high`; a live run at medium was held); system prompt and news pool sent as cacheable blocks (`cache_control: ephemeral`). | Faster, cheaper drafts and reviews. Revisions and repeat reviews read the large shared prefix from cache, at about a tenth of the price. |
| `collect.mjs` (pool size) | `trimPool`: keep every portfolio item, each sector's 10 best-covered items, then the most widely covered, up to 400 (`GP_BRIEF_MAX_POOL`). | First live run: 1,191 items → the writer filled every section (26 stories, 9-min read, 13 check failures) and all 3 drafts were held. |
| `collect.mjs` (speed) | 4 queries in parallel (`GP_BRIEF_COLLECT_LANES`), each lane keeping the Google pause. | ~50 queries went from 122 s to 35 s with the same items (481) and one 429. |
| `collect.mjs` (summaries) | Google News `<description>` is escaped HTML (`&lt;a href=…`); it was stored as the item summary. Now decoded and dropped when it only repeats the headline. | ~65% fewer pool tokens in every writer and judge call, and no link noise in the pool. |
| `checks.mjs`, `prompts.mjs` (length) | At most 18 stories in total (new check); exact character limits stated in the writer prompt; talk of the day = the 6 most widely covered events (was: every event at 5+ outlets). **The last one changes an approved gate — please confirm.** | Live runs: drafts at 20–24 stories and 8–10 minutes; most failures were over-long fields and widely covered events left out, because a ~1,200-item pool has dozens of 5-outlet events. |
| `prompts.mjs` | "M31 Thesis entries carry NO action". `draftUser` / `judgeUser` return `{ cached, rest }` with the news pool first, so it can be cached; `run.mjs` builds the revise call the same way. | Matches the approved partner sample for Nov 16, which has 6 actions and none on Thesis entries. The branch's draft had 9. |
| `render-html.mjs` | (a) "Updated <weekday, date> · <time> ET" in the masthead and on the date line, from `meta.generatedAt`. (b) `actionRows()` exported, and the What next list uses `st.actionWho` when present. (c) Optional `nav` (prev / all / next, Refresh); nothing changes when `nav` is not passed. | (a) Partners asked for it: a 6 am brief doesn't reflect 4 pm news. (b) Lets a brief be re-rendered later without the portfolio file. (c) Used by the standalone site only. |

**Do not copy these**. They exist only because the standalone repo is public.

- `portfolio.mjs`: it's a loader that reads `PORTFOLIO_JSON`. The dashboard keeps its real file.
- `public.mjs`, `render-site.mjs`: GitHub Pages publishing.
- The neutral placeholders in the `prompts.mjs` examples (`<company>`): keep the dashboard's originals if you prefer.

After porting, run the three offline tests on the branch; all must still say "all passing":

```bash
node gp-brief/test/smoke.mjs && node gp-brief/test/collect.mjs && node gp-brief/test/loop.mjs
```

`test/loop.mjs` mocks the Anthropic API. If its mock checks for `temperature` or a non-streaming response, update the mock to answer with server-sent events (`content_block_delta` / `text_delta`, then `message_delta` with `stop_reason: end_turn`).

## 2. Decisions since the handoff

- **"What next" is not treated as sensitive.** The owner decided the actions can be shown to everyone who sees the brief, collapsed behind the What next button as in the approved design. The handoff's admin-only gate (Step 5, `html_partner` vs `html_share`) is therefore optional. Jen decides whether to keep it in the dashboard.
- **Timestamps.** Every edition shows when its news was gathered, in Eastern Time.
- **Manual refresh, on the page.** Partners want to refresh a brief during the day without leaving the site, and nobody should wait on a blank page. In the dashboard: a Refresh button on `/brief` that calls the cron route server-side (with `CRON_SECRET`), keeps showing the current edition, and swaps in the new row of `gp_briefs` when the run finishes. The standalone site does the same through a small relay (`worker/refresh-worker.js`) that starts the GitHub workflow.
- **Thesis entries carry no action** (see `prompts.mjs` above).

## 2a. Publishing rule changed (owner's decision, Nov 17)

Pass mark lowered from 4.0 (floor 3, must "open tomorrow") to **3.5 (floor 2)**, and **no more HOLD**: after three drafts the best one is published (fewest check failures, then highest score), with its review score in small print. In four live runs on Nov 17, no draft reached 4.0 (scores 2.4–3.2, mostly "would open tomorrow"). Revisit the bar with partner feedback in shadow mode.

## 2b. New since: Weekly Brief and Raw Feed

- **Weekly Brief** (Fridays ~3 pm ET): `run.mjs --weekly` uses the same pipeline with `WEEKLY_ADDENDUM` / `WEEKLY_JUDGE_ADDENDUM` (`prompts.mjs`), weekly checks (7-day freshness, ≤ 22 stories, ≤ 12 min, a dated and sourced `weekAhead`) and the same renderer (`weekly` option: "Weekly Brief", "Top 3 this week", a Week ahead section). `collect-cli.mjs --weekly` collects 7 days and merges the week's stored raw feed. In the dashboard: a second cron (Fridays) and a `/brief/weekly` page.
- **Raw Feed**: `collect-cli.mjs` also writes everything collected (`feed.json`); `feed-merge.mjs` keeps a per-day file. The dashboard already has a Raw Feed tab in News Digest (it showed "Error: Failed: 504" on Nov 17); the GP brief's collection could feed it.

## 3. Then follow HANDOFF.md Steps 2–7

1. **Step 2, live loop:** `ANTHROPIC_API_KEY=... GP_BRIEF_MODEL=claude-sonnet-5-5 node gp-brief/run.mjs --date $(date -u +%F)`. Read `quality-report.html`. No live writer and judge run has completed anywhere yet, so this is the first real test.
2. **Step 3:** cron route `app/api/cron/gp-brief/route.ts`, modeled on the digest cron. `maxDuration = 800`; collection takes about 6 minutes, then up to 3 drafts and 3 reviews.
3. **Step 4:** `gp_briefs` table (SQL in HANDOFF.md). Store `meta.generatedAt` too.
4. **Step 5:** `/brief` and `/brief/[date]` pages. Add the Refresh button if wanted.
5. **Step 6:** Slack: RELEASE to the digest channel, HOLD to alerts.
6. **Step 7:** shadow mode for the first two weeks.
7. Open a PR from `feat/gp-daily-brief` to `master`. Per the repo's rules, don't push to `master` directly.

## Prompt for Claude Code (in the dashboard repo)

> Read `gp-brief/HANDOFF.md`, then https://github.com/YYINUS/M31WebTool/blob/main/docs/PRODUCTION.md. On branch `feat/gp-daily-brief`, port the changes in section 1 of PRODUCTION.md from https://github.com/YYINUS/M31WebTool/tree/main/gp-brief into `gp-brief/` (`llm.mjs`, `run.mjs`, `collect.mjs`, `prompts.mjs`, `render-html.mjs`). Don't copy `portfolio.mjs`, `public.mjs` or `render-site.mjs`. Run the three offline tests and fix any mock that assumed the old non-streaming client. Then do HANDOFF Step 2 (one live run) and show me the quality report before starting Steps 3–7. Open a PR to `master` when done; don't push to `master`.
