#!/usr/bin/env node
// Add a run's raw feed to the day's stored feed (data/feed/<date>.json), so
// every item collected that day is kept, newest collection's counts winning.
//
//   node gp-brief/feed-merge.mjs <work>/feed.json data/feed/<date>.json
import fs from 'node:fs';

const [src, dest] = process.argv.slice(2);
const add = JSON.parse(fs.readFileSync(src, 'utf8'));
const day = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf8')) : { items: [] };
const byUrl = new Map(day.items.map((it) => [it.url, it]));
for (const it of add) byUrl.set(it.url, { ...byUrl.get(it.url), ...it, outlets: Math.max(it.outlets || 1, byUrl.get(it.url)?.outlets || 1) });
const items = [...byUrl.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
const runs = [...(day.runs || []), new Date().toISOString()];
fs.mkdirSync(dest.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ updatedAt: runs.at(-1), runs, items }) + '\n');
console.error(`[gp-brief] raw feed ${dest}: ${items.length} items (${add.length} from this run)`);
