#!/usr/bin/env node
// Step 1 of a run on its own, so the site can show progress by step.
//
//   node gp-brief/collect-cli.mjs <work dir> [--weekly] [--feed-dir data/feed]
//
// Writes <work>/items.json (the trimmed pool the writer reads), <work>/feed.json
// (everything collected, for the raw feed) and <work>/collected-at.txt.
// --weekly: a 7-day window, and the week's stored raw feed (data/feed/*.json)
// is merged in before trimming, so the Weekly Brief sees everything the daily
// runs saw without repeating a week of searches.
import fs from 'node:fs';
import path from 'node:path';
import { collect, titleKey, trimPool } from './collect.mjs';

const args = process.argv.slice(2);
const work = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const weekly = args.includes('--weekly');
const feedDir = args.includes('--feed-dir') ? args[args.indexOf('--feed-dir') + 1] : 'data/feed';
const log = (...m) => console.error('[gp-brief]', ...m);
fs.mkdirSync(work, { recursive: true });

// What the raw feed keeps: public news fields only (no search query text).
export const feedItem = (it) => ({ title: it.title, source: it.source, url: it.url, publishedAt: it.publishedAt, summary: it.summary, sectorId: it.sectorId, outlets: it.outlets || 1 });

let { items, all } = await collect(weekly ? { hours: 168, longHours: 168, maxPool: 500, log } : { log });
if (weekly && fs.existsSync(feedDir)) {
  const since = Date.now() - 7 * 86400e3;
  const seen = new Set(all.map((it) => titleKey(it.title)));
  let added = 0;
  for (const f of fs.readdirSync(feedDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
    if (Date.parse(f.slice(0, 10)) < since - 86400e3) continue;
    for (const it of JSON.parse(fs.readFileSync(path.join(feedDir, f), 'utf8')).items || []) {
      const k = titleKey(it.title);
      if (!k || seen.has(k) || Date.parse(it.publishedAt) < since) continue;
      seen.add(k); added++;
      all.push({ ...it, id: `w${added}`, eventId: `w${added}` });   // own ids; collected items keep theirs
    }
  }
  all.sort((a, b) => (b.outlets || 1) - (a.outlets || 1));
  items = trimPool(all, 500);
  log(`weekly: merged ${added} items from the week's stored feed → pool of ${items.length}`);
}
if (!items.length) { log('ERROR empty news pool — check collector sources'); process.exit(1); }
fs.writeFileSync(path.join(work, 'items.json'), JSON.stringify(items, null, 2));
fs.writeFileSync(path.join(work, 'feed.json'), JSON.stringify(all.map(feedItem)));
fs.writeFileSync(path.join(work, 'collected-at.txt'), new Date().toISOString());
log(`news pool: ${items.length} items · raw feed: ${all.length} items`);
