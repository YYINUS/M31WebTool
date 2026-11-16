# M31 Reports

Two auto-generated reports, published as a static site on GitHub Pages:

- **M31 Daily Brief**: a 2-minute morning read across M31's sectors, with a headline story, today's asks, and why each item matters and what to watch next. Every weekday.
- **Fringe Foundation Weekly Signal**: a decision-first scan of frontier and anomalous claims (MOND, psi, LENR, consciousness, technosignatures, UAP). Each claim gets a label (Act / Watch / Pending / Critique / Context / Benchmark), an evidence stage from 1 to 5, an impact rating and a follow-up plan. Every Friday.

Both layouts are ported from the design canvases "M31 Daily Brief – Simplified" and "Fringe Foundation Weekly — Redesign".

## How it works

```
generator/daily.py    research prompt + JSON schema for the Daily Brief
generator/fringe.py   research prompt + JSON schema for the Fringe Weekly
generator/common.py   Claude API calls: a web-research pass, then a structured-output pass
generator/build.py    renders data/**/*.json through templates/ into site/
data/daily/           one JSON per issue (+ notes/ with the raw research notes)
data/fringe/
templates/, static/   HTML templates and CSS
.github/workflows/reports.yml   schedule → generate → commit data → build → deploy to Pages
```

Each report makes two Claude API calls (`claude-opus-5-5`):

1. **Research.** Claude uses the server-side `web_search` and `web_fetch` tools to find and open sources from the report window, then writes notes with URLs.
2. **Structure.** Claude turns those notes into JSON that matches the report's schema (structured outputs). The instructions only allow URLs that appear in the notes.

## Setup (one time)

1. **Add the API key as a secret.** In the repo, go to *Settings → Secrets and variables → Actions → New repository secret*. Name it `ANTHROPIC_API_KEY` and paste your key as the value. Never commit the key to the repo.
2. **Turn on Pages.** Go to *Settings → Pages → Build and deployment → Source* and choose **GitHub Actions**.
3. **Use `main` as the default branch.** Scheduled workflows only run on the default branch.
4. **Run it once.** Go to *Actions → Generate and publish reports → Run workflow*, pick `none` to just publish what's in `data/`, or pick `daily`, `fringe` or `both` to generate.

The site is then at `https://<owner>.github.io/<repo>/`, with `/daily/` and `/fringe/` always showing the latest issue.

## Schedule

| Report | When (UTC) | Covers |
|---|---|---|
| Daily Brief | Mon–Fri 11:41 (6:41 am ET in winter) | since the previous business day (Monday covers the weekend) |
| Fringe Weekly | Fri 13:17 | the 7 days ending that day (Sat–Fri) |

To change the times, edit `cron` in `.github/workflows/reports.yml`. If you change the Fringe cron, update the matching string in the "Decide what to generate" step too.

## Run locally

```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export ANTHROPIC_API_KEY=...          # your key, kept out of the repo
python -m generator.daily 2026-11-16
python -m generator.fringe 2026-11-13 2026-11-19
python -m generator.build && python -m http.server -d site 8000
```

## Cost

Each report runs one research pass (up to 30 searches and 20 page fetches) and one formatting pass. Check *Usage* in the Claude Console after the first few runs to see what a typical issue costs.

## Editing reports

Each issue is a JSON file in `data/`. Edit it and push to `main`, and the site rebuilds without calling the API. The raw research notes for each issue are kept in `data/*/notes/` so you can check where a claim came from.
