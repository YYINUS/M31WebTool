"""Render every issue in data/ into a static site in site/.

    python -m generator.build
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent.parent
DATA, SITE = ROOT / "data", ROOT / "site"
# Absolute site URL (e.g. https://owner.github.io/repo/) so links in the inbox version work from email.
SITE_URL = os.environ.get("SITE_URL", "")

LABEL_ORDER = ["ACT", "WATCH", "PENDING", "CRITIQUE", "CONTEXT", "BENCHMARK"]
LABEL_MEANING = {
    "ACT": "Act = do something this week",
    "WATCH": "Watch = no action until a named result appears",
    "PENDING": "Pending = we only saw the title",
    "CRITIQUE": "Critique = someone pushing back on a claim",
    "CONTEXT": "Context = background, not a new claim",
    "BENCHMARK": "Benchmark = a mainstream result claims must fit",
}

env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))


def load(kind: str) -> list[dict]:
    items = []
    for p in sorted((DATA / kind).glob("*.json"), reverse=True):
        items.append({"slug": p.stem, "d": json.loads(p.read_text())})
    return items


def neighbours(items, i, label_key):
    """items are newest first: prev = older issue, next = newer issue."""
    def link(j):
        return {"href": f"{items[j]['slug']}.html", "label": items[j]["d"][label_key]}
    return (link(i + 1) if i + 1 < len(items) else None, link(i - 1) if i > 0 else None)


def write(path: Path, html: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html)


def fringe_nav(d: dict):
    groups = {lab: [c for c in d["cards"] if c["label"] == lab] for lab in LABEL_ORDER}
    shown = [lab for lab in LABEL_ORDER if groups[lab] or lab == "ACT"]
    gs = [{"label": lab, "cards": groups[lab]} for lab in shown]
    rows = [gs[i:i + 2] for i in range(0, len(gs), 2)]
    legend = " · ".join(LABEL_MEANING[lab] for lab in shown)
    return rows, legend


PILL = {"ACT": ("#FBE9DF", "#9A3412"), "DO": ("#E6EDFB", "#1E40AF"), "FIX": ("#ECEBE6", "#4B5060")}


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
    top = claims[:2]
    watching = [c["nav"].title() for c in claims[2:] if c["label"] == "WATCH"]
    bench = next((c["claim"] for c in d["cards"] if c["label"] == "BENCHMARK"), "")
    return {"actions": actions, "top": top, "watching": watching, "bench": bench}


def main() -> None:
    if SITE.exists():
        shutil.rmtree(SITE)
    shutil.copytree(ROOT / "static", SITE / "static")
    (SITE / ".nojekyll").write_text("")

    daily, fringe = load("daily"), load("fringe")

    t = env.get_template("daily.html")
    for i, it in enumerate(daily):
        prev, nxt = neighbours(daily, i, "date_label")
        html = t.render(d=it["d"], root="../", prev=prev, next=nxt)
        write(SITE / "daily" / f"{it['slug']}.html", html)
        if i == 0:
            write(SITE / "daily" / "index.html", html)

    t = env.get_template("fringe.html")
    for i, it in enumerate(fringe):
        prev, nxt = neighbours(fringe, i, "week_label")
        rows, legend = fringe_nav(it["d"])
        html = t.render(d=it["d"], root="../", prev=prev, next=nxt, nav_rows=rows, legend=legend, slug=it["slug"])
        write(SITE / "fringe" / f"{it['slug']}.html", html)
        if i == 0:
            write(SITE / "fringe" / "index.html", html)
        full_url = f"{SITE_URL}fringe/{it['slug']}.html" if SITE_URL else f"{it['slug']}.html"
        email = env.get_template("fringe_email.html").render(d=it["d"], full_url=full_url, **fringe_email(it["d"]))
        write(SITE / "fringe" / f"{it['slug']}-email.html", email)

    write(SITE / "fringe" / "coverage.html", env.get_template("coverage.html").render())

    updated = dt.datetime.now(dt.UTC).strftime("%b %d, %Y %H:%M UTC")
    write(SITE / "index.html", env.get_template("index.html").render(daily=daily, fringe=fringe, updated=updated))
    print(f"Built {len(daily)} daily and {len(fringe)} fringe issues into {SITE}")


if __name__ == "__main__":
    main()
