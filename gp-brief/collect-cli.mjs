#!/usr/bin/env node
// Step 1 of a run on its own, so the site can show progress by step:
// collect the news pool into <work>/items.json; run.mjs then reads it.
//
//   node gp-brief/collect-cli.mjs <work dir>
import fs from 'node:fs';
import path from 'node:path';
import { collect } from './collect.mjs';

const work = path.resolve(process.argv[2] || '.');
fs.mkdirSync(work, { recursive: true });
const { items } = await collect({ log: (...m) => console.error('[gp-brief]', ...m) });
if (!items.length) { console.error('[gp-brief] ERROR empty news pool — check collector sources'); process.exit(1); }
fs.writeFileSync(path.join(work, 'items.json'), JSON.stringify(items, null, 2));
fs.writeFileSync(path.join(work, 'collected-at.txt'), new Date().toISOString());
console.error(`[gp-brief] news pool: ${items.length} items`);
