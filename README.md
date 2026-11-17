# M31 Research Briefs

Two briefs, published as a static site on GitHub Pages in M31's design (m31.capital: black masthead, cream ground, Instrument Serif headlines, Inter body):

- **M31 Daily Brief**: the GP Daily Brief, organized by purpose (Portfolio, M31 Thesis, Regulation, Tech & Funding, Macro & Markets, Frontier). The first screen has a headline, a bottom line and the Top 3 (30 seconds); the full read is about 5 minutes. Weekdays.
- **Fringe Foundation Weekly Signal**: a decision-first scan of frontier and anomalous claims. Each claim gets a label (Act / Watch / Pending / Critique / Context / Benchmark), an evidence stage from 1 to 5 and a follow-up plan. Each issue also has an email-safe inbox version and links to the coverage and sources page. Fridays.

## Layout

```
gp-brief/             the Daily Brief pipeline (Node ≥ 18, no dependencies)
  run.mjs             collect → draft → checks → GP review → revise (max 3) → render → RELEASE or HOLD
  collect.mjs, queries.mjs   news from Google News RSS (+ NewsAPI / GDELT if configured)
  prompts.mjs         writer, judge and revise prompts, and the 8-criterion rubric
  checks.mjs          deterministic hard gates and the pass rule
  render-html.mjs     the approved design (reference issue: data/daily/2026-11-16.json)
  render-site.mjs     renders every published brief into site/daily/
  public.mjs          strips "What next" actions: the only form of a brief that is published
  portfolio.mjs       loads the confidential portfolio from the PORTFOLIO_JSON secret
  taxonomy.mjs, thesis.mjs   M31 sectors and watchlists; M31's public theses (Substack)
generator/            the Fringe Weekly (Python + Anthropic SDK), its source pre-fetch, and the site build
templates/, static/   Fringe, inbox, coverage and home page templates and CSS
data/daily/           one published Daily Brief per weekday (no actions)
data/fringe/          one Fringe issue per week (+ notes/ with the research notes)
```

## Confidentiality — read before changing anything

This repository and its site are **public**.

- **The portfolio list and its internal context never go in the repo.** They live in the `PORTFOLIO_JSON` Actions secret and are sent only to the Anthropic API in the writer prompt.
- **"What next" actions are published** with each brief, collapsed behind the What next button, as in the approved partner copy. Drafts, GP reviews and the quality report stay in the runner's temp folder and are never committed or uploaded.
- **Logs print summaries only**, because Actions logs on a public repo are public: no query text (portfolio queries are company names), no check-failure text, no model output.
- The published brief names M31 companies (Portfolio section and What next). If that should not be public, keep the repo and Pages private instead (Pages for a private repo needs a paid GitHub plan).

## Setup (one time)

In the repo under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `PORTFOLIO_JSON` | The portfolio as one JSON array: `[{"name": "...", "aliases": ["..."], "sectorId": "ai", "context": "..."}]`. Update it whenever the portfolio tracker changes. Without it the brief runs with an empty Portfolio section. |

Optional variables or secrets: `GP_BRIEF_MODEL` (default `claude-sonnet-5-5`), `GP_BRIEF_JUDGE_MODEL` (default: same as the writer), `NEWSAPI_KEY`, `USE_GDELT=1`.

Then set *Settings → Pages → Source* to **GitHub Actions**. Scheduled runs only work on the default branch (`main`).

## Schedule, timestamps and refresh

Two workflows write new editions: **Daily Brief** (`daily.yml`) and **Fringe Weekly** (`fringe.yml`). Both call `reports.yml`, which builds and deploys the site (a push to `main` that changes content or design also rebuilds it).

| Report | When (UTC) | Covers |
|---|---|---|
| Daily Brief | Mon–Fri 11:41 (6:41 am ET in winter) | 48h of news (84h on Mondays); Portfolio and Frontier 7 days |
| Fringe Weekly | Fri 13:17 | the 7 days ending that day (Sat–Fri) |

**RELEASE or HOLD.** A brief is published only if it passes every hard gate in `checks.mjs` and the GP review: a weighted score of at least 4.0, no criterion below 3, and "would open tomorrow". After 3 drafts without a pass, the brief is **held**: nothing is published, and the run is marked failed so GitHub notifies you. To publish a held brief anyway, run the **Daily Brief** workflow by hand with the date and `publish_hold` ticked.

**Timestamps.** Each edition shows when its news was gathered, in Eastern Time ("Updated Tue, Nov 17 · 6:41 AM ET"), so a reader knows a 6 am brief does not reflect 4 pm news.

