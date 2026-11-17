"""Render every issue in data/ into a static site in site/.

    python -m generator.build

- Daily Brief: data/daily/<date>.json, rendered by the approved GP-brief renderer
  (gp-brief/render-site.mjs, Node) in its shareable form, with no "What next" actions.
- Fringe Foundation Weekly: data/fringe/<start>.json, rendered with templates/fringe*.html.
- Home page: templates/index.html.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent.parent
DATA, SITE = ROOT / "data", ROOT / "site"
# Absolute site URL (e.g. https://owner.github.io/repo/) so links in the inbox version work from email.
SITE_URL = os.environ.get("SITE_URL", "")

# Daily Brief sections, in reading order, with the renderer's colors (gp-brief/render-html.mjs).
PURPOSES = [
    ("portfolio", "Portfolio", "#0a0a0a"),
    ("thesis", "M31 Thesis", "#6d28d9"),
    ("regulation", "Regulation", "#991b1b"),
    ("tech", "Tech & Funding", "#1d4ed8"),
    ("macro", "Macro & Markets", "#92400e"),
    ("frontier", "Frontier", "#0e7490"),
]

LABEL_ORDER = ["ACT", "WATCH", "PENDING", "CRITIQUE", "CONTEXT", "BENCHMARK"]
LABEL_MEANING = {
    "ACT": "Act = do something this week",
    "WATCH": "Watch = no action until a named result appears",
    "PENDING": "Pending = we only saw the title",
    "CRITIQUE": "Critique = someone pushing back on a claim",
    "CONTEXT": "Context = background, not a new claim",
    "BENCHMARK": "Benchmark = a mainstream result claims must fit",
}
LABEL_PHRASE = {
    "WATCH": "{n} to watch",
    "PENDING": "{n} pending a full paper",
    "CRITIQUE": "{n} {critiques}",
    "CONTEXT": "{n} for context",
    "BENCHMARK": "{n} {benchmarks}",
}

env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))


def long_date(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d:%A, %B} {d.day}, {d.year}"


def short_date(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d:%a, %b} {d.day}"


def load(kind: str) -> list[dict]:
    items = []
    for p in sorted((DATA / kind).glob("*.json"), reverse=True):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.stem):
            items.append({"slug": p.stem, "d": json.loads(p.read_text())})
    return items


def write(path: Path, html: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html)


# ── Daily Brief ──────────────────────────────────────────────────────────────

def daily_summary(it: dict) -> dict:
    d = it["d"]
    tops = []
    for key, label, color in PURPOSES:
        for i, st in enumerate(d.get(key) or []):
            if st.get("topRank"):
                tops.append({
                    "rank": st["topRank"], "label": label, "color": color, "company": st.get("company", ""),
                    "title": st["title"], "impact": st["impact"],
                    "href": f"daily/{it['slug']}.html#s-{key}-{i + 1}",
                })
    tops.sort(key=lambda t: t["rank"])
    count = sum(len(d.get(k) or []) for k, _, _ in PURPOSES)
    return {
        "slug": it["slug"], "date": it["slug"], "long_date": long_date(it["slug"]), "short_date": short_date(it["slug"]),
        "headline": d["headline"], "bottom_line": d["bottomLine"], "tops": tops,
        "stories": count, "deals": len(d.get("deals") or []),
        "minutes": max(1, round((d.get("meta") or {}).get("readMinutes") or 5)),
    }


def build_daily() -> list[dict]:
    if not (DATA / "daily").exists():
        return []
    subprocess.run(["node", str(ROOT / "gp-brief" / "render-site.mjs"), str(DATA / "daily"), str(SITE / "daily")], check=True)
    return [daily_summary(it) for it in load("daily")]


# ── Fringe Foundation Weekly ─────────────────────────────────────────────────

def neighbours(items, i, label_key):
    """items are newest first: prev = older issue, next = newer issue."""
    def link(j):
        return {"href": f"{items[j]['slug']}.html", "label": items[j]["d"][label_key]}
    return (link(i + 1) if i + 1 < len(items) else None, link(i - 1) if i > 0 else None)


def fringe_nav(d: dict):
    groups = {lab: [c for c in d["cards"] if c["label"] == lab] for lab in LABEL_ORDER}
    shown = [lab for lab in LABEL_ORDER if groups[lab] or lab == "ACT"]
    gs = [{"label": lab, "cards": groups[lab]} for lab in shown]
    rows = [gs[i:i + 2] for i in range(0, len(gs), 2)]
    legend = " · ".join(LABEL_MEANING[lab] for lab in shown)
    return rows, legend


def fringe_summary(d: dict) -> dict:
    """The issue's first-screen line, from its card labels."""
    count = {lab: sum(1 for c in d["cards"] if c["label"] == lab) for lab in LABEL_ORDER}
    n = len(d["cards"])
    act = count["ACT"]
    headline = f"{n} claims screened, " + (f"{act} to act on this week" if act else "none to act on this week")
    parts = [
        LABEL_PHRASE[lab].format(n=count[lab], critiques="critique" if count[lab] == 1 else "critiques",
                                 benchmarks="benchmark" if count[lab] == 1 else "benchmarks")
        for lab in LABEL_ORDER[1:] if count[lab]
    ]
    dek = (", ".join(parts[:-1]) + (" and " if len(parts) > 1 else "") + parts[-1] + ".") if parts else ""
    dek = dek[:1].upper() + dek[1:]
    return {"headline": headline, "dek": dek, "act": act, "count": n}


