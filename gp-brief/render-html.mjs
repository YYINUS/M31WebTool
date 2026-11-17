// RENDER — the brief as one standalone HTML page in M31's current look
// (black masthead, cream ground, Instrument Serif headlines, Inter body).
// Inline styles throughout so the same file works as an email body.
//
//   First screen  — headline, bottom line, Top 3 (jump links)
//   Four sections by purpose — Portfolio · Regulation · Tech & Funding · Macro
//                   each story: title · brief · impact · source, with a small sector tag
//   Tech & Funding ends with a Funding list (lead investor first)

import { sectorById } from './taxonomy.mjs';
import { CRITERIA, PURPOSES } from './checks.mjs';
import { thesisById, VERDICTS } from './thesis.mjs';
import { PORTFOLIO } from './portfolio.mjs';

// Which portfolio companies a next step is about (for the first-screen list).
const actionCompanies = (text) => PORTFOLIO.filter((c) => [c.name.split(' (')[0], ...c.aliases].some((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text))).map((c) => c.name.split(' (')[0]);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const INK = '#0a0a0a', BODY = '#404040', MUTED = '#5c5c5c', FAINT = '#6b6b6b', RULE = '#e5e5e5', CREAM = '#f8f7f4', PANEL = '#f3f1ec', GOLD = '#c99a3b';
const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const LABEL = `font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;`;
const SEP = `<span style="color:#cfcfcf;"> &nbsp;|&nbsp; </span>`;

const fmtDate = (d, opts) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

const CONF = {
  'confirmed':     { label: 'Confirmed',     fg: '#166534' },
  'single-source': { label: 'Single source', fg: '#92400e' },
  'unconfirmed':   { label: 'Unconfirmed',   fg: '#991b1b' },
  'company-claim': { label: 'Company claim', fg: '#92400e' },
};

function sourceLinks(sources = []) {
  const seen = new Set();
  return sources.filter((s) => (seen.has(s.name) ? false : seen.add(s.name)))
    .map((s) => (s.url ? `<a href="${esc(s.url)}" style="color:${MUTED};text-decoration:underline;">${esc(s.name)}</a>` : esc(s.name)))
    .join(' · ');
}

function numbersBlock(numbers = []) {
  if (!numbers.length) return '';
  const cells = numbers.map((n) => `
    <td class="num" style="vertical-align:top;padding:14px 16px 14px 0;width:${Math.floor(100 / numbers.length)}%;">
      <div style="font-family:${SERIF};font-size:30px;line-height:1;color:${INK};">${esc(n.value)}</div>
      <div style="font-family:${SANS};font-size:12px;line-height:1.35;color:${MUTED};margin-top:6px;">${esc(n.label)}</div>
    </td>`).join('');
  return `<table role="presentation" class="nums" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:22px;border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};"><tr>${cells}</tr></table>`;
}

const storyId = (purpose, i) => `s-${purpose}-${i + 1}`;
const sectorTag = (id) => { const m = sectorById(id) || (SHORT[id] && { label: SHORT[id], color: FAINT }); return m ? `<span style="${LABEL}font-size:10px;color:${m.color};"><span style="display:inline-block;width:6px;height:6px;background:${m.color};margin-right:5px;vertical-align:1px;"></span>${esc(SHORT[id] || m.label)}</span>` : ''; };
const SHORT = { money: 'Digital Money', defi: 'DeFi', web3: 'Web3', ai: 'AI', robotics: 'Robotics', defense: 'Defense', space: 'Space', lifesci: 'Health', energy: 'Energy', food: 'Food', deep: 'Deep Tech', frontier: 'Physics' };

