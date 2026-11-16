"""Generate the M31 Daily Brief for a given date.

    python -m generator.daily            # today (UTC)
    python -m generator.daily 2026-11-16
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from .common import LINK, STR, arr, enum, log, obj, research, structure

SECTORS = [
    "Crypto & Digital Assets",
    "AI Systems",
    "Healthcare & Life Sciences",
    "Robotics & Autonomy",
    "Energy & Grid",
    "Deep Tech",
    "Frontier Physics",
    "Food & Agriculture",
]

SYSTEM = """You are the research editor of the M31 Capital Daily Brief, a 2-minute morning read for a \
venture investment team. M31 invests where decentralized, frontier technology meets incumbents: crypto and \
digital assets, AI systems, healthcare and life sciences, robotics and autonomy, energy and grid, deep tech, \
frontier physics, and food and agriculture.

Editorial standard:
- Thesis-moving only. A story makes the brief if it changes how an investor should think about a sector, \
not because it is loud. Prices and TVL go in "also noted" unless they move a thesis.
- Every item needs a real, specific source URL you actually opened or saw in search results. Never invent \
a URL, number, name or quote. If you only have a secondhand or company source, say so.
- Mark single-source or rumor items as unconfirmed; mark company claims with no data as unverified.
- Plain, direct sentences. No hype, no hedging filler.
- Find the one cross-sector story of the day; that becomes the headline."""


def window(day: dt.date) -> tuple[dt.date, dt.date]:
    """Cover from the previous business day (so Monday covers the weekend)."""
    back = 3 if day.weekday() == 0 else 1
    return day - dt.timedelta(days=back), day


def research_task(day: dt.date) -> str:
    start, end = window(day)
    return f"""Today is {day:%A, %B %d, %Y}. Research news published {start:%b %d} – {end:%b %d, %Y} for \
today's brief.

Cover each sector: {", ".join(SECTORS)}.

Work method:
1. Search each sector for the period's most important developments (regulation, major financings and \
deals, clinical/trial readouts, technical results, policy, market structure). Search several queries per \
sector; prefer primary sources (regulators, company filings, journals, preprints, wire services).
2. Open the key pages to confirm facts, dates and figures. Drop anything you cannot confirm is from this \
window.
3. Write research notes. For each candidate item give: sector; a one-line factual headline; why it matters \
for an investor (1–2 sentences); what to watch next; significance (MAJOR / MODERATE / MINOR); whether it is \
confirmed, single-source or a company claim; and the exact source names with URLs.
4. Also list smaller "also noted" items per sector (one line each, with source), the sectors where nothing \
thesis-moving happened, and the kinds of noise you filtered out.
5. End with: the one cross-sector story of the day, and 2–4 concrete asks for the team \
(Discuss / Decide / Research)."""


SCHEMA = obj(
    {
        "date_label": STR,
        "read_time": STR,
        "headline": STR,
        "dek": STR,
        "asks": arr(obj({"verb": enum("Discuss", "Decide", "Research", "Watch"), "text": STR})),
        "sections": arr(
            obj(
                {
                    "name": STR,
                    "thesis": STR,
                    "items": arr(
                        obj(
                            {
                                "significance": enum("MAJOR", "MODERATE", "MINOR"),
                                "flag": enum("", "UNCONFIRMED", "UNVERIFIED"),
                                "title": STR,
                                "why": STR,
                                "watch": STR,
                                "sources": arr(LINK),
                                "source_note": STR,
                            }
                        )
                    ),
                    "also_noted": arr(STR),
                }
            )
        ),
        "quiet_sectors": arr(STR),
        "filtered_out": STR,
    }
)

INSTRUCTIONS = """Write today's brief as JSON from the research notes above. Rules:
- date_label like "Mon, Nov 16". read_time like "2-min read".
- headline: one sentence, the cross-sector story, max ~16 words. dek: 1–2 sentences that set it up.
- asks: 2–4 items, each a short imperative phrase completing "Discuss:", "Decide:" or "Research:".
- sections: only sectors with at least one item worth a card, ordered by importance. thesis = one short \
line framing the sector today. 1–3 items per section, most important first.
- item.title: factual headline. why: one sentence, starts lowercase (it follows "Why it matters:"). \
watch: one short clause (follows "What to watch:"). flag: "UNCONFIRMED" for rumor/single secondhand \
source, "UNVERIFIED" for a company claim without data, else "".
- sources: label = publication name, url = exact URL from the notes. Use only URLs present in the notes. \
source_note: short caveat such as "secondhand", "company source", "confirm with a wire service", or "".
- also_noted: 0–4 one-line items for that section, with figures where useful.
- quiet_sectors: sectors from the coverage list with nothing thesis-moving.
- filtered_out: one short sentence on the noise filtered out, or "".
Never add facts that are not in the notes."""


def generate(day: dt.date, out_dir: Path) -> Path:
    log(f"Daily brief for {day}: research pass")
    notes = research(SYSTEM, research_task(day))
    log("Daily brief: structure pass")
    data = structure(SYSTEM, notes, INSTRUCTIONS, SCHEMA)
    data["date"] = day.isoformat()
    data["sectors"] = SECTORS
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{day.isoformat()}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "notes").mkdir(exist_ok=True)
    (out_dir / "notes" / f"{day.isoformat()}.md").write_text(notes)
    log(f"wrote {path}")
    return path


if __name__ == "__main__":
    d = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.datetime.now(dt.UTC).date()
    generate(d, Path("data/daily"))
