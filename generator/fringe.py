"""Generate the Fringe Foundation Weekly Signal for a date window.

    python -m generator.fringe                          # the 7 days ending today (UTC)
    python -m generator.fringe 2026-11-13 2026-11-16    # explicit window
    python -m generator.fringe 2026-11-13 2026-11-19    # a week still in progress
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from .common import LINK, STR, arr, enum, log, obj, research, structure

TOPICS = "MOND and modified gravity, psi and parapsychology, LENR and fusion in solids, consciousness \
science, technosignatures and SETI, UAP, zero-point and vacuum physics, and speculative physics (arXiv \
physics.gen-ph)"

SYSTEM = f"""You are the editor of the Fringe Foundation Weekly Signal, a decision-first scan for a \
foundation that funds rigorous work on anomalous and frontier claims. Topics: {TOPICS}.

The reader decides each week: whom to contact, what to read, what to fund a replication of, and what to \
ignore. Every item becomes a card with a label:
- ACT: do something this week (reach out, read first, scope funding).
- WATCH: no action until a named result appears (state the trigger).
- PENDING: we only saw a title or abstract stub; result unknown.
- CRITIQUE: someone pushing back on a claim (rebuttal, failed replication, retraction, comment paper).
- CONTEXT: background or journalism, not a new claim.
- BENCHMARK: a mainstream measurement any fringe claim must be consistent with.

Evidence stages (1–5): 1 an idea, not yet tested · 2 uses data, but no comparison group · 3 tested \
against a control · 4 repeated by another team · 5 repeated by another team with the plan registered in \
advance. Higher means stronger evidence, not more likely to be true. Use 0 when a stage doesn't apply \
(journalism, plans, interviews, title-only).

Where to look (prefer these over keyword scraping): arXiv listings (physics.gen-ph, astro-ph.CO, \
astro-ph.GA, hep-ph, nucl-ex, quant-ph) including "Comment on" papers; Journal of Parapsychology; Journal \
of Scientific Exploration; PsyArXiv and OSF Registries; PLOS ONE and Royal Society Open Science; PubPeer; \
Retraction Watch; Quanta Magazine (as leads only); ARPA-E LENR teams and DARPA MARRS; NASA Technical \
Reports; Breakthrough Listen, SETI Institute and the Galileo Project; AARO and government UAP releases \
(only items with sensor data or official analysis); Bial Foundation and Templeton World Charity Foundation.

Editorial rules:
- Never invent a URL, author, affiliation, number or result. Unknown facts are written as unknown \
("affiliation not in source", "headline results not yet seen").
- No full card without an abstract; title-only items are PENDING.
- Actively look for critiques and failed replications. If none turned up, say so plainly.
- Pair each claim with the mainstream result it must be consistent with, where one exists.
- Be calm and precise: describe what the work shows, what is still unknown, what would make it more \
convincing and what would prove it wrong."""


def research_task(start: dt.date, end: dt.date, today: dt.date) -> str:
    return f"""Today is {today:%A, %B %d, %Y}. Research this issue's window: {start:%b %d} – {end:%b %d, \
%Y}{" (week in progress: cover up to today)" if end > today else ""}.

