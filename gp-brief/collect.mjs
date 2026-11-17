// Step 1 — COLLECT: pull recent news for every purpose (portfolio, regulation, tech/funding by sector, macro).
//
// Sources (all optional, combined and de-duplicated):
//   · Google News RSS  — free, no key. Default.
//   · NewsAPI          — set NEWSAPI_KEY.
//   · GDELT            — free, no key. Set USE_GDELT=1.
//   · A file           — --from items.json, for items gathered elsewhere
//                        (a Supabase feed_results export, a web-search run).
//
// Output: items.json, an array of
//   { id, sectorId, query, title, source, url, publishedAt, summary }

import { QUERIES, RESULTS_PER_QUERY } from './queries.mjs';

const DAY_MS = 24 * 3600 * 1000;
const UA = { 'User-Agent': 'M31-GP-Brief/1.0' };

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '').trim();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GOOGLE_PAUSE_MS = 400; // Google News throttles bursts from cloud IPs (429s)

async function googleNews(query, hours, limit = RESULTS_PER_QUERY) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${Math.ceil(hours / 24)}d`)}&hl=en-US&gl=US&ceid=US:en`;
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(attempt ? 4000 * attempt : GOOGLE_PAUSE_MS);
    res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (res.status !== 429) break;
  }
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = await res.text();
  return (xml.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, limit).map((it) => {
    const source = tag(it, 'source');
    // Google appends " - Source" to titles; strip it.
    const title = tag(it, 'title').replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    const t = Date.parse(tag(it, 'pubDate'));
    // Google's <description> is an HTML list of links (no article text), so keep only the plain-text remnant.
    return { title, source, url: tag(it, 'link'), publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : '', summary: tag(it, 'description').replace(/\s+/g, ' ').slice(0, 300) };
  });
}

async function newsApi(query, hours, limit = RESULTS_PER_QUERY) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const from = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${from}&sortBy=relevancy&language=en&pageSize=${limit}`;
  const res = await fetch(url, { headers: { ...UA, 'X-Api-Key': key }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  const json = await res.json();
  return (json.articles || []).map((a) => ({ title: a.title, source: a.source?.name || '', url: a.url, publishedAt: a.publishedAt, summary: (a.description || '').slice(0, 300) }));
}

async function gdelt(query, hours, limit = RESULTS_PER_QUERY) {
  if (!process.env.USE_GDELT) return [];
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=${limit}&timespan=${Math.ceil(hours / 24)}d&sourcelang=english`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`GDELT ${res.status}`);
  const json = await res.json();
  return (json.articles || []).map((a) => {
    const s = a.seendate || '';
    const iso = s.length >= 15 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:00Z` : new Date().toISOString();
    return { title: a.title, source: a.domain, url: a.url, publishedAt: iso, summary: '' };
  });
}

// Near-duplicate key: first 8 meaningful words of the title.
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'with', 'as', 'at', 'by', 'is', 'its']);
export const titleKey = (t) => (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).slice(0, 8).join(' ');

export function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const k = titleKey(it.title);
    if (!k) continue;
    if (!seen.has(k)) seen.set(k, it);
  }
  return [...seen.values()];
}

// TALK OF THE DAY — how many different outlets cover the same event.
// Two headlines are the same event when they share at least half their key
// words (proper nouns and numbers carry most of the weight). Each item gets
// `outlets` = distinct sources in its cluster; widely covered stories must
// make the brief even when their link to M31 is indirect.
const KEY_STOP = new Set([...STOP, 'after', 'over', 'says', 'said', 'new', 'from', 'about', 'into', 'amid', 'report', 'reports', 'reportedly', 'could', 'will', 'more', 'than', 'what', 'why', 'how', 'this', 'that', 'his', 'her', 'their', 'be', 'are', 'was', 'has', 'have']);
const keyWords = (t) => new Set((t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !KEY_STOP.has(w)));
export function scoreCoverage(fresh, raw) {
  const rawKeys = raw.map((r) => ({ src: (r.source || '').toLowerCase(), k: keyWords(r.title) }));
  for (const it of fresh) {
    const k = keyWords(it.title);
    const outlets = new Set();
    for (const r of rawKeys) {
      let n = 0; for (const w of k) if (r.k.has(w)) n++;
      if (sameEvent(k, r.k)) outlets.add(r.src);
    }
    it.outlets = Math.max(1, outlets.size);
  }
  // Group items about the same event under one eventId (the most-covered item's id),
  // so the "talk of the day" gate asks for the EVENT to be covered, not every article about it.
  const order = [...fresh].sort((a, b) => b.outlets - a.outlets);
  const heads = [];
  for (const it of order) {
    const k = keyWords(it.title);
    const head = heads.find((h) => sameEvent(k, h.k));
    if (head) it.eventOf = head.it;
    else { heads.push({ it, k }); it.eventOf = it; }
  }
  return fresh;
}
function sameEvent(a, b) {
  let n = 0; for (const w of a) if (b.has(w)) n++;
  return n >= 3 && n / Math.min(a.size, b.size || 1) >= 0.5;
}

// Search windows match the freshness gates in checks.mjs: Portfolio and Frontier
// 7 days; everything else 48h, or 84h on Mondays to cover the weekend.
const LONG_WINDOW = new Set(['portfolio', 'frontier']);
export async function collect({ sectors = Object.keys(QUERIES), hours = new Date().getUTCDay() === 1 ? 84 : 48, longHours = 168, log = console.error } = {}) {
  const hoursFor = (key) => (LONG_WINDOW.has(key) ? longHours : hours);
  const cutoffFor = (key) => Date.now() - hoursFor(key) * 3600 * 1000;
  const out = [];
  const failures = [];
  for (const sectorId of sectors) {
    for (const query of QUERIES[sectorId] || []) {
      for (const [name, fn] of [['google', googleNews], ['newsapi', newsApi], ['gdelt', gdelt]]) {
        try {
          const items = await fn(query, hoursFor(sectorId));
          for (const it of items) out.push({ ...it, sectorId, query, via: name });
        } catch (e) {
          failures.push(`${name}:${query}: ${e.message}`);
        }
      }
    }
  }
  const fresh = dedupe(out.filter((it) => it.title && it.url && Date.parse(it.publishedAt) >= cutoffFor(it.sectorId)));
  scoreCoverage(fresh, out.filter((it) => Date.parse(it.publishedAt) >= cutoffFor(it.sectorId)));
  fresh.sort((a, b) => b.outlets - a.outlets);
  fresh.forEach((it, i) => { it.id = `n${i + 1}`; });
  for (const it of fresh) { it.eventId = it.eventOf.id; delete it.eventOf; }
  log(`collect: ${out.length} raw → ${fresh.length} fresh unique items (${failures.length} source failures)`);
  // Query text is not logged: portfolio queries are company names, and CI logs are public.
  if (failures.length) log('  source failures by type: ' + Object.entries(failures.reduce((a, f) => { const k = f.split(':')[0] + ' ' + (f.match(/\b(\d{3})\b/)?.[1] || 'error'); a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, n]) => `${k} ×${n}`).join(', '));
  return { items: fresh, failures };
}
