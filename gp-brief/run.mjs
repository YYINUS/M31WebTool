#!/usr/bin/env node
// M31 GP Daily Brief — the whole loop.
//
//   COLLECT → DRAFT → CHECK + GP REVIEW → (REVISE → CHECK + REVIEW)… → RENDER → RELEASE or HOLD
//
// Usage:
//   node gp-brief/run.mjs                          # collect live news, run everything (needs network + ANTHROPIC_API_KEY)
//   node gp-brief/run.mjs --items items.json       # use an existing news pool instead of collecting
//   node gp-brief/run.mjs --work dir               # drafts, reviews and outputs (default gp-brief/out/<date>)
//   node gp-brief/run.mjs --max-rounds 3 --date 2026-11-02
//
// Without ANTHROPIC_API_KEY the loop runs in "manual" mode: it reads draft and
// review files from --work (brief.r1.json, judge.r1.json, brief.r2.json, …)
// and stops, naming the file it needs next.

import fs from 'node:fs';
import path from 'node:path';
import { collect } from './collect.mjs';
import { DRAFT_SYSTEM as DAILY_DRAFT, JUDGE_SYSTEM as DAILY_JUDGE, WEEKLY_ADDENDUM, WEEKLY_JUDGE_ADDENDUM, REVISE_USER, draftUser, judgeUser } from './prompts.mjs';
import { askJSON, hasLLM, itemsForPrompt } from './llm.mjs';
import { runChecks, decide } from './checks.mjs';
import { renderHTML, renderQualityReport } from './render-html.mjs';
import { renderSlack } from './render-slack.mjs';
import { publicBrief } from './public.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

const date = args.date || new Date().toISOString().slice(0, 10);
const work = path.resolve(args.work || path.join('gp-brief', 'out', date));
const maxRounds = Number(args['max-rounds'] || 3);
const manual = !hasLLM();
// --weekly: the Friday edition (same pipeline, weekly prompts and checks).
const weekly = Boolean(args.weekly);
const DRAFT_SYSTEM = weekly ? DAILY_DRAFT + WEEKLY_ADDENDUM : DAILY_DRAFT;
const JUDGE_SYSTEM = weekly ? DAILY_JUDGE + WEEKLY_JUDGE_ADDENDUM : DAILY_JUDGE;
fs.mkdirSync(work, { recursive: true });

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
const file = (name) => path.join(work, name);
const log = (...m) => console.error('[gp-brief]', ...m);
const need = (name, what) => { log(`MANUAL MODE — waiting for ${what}: ${file(name)}`); process.exit(3); };

const FAIL_TYPES = [
  ['not in the news pool', 'cites unknown item'], ['stories (max', 'too many stories'], ['stories (min', 'too few stories'],
  ['not an M31 portfolio company', 'non-portfolio company'], ['needs a GP next step', 'missing action'], ['not a concrete step', 'vague action'],
  ['prints tracker data', 'tracker data in action'], ['repeats the brief', 'impact repeats brief'], ['what happens next', 'missing next'],
  ['unknown sector', 'unknown sector'], ['unknown thesis', 'unknown thesis'], ['verdict must be', 'bad verdict'], ['chars (max', 'too long'],
  ['sentences (max', 'too many sentences'], ['confidence not labeled', 'no confidence'], ['no source', 'no source'], ['h old', 'stale source'],
  ['used twice', 'item used twice'], ['duplicate stories', 'duplicate story'], ['Top 3', 'top 3'], ['Widely covered', 'missed widely covered event'],
  ['next steps outside', 'too many actions'], ['stories in total', 'too many stories in total'], ['jargon', 'jargon'], ['Read time', 'read time'], ['quiet', 'missing quiet line'],
];
const failureTypes = (fails) => {
  const n = {};
  for (const f of fails) { const t = (FAIL_TYPES.find(([k]) => f.includes(k)) || [, 'other'])[1]; n[t] = (n[t] || 0) + 1; }
  return Object.entries(n).map(([t, c]) => `${t} ×${c}`).join(', ');
};

