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
- **"What next" actions are published only encrypted.** With the `BRIEF_PASSPHRASE` secret set, the actions are encrypted (AES-256-GCM, key from the passphrase via PBKDF2-SHA256, 600,000 rounds) into `public.json`. On the page, the **What next** button asks for the password and decrypts in the browser; the passphrase is remembered for the browser session. Without the secret, actions are dropped. Use a long random passphrase: the ciphertext is public, so a weak one could be guessed offline. Share it with partners only.
- Drafts, GP reviews, the readable partner copy and the quality report stay in the runner's temp folder. None of them is committed or uploaded as an artifact, because artifacts of a public repo are downloadable.
- **Logs print summaries only**, because Actions logs on a public repo are public: no query text (portfolio queries are company names), no check-failure text, no model output.
- The published brief still contains the **Portfolio** section (news on M31 companies), as in the shareable copy (`brief-share.html`) of the approved design. If holdings must not be public, keep the repo and Pages private instead (Pages for a private repo needs a paid GitHub plan).
- The partner copy with actions belongs behind the dashboard login, as described in the original handoff (`/brief`, admin role only).

## Setup (one time)

In the repo under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `BRIEF_PASSPHRASE` | The partners' passphrase that unlocks "What next" on the site. Changing it does not re-lock older issues, which keep the passphrase they were built with. |
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

**Refresh.** Each brief has a **Refresh** button. It opens the matching workflow on GitHub, where anyone with write access clicks **Run workflow** for a fresh edition (about 15 minutes; a same-day Daily Brief is replaced by the newer edition). The panel also shows whether a refresh is running and when the last one finished, from GitHub's public API. A static page cannot start a run itself without exposing a GitHub token.

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
