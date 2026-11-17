"""Pre-fetch the Fringe Weekly's standing sources before the research pass.

The research model's web_fetch tool can only open URLs that already appear in
the conversation, and its search budget runs out across eight topics. So the
listings the issue depends on are pulled here, in code, for the issue's date
window, and handed to the model as a candidate list with links and abstracts:

- arXiv API: physics.gen-ph in full; astro-ph / hep-ph / nucl-ex / quant-ph
  filtered to Fringe topics; "Comment on" papers (critiques)
- Retraction Watch (critiques, retractions)
- PsyArXiv via the OSF API, filtered to psi and consciousness terms
- Journal of Scientific Exploration (RSS)
- NASA Technical Reports Server (LENR, lattice and screened fusion)

Every source is optional: a failure is logged and the rest still run.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = {"User-Agent": "FringeWeekly/1.0 (research digest)"}
ATOM = "{http://www.w3.org/2005/Atom}"

# arXiv's keyword search lags for new papers, so whole categories are pulled
# for the window and filtered here. physics.gen-ph is kept in full.
ARXIV_CATEGORIES = ["physics.gen-ph", "astro-ph.CO", "astro-ph.GA", "gr-qc", "hep-ph", "nucl-ex", "nucl-th",
                    "quant-ph", "astro-ph.IM", "astro-ph.EP", "q-bio.NC"]
ARXIV_TOPICS = [
    ("MOND / modified gravity", r"\bMOND\b|Milgrom|modified Newtonian|modified gravity|f\(T\)|f\(R\)|teleparallel|emergent gravity"),
    ("dark energy anomalies", r"dark energy.{0,60}(inhomogen|evolv|sign|negative|phantom)|(inhomogen|evolv|phantom).{0,60}dark energy"),
    ("critique: comment / reply", r"^(comment on|reply to|response to|a comment|rebuttal)"),
    ("fusion in solids / LENR", r"electron screening|lattice confinement|low[- ]energy nuclear|cold fusion|muon[- ]catalyz|deuterium.{0,40}(palladium|titanium|metal)"),
    ("vacuum / zero-point / Casimir", r"Casimir|zero[- ]point|vacuum energy|light[- ]by[- ]light|quantum vacuum"),
    ("consciousness / collapse", r"consciousness|objective collapse|wave ?function collapse|Orch-?OR|integrated information"),
    ("technosignatures / SETI / UAP", r"technosignature|\bSETI\b|extraterrestrial intelligence|Breakthrough Listen|unidentified (aerial|anomalous)|\bUAP\b|interstellar object"),
]
PSI_TERMS = re.compile(
    r"\b(psi|parapsycholog\w*|precognit\w*|telepath\w*|clairvoyan\w*|remote viewing|presentiment|ganzfeld|"
    r"near-death|out-of-body|mediumship|reincarnation|anomalous (cognition|experience)\w*|psychokines\w*|"
    r"consciousness|psychedelic\w*|mystical)\b",
    re.I,
)


def _get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _clean(s: str, n: int = 320) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n] + ("…" if len(s) > n else "")


def _in_window(d: dt.date | None, start: dt.date, end: dt.date) -> bool:
    return d is not None and start <= d <= end


def arxiv_category(cat: str, start: dt.date, end: dt.date, cap: int = 600) -> list[dict]:
    """Every paper submitted to `cat` in the window (paginated, arXiv asks for ~3s between calls)."""
    import time
    out, offset = [], 0
    while offset < cap:
        q = f"cat:{cat} AND submittedDate:[{start:%Y%m%d}0000 TO {end:%Y%m%d}2359]"
        url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(
            {"search_query": q, "start": offset, "max_results": 200, "sortBy": "submittedDate", "sortOrder": "descending"})
        root = ET.fromstring(_get(url, 60))
        entries = root.findall(f"{ATOM}entry")
        for e in entries:
            authors = [x.findtext(f"{ATOM}name") for x in e.findall(f"{ATOM}author")]
            out.append({
                "title": _clean(e.findtext(f"{ATOM}title"), 200),
                "url": re.sub(r"v\d+$", "", (e.findtext(f"{ATOM}id") or "").replace("http://", "https://")),
                "date": (e.findtext(f"{ATOM}published") or "")[:10],
                "who": ", ".join(authors[:4]) + (" et al." if len(authors) > 4 else ""),
                "summary": _clean(e.findtext(f"{ATOM}summary")),
                "abstract": e.findtext(f"{ATOM}summary") or "",
            })
        if len(entries) < 200:
            break
        offset += 200
        time.sleep(3)
    return out


def arxiv(start: dt.date, end: dt.date, counts: dict) -> list[dict]:
    import time
    papers = {}
    for cat in ARXIV_CATEGORIES:
        try:
            for p in arxiv_category(cat, start, end):
                papers.setdefault(p["url"], {**p, "cat": cat})
            counts[f"arXiv {cat} scanned"] = sum(1 for p in papers.values() if p["cat"] == cat)
        except Exception as e:
            counts[f"arXiv {cat}"] = f"failed ({type(e).__name__})"
        time.sleep(3)
    out = []
    for p in papers.values():
        text = f"{p['title']} {p['abstract']}"
        topics = [label for label, rx in ARXIV_TOPICS
                  if re.search(rx, p["title"] if label.startswith("critique") else text, re.I)]
        if p["cat"] == "physics.gen-ph" or topics:
            out.append({**{k: p[k] for k in ("title", "url", "date", "who", "summary")},
                        "source": f"arXiv {p['cat']}" + (f" · {', '.join(topics)}" if topics else "")})
    counts["arXiv candidates"] = len(out)
    return out


def rss(label: str, url: str, start: dt.date, end: dt.date, keep=lambda t, d: True) -> list[dict]:
    root = ET.fromstring(_get(url))
    out = []
    for it in root.iter("item"):
        raw = it.findtext("pubDate") or ""
        try:
            d = dt.datetime.strptime(raw[:16], "%a, %d %b %Y").date()
        except ValueError:
            d = None
        title, desc = it.findtext("title") or "", it.findtext("description") or ""
        if _in_window(d, start, end) and keep(title, desc):
            out.append({"source": label, "title": _clean(title, 200), "url": it.findtext("link") or "",
                        "date": d.isoformat(), "who": "", "summary": _clean(desc)})
    return out


def psyarxiv(start: dt.date, end: dt.date, pages: int = 6) -> list[dict]:
    out = []
    url = "https://api.osf.io/v2/preprints/?" + urllib.parse.urlencode({
        "filter[provider]": "psyarxiv", "filter[date_created][gte]": start.isoformat(),
        "filter[date_created][lte]": (end + dt.timedelta(days=1)).isoformat(), "page[size]": 100})
    for _ in range(pages):
        data = json.loads(_get(url, 60))
        for p in data.get("data", []):
            a = p["attributes"]
            text = f"{a.get('title', '')} {a.get('description', '')}"
            if PSI_TERMS.search(text):
                out.append({"source": "PsyArXiv", "title": _clean(a.get("title"), 200),
                            "url": f"https://osf.io/preprints/psyarxiv/{p['id'].split('_')[0]}",
                            "date": (a.get("date_created") or "")[:10], "who": "",
                            "summary": _clean(a.get("description"))})
        url = (data.get("links") or {}).get("next")
        if not url:
            break
    return out


def ntrs(start: dt.date, end: dt.date) -> list[dict]:
    out = []
    for q in ["lattice confinement fusion", "low energy nuclear reactions", "electron screening fusion"]:
        url = "https://ntrs.nasa.gov/api/citations/search?" + urllib.parse.urlencode(
            {"q": q, "published.gte": start.isoformat()})
        for r in json.loads(_get(url)).get("results", []):
            d = (r.get("publications") or [{}])[0].get("publicationDate", "")[:10] or (r.get("submittedDate") or "")[:10]
            out.append({"source": "NASA NTRS", "title": _clean(r.get("title"), 200),
                        "url": f"https://ntrs.nasa.gov/citations/{r.get('id')}", "date": d,
                        "who": ", ".join(a.get("meta", {}).get("author", {}).get("name", "") for a in (r.get("authorAffiliations") or [])[:3]),
                        "summary": _clean(r.get("abstract"))})
    return out


def prefetch(start: dt.date, end: dt.date, log=print) -> tuple[str, dict]:
    """Return (candidate list as text for the prompt, per-source counts)."""
    items: list[dict] = []
    counts: dict[str, int | str] = {}

    def run(label, fn):
        try:
            got = fn()
            counts[label] = len(got)
            items.extend(got)
        except Exception as e:  # one dead source must not stop the issue
            counts[label] = f"failed ({type(e).__name__})"

    try:
        items.extend(arxiv(start, end, counts))
    except Exception as e:
        counts["arXiv"] = f"failed ({type(e).__name__})"
    run("Retraction Watch", lambda: rss("Retraction Watch", "https://retractionwatch.com/feed/", start, end))
    run("Journal of Scientific Exploration", lambda: rss(
        "Journal of Scientific Exploration",
        "https://journalofscientificexploration.org/index.php/jse/gateway/plugin/WebFeedGatewayPlugin/rss2",
        start - dt.timedelta(days=30), end))
    run("PsyArXiv", lambda: psyarxiv(start, end))
    run("NASA NTRS", lambda: ntrs(start, end))

    seen, uniq = set(), []
    for it in items:
        if it["url"] and it["url"] not in seen:
            seen.add(it["url"])
            uniq.append(it)
    log("prefetch: " + ", ".join(f"{k} {v}" for k, v in counts.items()))

    lines = []
    for it in uniq:
        who = f" — {it['who']}" if it["who"] else ""
        lines.append(f"- [{it['source']}] {it['date']} · {it['title']}{who}\n  {it['url']}\n  {it['summary']}")
    text = "\n".join(lines)
    return text[:90000], counts