Work method:
1. For each topic ({TOPICS}) search for papers, preprints, reports and serious journalism dated in the \
window. Run several searches per topic and check arXiv listings for the window's dates.
2. Separately search for critiques: rebuttals, comment papers, failed replications, retractions and \
corrections touching these topics.
3. Open each candidate to confirm the date, authors, affiliations, venue and what it actually reports. \
Drop anything outside the window or that you cannot verify.
4. Pick roughly 5–9 items. For each write notes: short nav label (1–2 words); proposed label; field; \
source type (arXiv preprint, peer-reviewed, news report, interview, newsletter…) and date; the claim in \
one plain sentence; authors and affiliations; links (paper, DOI, press release); evidence stage 0–5 with \
a one-sentence reason; impact if true (HIGH/MEDIUM/LOW) and why; what the work shows; what is still \
unknown; what would make it more convincing; what would prove it wrong; who to follow (name + role); what \
to do (concrete action) and a decision rule or trigger; a "compare with" benchmark or earlier result with \
a URL if you have one.
5. Finish with: items you left out and why; which topics had nothing new; and whether any critique source \
produced results this week."""


DETAIL = obj({"heading": STR, "text": STR})
PERSON = obj({"name": STR, "role": STR})

SCHEMA = obj(
    {
        "week_label": STR,
        "status": STR,
        "coverage_warning": STR,
        "cards": arr(
            obj(
                {
                    "id": STR,
                    "nav": STR,
                    "label": enum("ACT", "WATCH", "PENDING", "CRITIQUE", "CONTEXT", "BENCHMARK"),
                    "label_detail": STR,
                    "meta": STR,
                    "claim": STR,
                    "people": STR,
                    "links": arr(LINK),
                    "stage": {"type": "integer", "enum": [0, 1, 2, 3, 4, 5]},
                    "stage_headline": STR,
                    "stage_note": STR,
                    "impact_heading": STR,
                    "impact": enum("HIGH", "MEDIUM", "LOW", ""),
                    "impact_text": STR,
                    "details": arr(DETAIL),
                    "follow": arr(PERSON),
                    "todo": STR,
                    "rule_label": enum("Decide", "Trigger", "Also watch", ""),
                    "rule_text": STR,
                    "needs_owner": {"type": "boolean"},
                    "compare_text": STR,
                    "compare_link": LINK,
                    "primary_link": LINK,
                }
            )
        ),
        "left_out": STR,
        "searched_note": STR,
    }
)

INSTRUCTIONS = """Write this week's issue as JSON from the research notes above. Rules:
- week_label like "Nov 13 – 16, 2026". status: "week in progress" if the window isn't over, else \
"5-minute scan".
- coverage_warning: if no critique, rebuttal or failed replication turned up, one sentence saying the \
issue shows no pushback on any claim; else "".
- cards ordered ACT, WATCH, PENDING, CRITIQUE, CONTEXT, BENCHMARK. id: short lowercase slug, letters only, \
unique. nav: 1–2 word uppercase label (e.g. "MOND SIMS").
- label_detail: optional qualifier shown after the label, e.g. "REACH OUT", "READ FIRST", "DO", \
"TITLE ONLY", else "".
- meta: uppercase "FIELD · SOURCE TYPE · DATE", e.g. "COSMOLOGY · ARXIV PREPRINT · NOV 8".
- claim: the claim as a plain declarative sentence (the card title). people: authors and affiliations \
in one line, "affiliation not in source" when unknown.
- links: paper/DOI/press links with short labels ending in " ↗" (e.g. "arXiv:2611.11094 ↗").
- stage: 0–5. stage_headline: e.g. "Stage 1 of 5: an idea, not yet tested." or for stage 0 a short \
phrase like "Journalism, not data." / "Not rated yet: we only saw the title." stage_note: 1–2 sentences.
- impact_heading: "IF TRUE, HOW BIG A DEAL?" for claims, "IF IT WORKS, HOW BIG A DEAL?" for plans, \
"WHY IT MATTERS" for CRITIQUE / BENCHMARK / CONTEXT where a size rating doesn't fit (impact "").
- details: 2–4 short blocks, normally "What the work shows", "Still unknown", "Would make it more \
convincing", "Would prove it wrong" (adapt headings for critiques, e.g. "What he says", "Keep in mind").
- follow: people to follow with a short role. todo: the concrete action. rule_label/rule_text: the \
decision rule or trigger (or "" for both). needs_owner: true for ACT and for CONTEXT items with a "do".
- compare_text / compare_link: a benchmark or earlier result to read it against, or "" and \
{"label":"","url":""}.
- primary_link: the main source, label like "arXiv: <title> ↗".
- left_out: one sentence on items left out, or "". searched_note: one or two sentences on what was \
searched and which topics had nothing new.
Use only URLs that appear in the notes. Never add facts that are not in the notes."""


def generate(start: dt.date, end: dt.date, today: dt.date, out_dir: Path) -> Path:
    log(f"Fringe weekly {start}..{end}: research pass")
    notes = research(SYSTEM, research_task(start, end, today), searches=60, fetches=40)
    log("Fringe weekly: structure pass")
    data = structure(SYSTEM, notes, INSTRUCTIONS, SCHEMA)
    data["start"], data["end"], data["generated"] = start.isoformat(), end.isoformat(), today.isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{start.isoformat()}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "notes").mkdir(exist_ok=True)
    (out_dir / "notes" / f"{start.isoformat()}.md").write_text(notes)
    log(f"wrote {path}")
    return path


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("start", nargs="?")
    p.add_argument("end", nargs="?")
    a = p.parse_args()
    today = dt.datetime.now(dt.UTC).date()
    end = dt.date.fromisoformat(a.end) if a.end else today
    start = dt.date.fromisoformat(a.start) if a.start else end - dt.timedelta(days=6)
    generate(start, end, today, Path("data/fringe"))