function topBlock(brief, weekly = false) {
  const tops = [];
  for (const p of PURPOSES) (brief[p.key] || []).forEach((st, i) => { if (st.topRank) tops.push({ ...st, purpose: p, i }); });
  tops.sort((a, b) => a.topRank - b.topRank);
  if (!tops.length) return '';
  const rows = tops.map((t) => `
      <tr><td style="vertical-align:top;width:30px;padding:10px 0 0;font-family:${SERIF};font-size:26px;line-height:1;color:${PCOLOR[t.purpose.key]};">${t.topRank}</td>
      <td style="vertical-align:top;padding:10px 0 0;">
        <div style="${LABEL}font-size:10px;color:${PCOLOR[t.purpose.key]};">${esc(t.purpose.label)}${t.company ? ` · ${esc(t.company)}` : ''}</div>
        <a href="#${storyId(t.purpose.key, t.i)}" style="font-family:${SERIF};font-size:20px;line-height:1.2;color:${INK};text-decoration:none;">${esc(t.title)}</a>
        <div style="font-family:${SANS};font-size:14px;line-height:1.45;color:${BODY};margin-top:3px;">${esc(t.impact)}</div>
      </td></tr>`).join('');
  return `
  <div style="background:${PANEL};border-radius:6px;padding:16px 20px 18px;margin:24px 0 0;">
    <div style="${LABEL}color:${INK};">${weekly ? 'Top 3 this week' : 'Top 3 today'}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">${rows}</table>
  </div>`;
}

// Where else in the brief an item appears (for "Full story" links from thesis checks).
function findStory(brief, itemIds = [], skip) {
  for (const p of PURPOSES) {
    if (p.key === skip) continue;
    const i = (brief[p.key] || []).findIndex((s) => (s.itemIds || []).some((id) => itemIds.includes(id)));
    if (i >= 0) return storyId(p.key, i);
  }
  return null;
}

function thesisBlock(st, i, brief) {
  const t = thesisById(st.thesisId) || { title: st.thesisId, claim: '', url: '#', date: '' };
  const v = VERDICTS[st.verdict] || VERDICTS.mixed;
  const when = t.date ? fmtDate(t.date, { month: 'short', year: 'numeric' }) : '';
  const full = findStory(brief, st.itemIds, 'thesis');
  return `
    <article id="${storyId('thesis', i)}" style="padding:18px 0 0;${i ? `border-top:1px solid ${RULE};margin-top:18px;` : ''}">
      <div style="margin-bottom:6px;"><span style="${LABEL}font-size:10px;color:${v.fg};background:${v.bg};padding:3px 7px;border-radius:3px;">${v.label}</span>${st.topRank ? ` <span style="${LABEL}font-size:10px;color:#991b1b;margin-left:6px;">Top ${st.topRank}</span>` : ''}</div>
      <p style="margin:0 0 8px;padding:8px 12px;border-left:3px solid ${PCOLOR.thesis};background:${PANEL};font-family:${SANS};font-size:13px;line-height:1.5;color:${BODY};"><strong style="color:${INK};">M31 said</strong> in <a href="${esc(t.url)}" style="color:${INK};">${esc(t.title)}</a>${when ? ` (${esc(when)})` : ''}: ${esc(t.claim)}</p>
      <h3 style="margin:0;font-family:${SERIF};font-weight:400;font-size:23px;line-height:1.18;color:${INK};">${esc(st.title)}</h3>
      <p style="margin:7px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${BODY};">${esc(st.brief)}</p>
      <p style="margin:8px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK};"><strong>What it means for the call:</strong> ${esc(st.impact)}</p>
      ${st.action ? actionToggle(st.action) : ''}
      <p style="margin:7px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${FAINT};">Source: ${sourceLinks(st.sources)}${full ? ` &nbsp;·&nbsp; <a href="#${full}" style="color:${FAINT};">Full story &darr;</a>` : ''}</p>
    </article>`;
}

// "What next" is hidden by default — a button the reader taps to reveal it —
// so the brief can be shown or forwarded without exposing the firm's actions.
// Closed <details> also stay closed when the page is printed to PDF.
function actionToggle(text) {
  return `<details class="act" style="margin:10px 0 0;"><summary class="actbtn">What next</summary><div style="margin:8px 0 0;padding:9px 12px;background:#fff7e6;border-left:3px solid #b45309;border-radius:2px;font-family:${SANS};font-size:14px;line-height:1.5;color:${INK};">${esc(text)}</div></details>`;
}

// Every next step, portfolio first: { id (story anchor), who, text }.
export function actionRows(brief) {
  const rows = [];
  for (const p of PURPOSES) (brief[p.key] || []).forEach((st, i) => {
    if (!st.action) return;
    // actionWho is stored at generation time (public.mjs), when the portfolio is loaded.
    const named = st.actionWho ? [st.actionWho] : actionCompanies(st.action);
    const who = st.company || (p.key === 'thesis' ? `Thesis: ${thesisById(st.thesisId)?.title || st.thesisId}` : named.length ? named.join(' · ') : p.label);
    rows.push({ id: storyId(p.key, i), who, text: st.action });
  });
  return rows;
}

