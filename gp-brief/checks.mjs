// AUTOMATIC CHECKS — hard gates every version must pass before a GP sees it,
// plus the rule that turns the GP review into pass / fail. Deterministic.

import { SECTORS, OUTSIDE_SECTORS } from './taxonomy.mjs';
import { PORTFOLIO } from './portfolio.mjs';
import { titleKey } from './collect.mjs';
import { thesisById, VERDICTS } from './thesis.mjs';

const SECTOR_IDS = new Set([...SECTORS, ...OUTSIDE_SECTORS].map((s) => s.id));
const COMPANIES = new Set(PORTFOLIO.map((p) => p.name));
const CONFIDENCE = new Set(['confirmed', 'single-source', 'unconfirmed', 'company-claim']);

// The purpose sections, in reading order.
export const PURPOSES = [
  { key: 'portfolio',  label: 'Portfolio',       min: 0, max: 8, staleHours: 168, quiet: true },
  { key: 'thesis',     label: 'M31 Thesis',      min: 0, max: 4 },
  { key: 'regulation', label: 'Regulation',      min: 2, max: 5 },
  { key: 'tech',       label: 'Tech & Funding',  min: 2, max: 5 },
  { key: 'macro',      label: 'Macro & Markets', min: 2, max: 4 },
  { key: 'frontier',   label: 'Frontier',        min: 0, max: 5, staleHours: 168, quiet: true },
];
// Sections where a sector tag is optional (they cut across sectors).
const CROSS_SECTOR = new Set(['macro', 'thesis']);

const JARGON = [
  /\b(SCI|CON|PAT|SUP|ANT|OPP|MOM)\b/, /fortress[- ]siege/i, /intermediation arc/i, /suppression (index|score)/i,
  /antifragil/i, /\bscore (move|change)/i, /it'?s worth noting/i, /paradigm-level/i,
  // Internal tracker figures must never leak into the brief.
  /\b\d(\.\d+)?\s?[×x]\b(?! ?(faster|more|larger|cheaper))/i, /\bmark(ed)? (up|down|to)\b/i, /\bour (position|stake|mark)\b/i, /\bLPs?\b/, /\bshipped\b/i,
];

export const TALK_OF_DAY = 5; // outlets covering an event before it must appear
// ...but only the most widely covered events: a live pool of ~1,200 items has
// dozens of events at 5+ outlets, and requiring all of them forced 20+ stories
// (the GP review then marked the brief down for length). The top N must appear.
export const TALK_OF_DAY_TOP = 6;

export const LIMITS = {
  headline: 90, bottomLine: 320, numbers: 0, next: 120, action: 220, otherActions: 4,
  title: 90, brief: 240, impact: 240, impactOverlap: 0.6,
  deals: 6, dealText: 170, readMinutes: 10, staleHours: 48, mondayStaleHours: 84,
};