PILL = {"ACT": ("#fff7e6", "#b45309"), "DO": ("#eef3fd", "#1d4ed8"), "FIX": ("#f3f1ec", "#5c5c5c")}


def split_first_sentence(text: str) -> tuple[str, str]:
    m = re.match(r"(.+?[.!?])\s+(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else (text, "")


def fringe_email(d: dict) -> dict:
    """Derive the inbox version's sections from an issue's cards."""
    actions = []
    for c in d["cards"]:
        if c["label"] == "ACT" or (c["label"] == "CONTEXT" and c["label_detail"] == "DO"):
            tag = "ACT" if c["label"] == "ACT" else "DO"
            title, rest = split_first_sentence(c["todo"] or c["claim"])
            sub = f"{c['rule_label']}: {c['rule_text']}" if c["rule_label"] and c["rule_text"] else ""
            actions.append({"tag": tag, "title": title, "text": rest, "sub": sub})
    if d.get("coverage_warning"):
        actions.append({"tag": "FIX", "title": "Coverage gap.", "text": d["coverage_warning"], "sub": ""})
    for a in actions:
        a["bg"], a["fg"] = PILL[a["tag"]]
    claims = [c for c in d["cards"] if c["label"] in ("ACT", "WATCH", "PENDING")]
    watching = [c["nav"].title() for c in claims[2:] if c["label"] == "WATCH"]
    bench = next((c["claim"] for c in d["cards"] if c["label"] == "BENCHMARK"), "")
    return {"actions": actions, "top": claims[:2], "watching": watching, "bench": bench}


def build_fringe() -> list[dict]:
    fringe = load("fringe")
    t = env.get_template("fringe.html")
    out = []
    for i, it in enumerate(fringe):
        d = it["d"]
        prev, nxt = neighbours(fringe, i, "week_label")
        rows, legend = fringe_nav(d)
        summary = fringe_summary(d)
        html = t.render(d=d, root="../", prev=prev, next=nxt, nav_rows=rows, legend=legend, slug=it["slug"], summary=summary)
        write(SITE / "fringe" / f"{it['slug']}.html", html)
        if i == 0:
            write(SITE / "fringe" / "index.html", html)
        full_url = f"{SITE_URL}fringe/{it['slug']}.html" if SITE_URL else f"{it['slug']}.html"
        email = env.get_template("fringe_email.html").render(d=d, full_url=full_url, **fringe_email(d))
        write(SITE / "fringe" / f"{it['slug']}-email.html", email)
        out.append({"slug": it["slug"], "d": d, **summary})
    write(SITE / "fringe" / "coverage.html", env.get_template("coverage.html").render())
    return out


def main() -> None:
    if SITE.exists():
        shutil.rmtree(SITE)
    shutil.copytree(ROOT / "static", SITE / "static")
    (SITE / ".nojekyll").write_text("")

    daily = build_daily()
    fringe = build_fringe()

    now = dt.datetime.now(dt.UTC)
    write(SITE / "index.html", env.get_template("index.html").render(
        daily=daily, fringe=fringe, updated=f"{now:%b} {now.day}, {now.year}"))
    print(f"Built {len(daily)} daily and {len(fringe)} fringe issues into {SITE}")


if __name__ == "__main__":
    main()