const actionRowHTML = (r) => `<li style="margin:0 0 10px;list-style:none;padding-left:14px;text-indent:-14px;"><span style="color:#b45309;">&rarr;</span> <a href="#${r.id}" style="color:${INK};font-weight:600;text-decoration:none;">${esc(r.who)}</a> &mdash; ${esc(r.text)}</li>`;

// First screen: every next step in one list, portfolio first, each linking to its story.
function actionsBlock(brief) {
  const rows = actionRows(brief).map(actionRowHTML);
  if (!rows.length) return '';
  return `
  <details class="act" style="margin:16px 0 0;"><summary class="actbtn">What next &middot; ${rows.length} actions</summary>
    <ul style="margin:10px 0 0;padding:12px 16px 2px;border:1.5px solid #b45309;border-radius:6px;background:#fffdf7;font-family:${SANS};font-size:14px;line-height:1.5;color:${BODY};">${rows.join('')}</ul>
  </details>`;
}

function storyBlock(st, purpose, i) {
  const head = [st.company ? `<span style="${LABEL}font-size:11px;color:${INK};">${esc(st.company)}</span>` : '', sectorTag(st.sectorId), st.topRank ? `<span style="${LABEL}font-size:10px;color:#991b1b;">Top ${st.topRank}</span>` : '']
    .filter(Boolean).join(' <span style="color:#cfcfcf;">&nbsp;·&nbsp;</span> ');
  return `
    <article id="${storyId(purpose, i)}" style="padding:18px 0 0;${i ? `border-top:1px solid ${RULE};margin-top:18px;` : ''}">
      <div style="margin-bottom:5px;">${head}</div>
      <h3 style="margin:0;font-family:${SERIF};font-weight:400;font-size:23px;line-height:1.18;color:${INK};">${esc(st.title)}</h3>
      <p style="margin:7px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${BODY};">${esc(st.brief)}</p>
      <p style="margin:8px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK};"><strong>Impact:</strong> ${esc(st.impact)}</p>
      ${st.action ? actionToggle(st.action) : ''}
      ${st.next ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${BODY};"><strong style="color:${INK};">Next:</strong> ${esc(st.next)}</p>` : ''}
      <p style="margin:7px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${FAINT};">Source: ${sourceLinks(st.sources)}</p>
    </article>`;
}

function dealsBlock(deals = []) {
  if (!deals.length) return '';
  const KIND = { round: 'Round', fund: 'New fund', report: 'Report' };
  const rows = deals.map((d) => `<li style="margin:0 0 12px;list-style:none;"><strong style="color:${INK};">${esc(d.firm)}</strong>${d.kind === 'round' ? '' : ` <span style="color:${FAINT};font-size:12px;">${KIND[d.kind]}:</span>`} ${esc(d.text)} <span style="color:${FAINT};font-size:12px;">(${sourceLinks(d.sources)})</span></li>`).join('');
  return `
    <div style="margin:26px 0 0;padding-top:14px;border-top:1px solid ${RULE};">
      <div style="${LABEL}color:${INK};">Funding <span style="font-weight:500;letter-spacing:0.04em;text-transform:none;color:${FAINT};font-size:12px;">&nbsp;Lead investor first</span></div>
      <ul style="margin:12px 0 0;padding:0;font-family:${SANS};font-size:14px;line-height:1.5;color:${BODY};">${rows}</ul>
    </div>`;
}

const PCOLOR = { portfolio: '#0a0a0a', thesis: '#6d28d9', frontier: '#0e7490', regulation: '#991b1b', tech: '#1d4ed8', macro: '#92400e' };
const PNOTE = { portfolio: 'News on M31 companies', thesis: 'Today vs. what we said in public', frontier: 'Frontier science: biology, chemistry, physics, space', regulation: 'Rule changes in M31 sectors', tech: 'Breakthroughs and startup funding', macro: 'Rates, markets, energy, geopolitics, big companies' };

// Weekly edition: dated things to watch next week.
const WEEK_COLOR = '#b8860b';
function weekAheadBlock(brief) {
  const list = brief.weekAhead || [];
  if (!list.length) return '';
  const rows = list.map((w, i) => `
    <tr style="${i ? `border-top:1px solid ${RULE};` : ''}">
      <td style="vertical-align:top;width:96px;padding:12px 12px 12px 0;${LABEL}font-size:11px;color:${WEEK_COLOR};">${esc(w.when)}</td>
      <td style="vertical-align:top;padding:12px 0;">
        <div style="font-family:${SERIF};font-size:20px;line-height:1.2;color:${INK};">${esc(w.what)}</div>
        ${w.why ? `<div style="font-family:${SANS};font-size:14px;line-height:1.5;color:${BODY};margin-top:4px;">${esc(w.why)}</div>` : ''}
        <div style="font-family:${SANS};font-size:12px;color:${FAINT};margin-top:4px;">${sectorTag(w.sectorId)}${w.sectorId ? ' &nbsp;·&nbsp; ' : ''}Source: ${sourceLinks(w.sources)}</div>
      </td></tr>`).join('');
  return `
  <section id="sec-weekahead" style="margin:40px 0 0;">
    <div style="padding-bottom:8px;border-bottom:2px solid ${WEEK_COLOR};display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
      <div style="${LABEL}font-size:12px;color:${WEEK_COLOR};">Week ahead <span style="font-weight:500;letter-spacing:0.04em;text-transform:none;color:${FAINT};font-size:12px;">&nbsp;What to watch next week</span></div>
      <a href="#sections" style="font-family:${SANS};font-size:12px;color:${FAINT};text-decoration:none;white-space:nowrap;">&uarr; Top</a>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows}</table>
  </section>`;
}

function sectionBlock(p, brief) {
  const list = brief[p.key] || [];
  const extra = p.key === 'tech' ? dealsBlock(brief.deals) : '';
  const q = brief[`${p.key}Quiet`];
  const quiet = p.quiet && !list.length && q ? `<p style="margin:14px 0 0;font-family:${SANS};font-size:14px;color:${FAINT};font-style:italic;">${esc(q)}</p>` : '';
  if (!list.length && !extra && !quiet) return '';
  const c = PCOLOR[p.key];
  return `
  <section id="sec-${p.key}" style="margin:40px 0 0;">
    <div style="padding-bottom:8px;border-bottom:2px solid ${c};display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
      <div style="${LABEL}font-size:12px;color:${c};">${esc(p.label)} <span style="font-weight:500;letter-spacing:0.04em;text-transform:none;color:${FAINT};font-size:12px;">&nbsp;${PNOTE[p.key]}</span></div>
      <a href="#sections" style="font-family:${SANS};font-size:12px;color:${FAINT};text-decoration:none;white-space:nowrap;">&uarr; Top</a>
    </div>
    ${list.map((st, i) => (p.key === 'thesis' ? thesisBlock(st, i, brief) : storyBlock(st, p.key, i))).join('')}${quiet}${extra}
  </section>`;
}

// "Refresh" for the published site: starts a new edition through the refresh
// relay (r.endpoint) and opens it when published; without a relay it links to
// the workflow on GitHub. See static/refresh.js and worker/refresh-worker.js.
function refreshButton(r) {
  return `<span class="refresh" data-report="${esc(r.report || 'daily')}" data-runs="${esc(r.runsApi)}" data-run-url="${esc(r.runUrl)}" data-endpoint="${esc(r.endpoint || '')}" data-latest="${esc(r.latest || 'index.html')}"></span><script src="${esc(r.script)}" defer></script>`;
}

// Previous / all / next links for the published archive.
function navBlock(nav) {
  const link = (l, txt) => (l ? `<a href="${esc(l.href)}" style="color:${INK};text-decoration:none;font-weight:600;">${txt}</a>` : '<span></span>');
  return `
    <div style="margin:18px 0 0;padding-top:14px;border-top:1px solid ${RULE};display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:${SANS};font-size:13px;color:${FAINT};">
      ${link(nav.prev, nav.prev ? `&larr; ${esc(nav.prev.label)}` : '')}
      <span>${nav.archive ? `<a href="${esc(nav.archive)}" style="color:${FAINT};">All briefs</a>` : ''}${nav.feed ? ` &nbsp;·&nbsp; <a href="${esc(nav.feed)}" style="color:${FAINT};">Raw feed</a>` : ''}</span>
      ${link(nav.next, nav.next ? `${esc(nav.next.label)} &rarr;` : '')}
    </div>`;
}

// `actions: false` renders the shareable copy: no "What next" content in the file
// at all (the collapsed button only hides it on screen; view-source would show it).
// `nav` (optional, for the published site): { home, archive, prev: {href, label}, next: {href, label} }.
export function renderHTML(brief, { quality, fullDigestUrl = null, readMinutes, poolSize, actions = true, nav = null, weekly = brief?.meta?.edition === 'weekly' } = {}) {
  if (!actions) {
    brief = structuredClone(brief);
    for (const p of PURPOSES) for (const st of brief[p.key] || []) delete st.action;
  }
  const longDate = fmtDate(brief.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  // Weekly edition: "Week of Nov 16 – 20, 2026" (Monday to the Friday it is dated).
  const monday = new Date(Date.parse(brief.date + 'T12:00:00Z') - ((new Date(brief.date + 'T12:00:00Z').getUTCDay() + 6) % 7) * 86400e3).toISOString().slice(0, 10);
  const endDay = Number(brief.date.slice(8, 10));
  const weekEnd = monday.slice(5, 7) === brief.date.slice(5, 7) ? `${endDay}` : fmtDate(brief.date, { month: 'short', day: 'numeric' });
  const weekLabel = `Week of ${fmtDate(monday, { month: 'short', day: 'numeric' })} – ${weekEnd}, ${brief.date.slice(0, 4)}`;
  const EDITION = weekly ? 'Weekly Brief' : 'Daily Brief';
  const shortDate = fmtDate(brief.date, { weekday: 'short', month: 'short', day: 'numeric' });
  const mins = Math.max(1, Math.round(readMinutes || 5));
  const nStories = PURPOSES.reduce((a, p) => a + (brief[p.key] || []).length, 0);
  // When this edition was generated, in Eastern Time: a 6am brief does not reflect 4pm news.
  const gen = brief.meta?.generatedAt || brief.generatedAt;
  const asOf = gen ? `${new Date(gen).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })} · ${new Date(gen).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET` : '';
  const jump = PURPOSES.map((p) => { const n = p.key === 'tech' ? (brief.tech || []).length + (brief.deals || []).length : (brief[p.key] || []).length; if (!n) return ''; const c = PCOLOR[p.key]; return `<a class="chip" href="#sec-${p.key}" style="display:inline-block;margin:0 6px 8px 0;padding:10px 13px;border:1.5px solid ${c};border-left-width:5px;border-radius:3px;background:#fff;color:${c};font-family:${SANS};font-size:13px;font-weight:600;line-height:1;text-decoration:none;white-space:nowrap;">${esc(p.label)} <span style="font-weight:500;color:${FAINT};">${n}</span> &darr;</a>`; }).join('');
  const jumpAll = jump + (weekly && (brief.weekAhead || []).length ? `<a class="chip" href="#sec-weekahead" style="display:inline-block;margin:0 6px 8px 0;padding:10px 13px;border:1.5px solid ${WEEK_COLOR};border-left-width:5px;border-radius:3px;background:#fff;color:${WEEK_COLOR};font-family:${SANS};font-size:13px;font-weight:600;line-height:1;text-decoration:none;white-space:nowrap;">Week ahead <span style="font-weight:500;color:${FAINT};">${brief.weekAhead.length}</span> &darr;</a>` : '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>M31 ${EDITION} — ${esc(weekly ? weekLabel : shortDate)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; background:${CREAM}; -webkit-text-size-adjust:100%; }
  html { scroll-behavior:smooth; }
  a:hover { color:${INK} !important; }
  a.chip:hover { background:${PANEL} !important; }
  summary.actbtn { display:inline-block; list-style:none; cursor:pointer; padding:7px 12px; border:1.5px solid #b45309; border-radius:3px; background:#fff; color:#92400e; font-family:${SANS}; font-size:13px; font-weight:600; line-height:1; user-select:none; }
  summary.actbtn::-webkit-details-marker { display:none; }
  summary.actbtn::after { content:' \\25BE'; }
  details.act[open] > summary.actbtn { background:#fff7e6; }
  details.act[open] > summary.actbtn::after { content:' \\25B4'; }
  summary.actbtn:hover { background:#fff7e6; }
  @media (max-width: 600px) {
    .wrap { padding: 0 !important; }
    .card { padding: 22px 16px 28px !important; border-left:0 !important; border-right:0 !important; border-radius:0 !important; }
    .mast { padding: 16px !important; border-radius:0 !important; }
    .h1 { font-size: 32px !important; }
    .mast-right { display:none !important; }
    .nums tr { display:flex; flex-wrap:wrap; }
    .nums .num { width:50% !important; box-sizing:border-box; }
  }
</style>
</head>
<body style="margin:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(brief.headline)} — ${esc(brief.bottomLine)}</div>
<div class="wrap" style="max-width:720px;margin:0 auto;padding:24px 16px 48px;">

  <div class="mast" style="background:${INK};padding:18px 24px;border-radius:6px 6px 0 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:middle;">
        ${nav?.home ? `<a href="${esc(nav.home)}" style="font-family:${SERIF};font-size:26px;line-height:1;color:#fff;text-decoration:none;">M31 Capital</a>` : `<div style="font-family:${SERIF};font-size:26px;line-height:1;color:#fff;">M31 Capital</div>`}
        <div style="${LABEL}font-size:10px;color:${GOLD};margin-top:6px;">${EDITION} <span style="color:#6b6b6b;">·</span> For Partners</div>
      </td>
      <td class="mast-right" style="vertical-align:middle;text-align:right;font-family:${SANS};font-size:12px;color:#a3a3a3;line-height:1.5;">${asOf ? `Updated ${esc(asOf)}` : esc(shortDate)}<br>Top 3 in 30 sec · full ${mins} min</td>
    </tr></table>
  </div>

  <div class="card" style="background:#fff;border:1px solid ${RULE};border-top:0;border-radius:0 0 6px 6px;padding:30px 36px 36px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px 16px;flex-wrap:wrap;">
      <div style="${LABEL}font-size:10px;color:${FAINT};">The ${EDITION} &nbsp;·&nbsp; ${esc(weekly ? weekLabel : longDate)}${asOf ? ` &nbsp;·&nbsp; <span style="color:${INK};">Updated ${esc(asOf.split(' · ')[1])}</span>` : ''}</div>
      ${nav?.refresh ? refreshButton(nav.refresh) : ''}
    </div>
    <h1 class="h1" style="margin:12px 0 0;font-family:${SERIF};font-weight:400;font-size:40px;line-height:1.08;color:${INK};">${esc(brief.headline)}</h1>
    <p style="margin:14px 0 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${MUTED};">${esc(brief.bottomLine)}</p>
    ${topBlock(brief, weekly)}
    ${actionsBlock(brief)}
    <div id="sections" style="margin:24px 0 0;">
      <div style="${LABEL}font-size:10px;color:${INK};margin-bottom:10px;">Jump to a section</div>
      ${jumpAll}
    </div>

    ${PURPOSES.map((p) => sectionBlock(p, brief)).join('')}
    ${weekly ? weekAheadBlock(brief) : ''}

    ${fullDigestUrl ? `<div style="margin:36px 0 0;padding-top:16px;border-top:1px solid ${RULE};text-align:right;">
      <a href="${esc(fullDigestUrl)}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${INK};text-decoration:none;">Full digest &rarr;</a>
    </div>` : ''}
    ${nav ? navBlock(nav) : ''}
  </div>
</div>
</body>
</html>`;
}