async function main() {
  // 1 — COLLECT (the brief's "Updated" time is when its news was gathered)
  // (when collect-cli.mjs ran as its own step, its time is in collected-at.txt)
  const collectedAt = fs.existsSync(file('collected-at.txt')) ? fs.readFileSync(file('collected-at.txt'), 'utf8').trim() : new Date().toISOString();
  let items;
  if (args.items) items = readJSON(path.resolve(args.items));
  else if (fs.existsSync(file('items.json'))) items = readJSON(file('items.json'));
  else ({ items } = await collect({ log }));
  items.forEach((it, i) => { it.id = it.id || `n${i + 1}`; });
  writeJSON(file('items.json'), items);
  if (items.length === 0) throw new Error('Empty news pool — check collector sources');
  const pool = itemsForPrompt(items);
  log(`news pool: ${items.length} items`);

  // 2..3 — DRAFT, CHECK, REVIEW, REVISE
  const rounds = [];
  for (let r = 1; r <= maxRounds; r++) {
    const bf = file(`brief.r${r}.json`);
    let brief;
    if (fs.existsSync(bf)) brief = readJSON(bf);
    else if (manual) need(`brief.r${r}.json`, r === 1 ? 'the first draft' : `revision ${r}`);
    else if (r === 1) brief = await askJSON({ system: DRAFT_SYSTEM, user: draftUser({ date, items, pool }) });
    else {
      const prev = rounds[r - 2];
      const u = draftUser({ date, items, pool });
      brief = await askJSON({ system: DRAFT_SYSTEM, user: { cached: u.cached, rest: `${u.rest}\n\n${REVISE_USER(prev.brief, prev.judge, prev.checks.fails)}` } });
    }
    brief.date = brief.date || date;
    writeJSON(bf, brief);

    const checks = runChecks(brief, items, { weekly });
    writeJSON(file(`checks.r${r}.json`), { fails: checks.fails, warns: checks.warns, stats: checks.stats });
    log(`draft ${r}: ${checks.stats.stories} stories (P${checks.stats.portfolio} Th${checks.stats.thesis} R${checks.stats.regulation} T${checks.stats.tech} M${checks.stats.macro} F${checks.stats.frontier}) + ${checks.stats.deals} deals · ${checks.stats.readMinutes} min · ${checks.fails.length} check failures`);

    const jf = file(`judge.r${r}.json`);
    let judge;
    if (fs.existsSync(jf)) judge = readJSON(jf);
    else if (manual) need(`judge.r${r}.json`, `the GP review of draft ${r}`);
    else judge = await askJSON({ system: JUDGE_SYSTEM, user: judgeUser({ hydrated: checks.hydrated, pool }), judge: true });
    writeJSON(jf, judge);

    const decision = decide(checks, judge);
    log(`draft ${r}: GP-value ${decision.weighted} → ${decision.pass ? 'PASS' : 'FAIL (' + decision.reasons.join('; ') + ')'}`);
    // Diagnostics safe for public logs: failure TYPES (no text) and the judge's numeric scores.
    if (checks.fails.length) log(`draft ${r}: check failures by type: ${failureTypes(checks.fails)}`);
    // The reviewer's own words, to tune the writer (brief content only: What next is not treated as confidential).
    if (judge?.verdict) log(`draft ${r}: GP verdict: ${judge.verdict}`);
    for (const f of (judge?.fixes || []).slice(0, 5)) log(`draft ${r}: GP fix: ${String(f).slice(0, 240)}`);
    if (judge?.scores) log(`draft ${r}: GP scores ${Object.entries(judge.scores).map(([k, v]) => `${k} ${v}`).join(', ')} · open tomorrow: ${judge.openTomorrow ? 'yes' : 'no'}`);
    rounds.push({ round: r, brief, checks, judge, decision });
    if (decision.pass) break;
  }

  // 4 — RENDER the passing version, else the best-scoring one
  // The passing draft, else the best of the (up to 3) drafts: fewest check failures, then highest score.
  // Owner's rule (Nov 17): never hold — after three versions, the best one goes live.
  const best = rounds.find((x) => x.decision.pass)
    || [...rounds].sort((a, b) => (a.checks.fails.length - b.checks.fails.length) || (b.decision.weighted - a.decision.weighted))[0];
  const final = { pass: best.decision.pass, weighted: best.decision.weighted, rounds: rounds.length, round: best.round };
  const opts = { quality: final, readMinutes: best.checks.stats.readMinutes, poolSize: items.length };
  fs.writeFileSync(file('brief.html'), renderHTML(best.checks.hydrated, { ...opts, weekly, fullDigestUrl: args['digest-url'] }));            // partners only
  fs.writeFileSync(file('brief-share.html'), renderHTML(best.checks.hydrated, { ...opts, weekly, fullDigestUrl: args['digest-url'], actions: false })); // safe to forward
  fs.writeFileSync(file('slack.txt'), renderSlack(best.checks.hydrated, { ...opts, briefUrl: args['brief-url'] }));
  fs.writeFileSync(file('quality-report.html'), renderQualityReport(best.brief, rounds, final));
  writeJSON(file('result.json'), { date, ...final, reasons: best.decision.reasons, stats: best.checks.stats });
  // The only file that may be published: the hydrated brief with every "What next" action removed.
  writeJSON(file('public.json'), publicBrief(best.checks.hydrated, { date, edition: weekly ? 'weekly' : 'daily', generatedAt: collectedAt, ...final, readMinutes: best.checks.stats.readMinutes, poolSize: items.length }));

  // 5 — RELEASE or HOLD. Delivery is lib/slack.ts postToSlack(): slack.txt to
  // the partners' channel on RELEASE, to the reviewer on HOLD.
  log(final.pass ? `RELEASE — draft ${best.round} passed the review` : `RELEASE — best of ${rounds.length} drafts (draft ${best.round}, GP-value ${final.weighted}, ${best.checks.fails.length} check failures) published below the pass mark`);
  console.log(JSON.stringify({ status: 'release', ...final, dir: work }));
}

// Parse errors can quote model output (which may include actions), and CI logs are public.
main().catch((e) => { log('ERROR', e instanceof SyntaxError ? 'model output was not valid JSON' : e.message); process.exit(1); });