**Ready-made editions.** Nobody should wait for a brief, so editions are prepared ahead of time: by default a morning Daily Brief before 6 am ET and an afternoon edition, plus the Fringe Weekly on Fridays. Readers always open a finished, recent edition instantly, made by the full pipeline. The schedule runs on the relay's clock (Cloudflare Cron Triggers), because GitHub's own schedule fires late or not at all under load. The GitHub schedules in `daily.yml` and `fringe.yml` stay as a backup and skip themselves when an edition was made in the last 3 hours.

**Refresh, on the page.** Each brief has a **Refresh** button. Readers type the password and click **Refresh now**. The panel then shows the step the run is on (gathering news → writing and reviewing → publishing) and keeps the current edition on screen. When the new edition is published, the page opens it. A same-day Daily Brief is replaced by the newer edition. The button talks to a small relay, a free Cloudflare Worker (`worker/refresh-worker.js`), because a static page cannot start a run without exposing a token. The relay holds the GitHub token, checks the password, allows one run at a time and at most one every 15 minutes, and also runs the edition schedule. Until the relay is configured, the button is hidden.

Setting up the relay (about 10 minutes, once):

1. **GitHub token.** github.com → your avatar → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Repository access: *Only select repositories* → `M31WebTool`. Permissions: *Actions: Read and write*. Copy the token.
2. **Worker.** dash.cloudflare.com (free account) → Workers & Pages → Create → Create Worker → name it `m31-refresh` → Deploy → Edit code → replace everything with the contents of `worker/refresh-worker.js` → Deploy.
3. **Worker settings.** The Worker → Settings → Variables and Secrets → add: `GITHUB_TOKEN` (type *Secret*, the token), `REFRESH_PASSWORD` (*Secret*, e.g. `M31`), `REPO` = `YYINUS/M31WebTool`, `ALLOWED_ORIGIN` = `https://yyinus.github.io`. Deploy.
4. **Edition schedule.** The Worker → Settings → Trigger events (Cron Triggers) → add, in UTC: `15 10 * * 1-5` (morning edition), `15 19 * * 1-5` (afternoon edition) and `17 13 * * 5` (Fringe Weekly). Add or remove editions here; each costs one run.
5. **Tell the site.** Copy the Worker's address (`https://m31-refresh.<your-subdomain>.workers.dev`). In the GitHub repo: Settings → Secrets and variables → Actions → *Variables* tab → New repository variable `REFRESH_ENDPOINT` = that address. The next run rebuilds the pages with the button.

**Speed and cost.** A Daily Brief run takes about 5–8 minutes, shown on the site as three steps. News collection runs 4 queries at a time (about 1–2 minutes for ~145 queries). The writer and the GP review run at *medium* thinking effort (set `GP_BRIEF_EFFORT` / `GP_BRIEF_JUDGE_EFFORT` = `high` as Actions variables to trade speed for depth). The system prompt and the news pool are prompt-cached, so a revision or a second review reads them at about a tenth of the token price. Readers never wait for a run: the site always shows the last finished edition, and a refresh swaps in the new one.

**Fringe sources.** Before its research pass, the Fringe Weekly pulls its standing sources in code for the issue's window: every arXiv paper in physics.gen-ph plus topic-matched papers in astro-ph, gr-qc, hep-ph, nucl-ex/th, quant-ph and q-bio.NC; Retraction Watch; PsyArXiv (psi and consciousness terms); the Journal of Scientific Exploration; and NASA's Technical Reports Server (`generator/sources.py`). Web search is then spent on what those don't cover (Journal of Parapsychology, PubPeer, LENR programs, SETI and UAP sources, journalism).

## Run locally

```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export ANTHROPIC_API_KEY=...                 # never commit it
cp /path/to/portfolio.json gp-brief/portfolio.local.json   # git-ignored; or export PORTFOLIO_JSON
node gp-brief/run.mjs --date 2026-11-17 --work /tmp/gpb   # Daily Brief; partner copy at /tmp/gpb/brief.html
cp /tmp/gpb/public.json data/daily/2026-11-17.json        # publish (no actions)
python -m generator.fringe 2026-11-13 2026-11-19          # Fringe Weekly
python -m generator.build && python -m http.server -d site 8000
```

Without `ANTHROPIC_API_KEY`, `run.mjs` runs in manual mode: it reads `brief.rN.json` and `judge.rN.json` from the work folder and stops, naming the file it needs next.

## Content maintenance

| What | Where | When |
|---|---|---|
| Portfolio companies, aliases, internal context | `PORTFOLIO_JSON` secret | The tracker changes |
| M31's public theses | `gp-brief/thesis.mjs` | A new essay is published |
| Sectors, VC and bellwether watchlists | `gp-brief/taxonomy.mjs` | Sectors change |
| Search queries | `gp-brief/queries.mjs` | A topic keeps getting missed |

Each published issue is a JSON file in `data/`. Edit it and push to `main`, and the site rebuilds without calling the API.