const words = (s) => (s || '').split(/\s+/).filter(Boolean).length;
const sentences = (s) => (s || '').split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean).length;
const DAY = 86400000;
const STOP = new Set('the a an of to in on for and with as at by is its it this that are was were be from or but not their our we us has have had will would could than more less'.split(' '));
const contentWords = (s) => new Set((s || '').toLowerCase().replace(/[^a-z0-9$% ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

// Share of the impact's content words already in the brief. High = restating.
export function overlap(brief, impact) {
  const b = contentWords(brief), i = contentWords(impact);
  if (!i.size) return 1;
  let n = 0; for (const w of i) if (b.has(w)) n++;
  return n / i.size;
}

export const allStories = (b) => PURPOSES.flatMap((p) => (b[p.key] || []).map((st) => ({ ...st, purpose: p.key })));

export function hydrate(brief, items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const missing = [];
  const src = (ids = []) => ids.map((id) => {
    const it = byId.get(id);
    if (!it) { missing.push(id); return null; }
    return { id, name: it.source, url: it.url, publishedAt: it.publishedAt, title: it.title };
  }).filter(Boolean);
  const out = structuredClone(brief);
  for (const p of PURPOSES) for (const st of out[p.key] || []) st.sources = src(st.itemIds);
  for (const d of out.deals || []) d.sources = src(d.itemIds);
  for (const w of out.weekAhead || []) w.sources = src(w.itemIds);
  for (const n of out.numbers || []) n.sources = src(n.itemIds);
  return { brief: out, missing };
}

export function briefText(b) {
  const parts = [b.headline, b.bottomLine, b.portfolioQuiet, b.frontierQuiet, ...(b.numbers || []).map((n) => `${n.value} ${n.label}`)];
  for (const st of allStories(b)) parts.push(st.title, st.brief, st.impact);
  for (const d of b.deals || []) parts.push(d.firm, d.text);
  return parts.filter(Boolean).join('\n');
}
// GP NEXT STEPS — what a partner should do about a story. Required on every
// portfolio story; optional (max 4) elsewhere, only when a GP can act.
// Actions may draw on internal tracker context, so they are kept out of the
// public-text jargon scan but still may not print marks, multiples or valuations.
const VAGUE_ACTION = /^(monitor|watch|keep (an eye|track)|track|stay|continue|follow (the|this)|be aware|note that|consider monitoring)\b/i;
const ACTION_LEAK = [/\b\d(\.\d+)?\s?[×x]\b/i, /\bmark(ed|s)? (up|down|to|at)\b/i, /\bour (cost basis|mark)\b/i];
export const actionsOf = (b) => allStories(b).filter((s) => s.action).map((s) => s.action);
export const readMinutes = (b) => words([briefText(b), ...actionsOf(b), ...allStories(b).map((s) => s.next || '')].join('\n')) / 220;

// opts.weekly: the Friday edition — every section may use news up to a week
// old, the read may run longer, and "weekAhead" must be dated and sourced.
export function runChecks(brief, items, opts = {}) {
  const fails = [];
  const warns = [];
  const { brief: hydrated, missing } = hydrate(brief, items);
  const date = brief.date || new Date().toISOString().slice(0, 10);
  // Ages are measured from the brief's morning publish time (~7am ET).
  const ref = Date.parse(date) + DAY / 2;
  const isMonday = new Date(ref).getUTCDay() === 1;
  const newsHours = opts.weekly ? 192 : isMonday ? LIMITS.mondayStaleHours : LIMITS.staleHours;
  const ageOf = (so) => (ref - Date.parse(so.publishedAt)) / 3600000;

  if (missing.length) fails.push(`Cites item ids that are not in the news pool: ${[...new Set(missing)].join(', ')}`);

  // First screen
  if (!brief.headline) fails.push('Missing headline');
  else if (brief.headline.length > LIMITS.headline) fails.push(`Headline is ${brief.headline.length} chars (max ${LIMITS.headline})`);
  if (!brief.bottomLine) fails.push('Missing bottom line');
  else {
    if (brief.bottomLine.length > LIMITS.bottomLine) fails.push(`Bottom line is ${brief.bottomLine.length} chars (max ${LIMITS.bottomLine})`);
    if (sentences(brief.bottomLine) > 2) fails.push(`Bottom line has ${sentences(brief.bottomLine)} sentences (max 2)`);
  }
  if ((brief.numbers || []).length > LIMITS.numbers) fails.push(`${brief.numbers.length} numbers (max ${LIMITS.numbers})`);
  for (const n of hydrated.numbers || []) if (!n.sources?.length) fails.push(`Number "${n.value}" has no source`);

  const used = new Map();
  const titles = new Map();
  const tops = [];
  const companies = new Set();
  const thesisItems = new Set();
  let otherActions = 0;
  for (const p of PURPOSES) {
    const list = hydrated[p.key] || [];
    if (list.length > p.max) fails.push(`${p.label}: ${list.length} stories (max ${p.max})`);
    if (list.length < p.min) fails.push(`${p.label}: ${list.length} stories (min ${p.min})`);
    // Sections that can be empty on a slow day must say so in one line.
    if (p.quiet && !list.length) {
      const q = brief[`${p.key}Quiet`];
      if (q) warns.push(`${p.label} quiet — "${q}"`);
      else fails.push(`${p.label} has no stories and no ${p.key}Quiet line`);
    }
    const maxAge = Math.max(p.staleHours || 0, newsHours);
    list.forEach((st, i) => {
      const tag = `${p.label} #${i + 1} "${(st.title || '').slice(0, 34)}…"`;
      if (p.key === 'portfolio') {
        if (!COMPANIES.has(st.company)) fails.push(`${tag}: "${st.company}" is not an M31 portfolio company`);
        else if (companies.has(st.company)) warns.push(`${tag}: second story on ${st.company} — merge if it is the same event`);
        companies.add(st.company);
      }
      // Macro and thesis stories are cross-sector: a sector tag is optional there, required elsewhere.
      if (p.key === 'thesis') {
        if (!thesisById(st.thesisId)) fails.push(`${tag}: unknown thesis "${st.thesisId}" (see thesis.mjs)`);
        if (!VERDICTS[st.verdict]) fails.push(`${tag}: verdict must be confirms / contradicts / mixed`);
      }
      if (p.key === 'portfolio' && !st.action) fails.push(`${tag}: portfolio story needs a GP next step ("action")`);
      if (st.action) {
        if (st.action.length > LIMITS.action) fails.push(`${tag}: action is ${st.action.length} chars (max ${LIMITS.action})`);
        if (VAGUE_ACTION.test(st.action.trim())) fails.push(`${tag}: action "${st.action.slice(0, 40)}…" is not a concrete step — say who does what, by when`);
        for (const re of ACTION_LEAK) { const m = st.action.match(re); if (m) fails.push(`${tag}: action prints tracker data "${m[0]}"`); }
        // Portfolio and Thesis entries may each carry one; the cap covers the news sections.
        if (p.key !== 'portfolio' && p.key !== 'thesis') otherActions++;
      }
      if (p.key === 'regulation') {
        if (!st.next) fails.push(`${tag}: say what happens next and when ("next")`);
        else if (st.next.length > LIMITS.next) fails.push(`${tag}: next is ${st.next.length} chars (max ${LIMITS.next})`);
      }
      if (st.sectorId ? !SECTOR_IDS.has(st.sectorId) : !CROSS_SECTOR.has(p.key)) fails.push(`${tag}: unknown sector "${st.sectorId}"`);
      if (!st.title) fails.push(`${tag}: no title`);
      else if (st.title.length > LIMITS.title) fails.push(`${tag}: title ${st.title.length} chars (max ${LIMITS.title})`);
      for (const f of ['brief', 'impact']) {
        if (!st[f]) fails.push(`${tag}: missing ${f}`);
        else if (st[f].length > LIMITS[f]) fails.push(`${tag}: ${f} is ${st[f].length} chars (max ${LIMITS[f]})`);
      }
      if (st.brief && st.impact) {
        const ov = overlap(st.brief, st.impact);
        if (ov > LIMITS.impactOverlap) fails.push(`${tag}: impact repeats the brief (${Math.round(ov * 100)}% shared words) — say what it means`);
      }
      if (!CONFIDENCE.has(st.confidence)) fails.push(`${tag}: source confidence not labeled`);
      if (st.topRank) tops.push(st.topRank);
      if (!st.sources?.length) fails.push(`${tag}: no source`);
      if (st.confidence === 'confirmed' && new Set((st.sources || []).map((x) => x.name)).size < 2) warns.push(`${tag}: "confirmed" with one outlet — fine only for a primary document`);
      for (const so of st.sources || []) {
        const age = ageOf(so);
        if (age > maxAge) fails.push(`${tag}: source "${so.name}" is ${Math.round(age)}h old (max ${maxAge}h)`);
        // A thesis check may point at news covered in another section; everywhere else an item is used once.
        if (p.key === 'thesis') { thesisItems.add(so.id); continue; }
        if (used.has(so.id)) fails.push(`Item ${so.id} used twice (${used.get(so.id)} and ${tag}) — merge or drop`);
        used.set(so.id, tag);
      }
      if (p.key === 'thesis') return;
      const k = titleKey(st.title).split(' ').slice(0, 5).join(' ');
      if (titles.has(k)) fails.push(`Possible duplicate stories: ${titles.get(k)} and ${tag}`);
      titles.set(k, tag);
    });
  }
  const sortedTops = [...tops].sort();
  if (!(hydrated.tech || []).some((s) => s.topRank)) fails.push('Top 3 needs at least one Tech & Funding story');
  if (sortedTops.join() !== '1,2,3') fails.push(`Top 3 must be exactly topRank 1, 2, 3 (got ${sortedTops.join(', ') || 'none'})`);

  if ((hydrated.deals || []).length > LIMITS.deals) fails.push(`${hydrated.deals.length} deals (max ${LIMITS.deals})`);
  for (const d of hydrated.deals || []) {
    const tag = `Deal "${(d.text || '').slice(0, 30)}…"`;
    if (!SECTOR_IDS.has(d.sectorId)) fails.push(`${tag}: unknown sector "${d.sectorId}"`);
    if (!d.sources?.length) fails.push(`${tag} has no source`);
    if (!d.firm) fails.push(`${tag} names no firm`);
    if (!['round', 'fund', 'report'].includes(d.kind)) fails.push(`${tag}: kind must be round / fund / report`);
    if ((d.text || '').length > LIMITS.dealText) fails.push(`${tag} is ${d.text.length} chars (max ${LIMITS.dealText})`);
    for (const so of d.sources || []) {
      const age = ageOf(so);
      if (age > newsHours) fails.push(`${tag}: source is ${Math.round(age)}h old (max ${newsHours}h)`);
      if (used.has(so.id)) fails.push(`Item ${so.id} used twice (${used.get(so.id)} and ${tag})`);
    }
  }

  // Talk of the day: a widely covered event can't be left out.
  const cited = new Set([...allStories(brief), ...(brief.deals || [])].flatMap((s) => s.itemIds || []));
  // Grouped by event (collect.mjs sets eventId): one cited article covers the whole event.
  const citedEvents = new Set(items.filter((it) => cited.has(it.id)).map((it) => it.eventId || it.id));
  const missedEvents = new Map();
  const events = new Map();
  for (const it of items) {
    const ev = it.eventId || it.id;
    if ((it.outlets || 1) >= TALK_OF_DAY && (!events.has(ev) || events.get(ev).outlets < it.outlets)) events.set(ev, it);
  }
  const topEvents = [...events.entries()].sort((a, b) => b[1].outlets - a[1].outlets).slice(0, TALK_OF_DAY_TOP);
  for (const [ev, it] of topEvents) if (!citedEvents.has(ev)) missedEvents.set(ev, it);
  for (const it of missedEvents.values()) fails.push(`Widely covered (${it.outlets} outlets) but not in the brief: ${it.id} "${(it.title || '').slice(0, 60)}"`);

  const total = allStories(brief).length;
  const maxStories = opts.weekly ? 22 : 18;
  if (total > maxStories) fails.push(`${total} stories in total (max ${maxStories}) — keep the ones that earn their slot`);

  if (otherActions > LIMITS.otherActions) fails.push(`${otherActions} next steps outside Portfolio (max ${LIMITS.otherActions}) — keep only the ones a GP should act on`);

  const text = briefText(brief);
  for (const re of JARGON) { const m = text.match(re); if (m) fails.push(`Internal jargon or tracker data: "${m[0]}"`); }

  const mins = readMinutes(brief);
  const maxRead = opts.weekly ? 12 : LIMITS.readMinutes;
  if (mins > maxRead) fails.push(`Read time ${mins.toFixed(1)} min (max ${maxRead})`);

  if (opts.weekly) {
    const wa = hydrated.weekAhead || [];
    if (wa.length > 6) fails.push(`Week ahead: ${wa.length} entries (max 6)`);
    wa.forEach((w, i) => {
      const tag = `Week ahead #${i + 1}`;
      if (!w.when || !w.what) fails.push(`${tag}: needs "when" and "what"`);
      if ((w.what || '').length > 90) fails.push(`${tag}: what is ${w.what.length} chars (max 90)`);
      if ((w.why || '').length > 140) fails.push(`${tag}: why is ${w.why.length} chars (max 140)`);
      if (!w.sources?.length) fails.push(`${tag}: no source`);
    });
  }

  const count = Object.fromEntries(PURPOSES.map((p) => [p.key, (brief[p.key] || []).length]));
  return {
    hydrated, fails, warns,
    stats: { stories: allStories(brief).length, actions: actionsOf(brief).length, ...count, deals: (brief.deals || []).length, companies: companies.size, readMinutes: +mins.toFixed(1), words: words(text), itemsUsed: used.size },
  };
}

const WEIGHTS = { firstScreen: 2, relevance: 2, impact: 2, coverage: 1, novelty: 1, credibility: 1, signalToNoise: 1, clarity: 1 };
export const CRITERIA = Object.keys(WEIGHTS);
// Pass mark (owner's decision, Nov 17): easier than the original 4.0 / floor 3,
// which no live draft reached. "Would open tomorrow" is reported, not blocking.
export const PASS = { weighted: 3.5, floor: 2 };

export function decide(checks, judge) {
  const s = judge?.scores || {};
  const missingScores = CRITERIA.filter((k) => typeof s[k] !== 'number');
  const wsum = CRITERIA.reduce((a, k) => a + (s[k] || 0) * WEIGHTS[k], 0);
  const weighted = +(wsum / CRITERIA.reduce((a, k) => a + WEIGHTS[k], 0)).toFixed(2);
  const lowest = CRITERIA.reduce((m, k) => Math.min(m, s[k] ?? 0), 5);
  const reasons = [];
  if (checks.fails.length) reasons.push(`${checks.fails.length} automatic check failure(s)`);
  if (missingScores.length) reasons.push(`judge did not score: ${missingScores.join(', ')}`);
  if (weighted < PASS.weighted) reasons.push(`GP-value score ${weighted} < ${PASS.weighted}`);
  if (lowest < PASS.floor) reasons.push(`a criterion scored ${lowest} (floor ${PASS.floor})`);
  return { pass: reasons.length === 0, weighted, lowest, reasons };
}