// ── Reviewer's view of the loop ────────────────────────────────────────────
const CRIT_LABEL = { firstScreen: 'First screen ×2', relevance: 'Relevance ×2', impact: 'Impact ×2', coverage: 'Coverage', novelty: 'Novelty', credibility: 'Credibility', signalToNoise: 'Signal/noise', clarity: 'Clarity' };

export function renderQualityReport(brief, rounds, final) {
  const row = (r) => {
    const s = r.judge?.scores || {};
    const cell = (v) => `<td style="padding:6px 8px;text-align:center;color:${v < 3 ? '#991b1b' : v >= 4 ? '#166534' : INK};font-weight:600;">${v ?? '–'}</td>`;
    return `<tr style="border-top:1px solid ${RULE};">
      <td style="padding:6px 8px;font-weight:600;white-space:nowrap;">Draft ${r.round}</td>
      ${CRITERIA.map((k) => cell(s[k])).join('')}
      <td style="padding:6px 8px;text-align:center;font-weight:700;">${r.decision.weighted.toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:center;">${r.checks.fails.length}</td>
      <td style="padding:6px 8px;text-align:center;color:${r.decision.pass ? '#166534' : '#991b1b'};font-weight:700;">${r.decision.pass ? 'PASS' : 'FAIL'}</td>
    </tr>`;
  };
  const list = (title, arr, color = INK) => (arr?.length ? `<p style="margin:10px 0 2px;"><strong>${title}</strong></p><ul style="margin:0;padding-left:18px;color:${color};">${arr.map((x) => `<li>${esc(typeof x === 'string' ? x : `${x.itemId} — ${x.why}`)}</li>`).join('')}</ul>` : '');
  const detail = (r) => `
    <section style="margin-top:28px;padding-top:18px;border-top:2px solid ${INK};">
      <h2 style="font-family:${SERIF};font-weight:400;font-size:26px;margin:0;">Draft ${r.round} — ${r.decision.pass ? 'passed' : 'failed'}</h2>
      <p style="margin:6px 0 0;color:${MUTED};">“${esc(r.brief.headline)}” · ${r.checks.stats.stories} stories (portfolio ${r.checks.stats.portfolio}, thesis ${r.checks.stats.thesis}, regulation ${r.checks.stats.regulation}, tech ${r.checks.stats.tech}, macro ${r.checks.stats.macro}, frontier ${r.checks.stats.frontier}) · ${r.checks.stats.deals} deals · ${r.checks.stats.readMinutes} min read · ${r.checks.stats.itemsUsed} items used</p>
      ${r.decision.reasons.length ? `<p style="margin:8px 0 0;"><strong>Why it failed:</strong> ${esc(r.decision.reasons.join('; '))}</p>` : ''}
      <h3 style="${LABEL}margin:16px 0 6px;">Automatic checks</h3>
      ${r.checks.fails.length ? `<ul style="margin:0;padding-left:18px;color:#991b1b;">${r.checks.fails.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p style="margin:0;color:#166534;">All hard gates passed.</p>'}
      ${r.checks.warns.length ? `<ul style="margin:6px 0 0;padding-left:18px;color:#92400e;">${r.checks.warns.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      <h3 style="${LABEL}margin:16px 0 6px;">GP review</h3>
      <p style="margin:0;font-family:${SERIF};font-style:italic;font-size:19px;">“${esc(r.judge?.verdict || '')}”</p>
      <p style="margin:6px 0 0;">Would open tomorrow: <strong>${r.judge?.openTomorrow ? 'yes' : 'no'}</strong></p>
      ${list('Missed:', r.judge?.missed)}${list('Filler:', r.judge?.filler)}${list('Weak impacts:', r.judge?.weakImpacts, '#92400e')}${list('Fixes requested:', r.judge?.fixes)}
    </section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brief Quality Report — ${esc(brief.date)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;background:${CREAM};font-family:${SANS};font-size:14px;line-height:1.5;color:${INK};} .t{overflow-x:auto;} table{border-collapse:collapse;}</style></head>
<body><div style="max-width:900px;margin:0 auto;padding:32px 16px 60px;">
  <div style="${LABEL}color:${FAINT};">M31 Daily Brief · Quality report · ${esc(brief.date)}</div>
  <h1 style="font-family:${SERIF};font-weight:400;font-size:38px;line-height:1.1;margin:10px 0 0;">${final.pass ? 'Cleared for partners' : 'Held for human review'}</h1>
  <p style="color:${MUTED};margin:8px 0 0;">${rounds.length} draft${rounds.length > 1 ? 's' : ''}. Pass rule: no automatic check failures, GP-value score ≥ 4.0 (first screen, relevance and impact count double), no criterion below 3, and the judge would open tomorrow's issue.</p>
  <div class="t" style="margin-top:20px;background:#fff;border:1px solid ${RULE};border-radius:6px;">
  <table style="width:100%;font-size:13px;">
    <tr style="${LABEL}font-size:10px;color:${FAINT};"><th style="padding:8px;text-align:left;">Version</th>${CRITERIA.map((k) => `<th style="padding:8px 4px;">${CRIT_LABEL[k]}</th>`).join('')}<th>Score</th><th>Check fails</th><th>Result</th></tr>
    ${rounds.map(row).join('')}
  </table></div>
  ${rounds.map(detail).join('')}
</div></body></html>`;
}
