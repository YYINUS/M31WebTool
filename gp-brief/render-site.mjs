#!/usr/bin/env node
// Render every published brief (data/daily/<date>.json, written by run.mjs as
// public.json) into the static site, in the approved design, with "What next".
//
//   node gp-brief/render-site.mjs <data dir> <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { renderHTML } from './render-html.mjs';

const [dataDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(dataDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
// The repository whose workflows write new editions (for the Refresh button).
const REPO = process.env.GITHUB_REPOSITORY || 'YYINUS/M31WebTool';
const refresh = {
  runsApi: `https://api.github.com/repos/${REPO}/actions/workflows/daily.yml/runs?per_page=1`,
  runUrl: `https://github.com/${REPO}/actions/workflows/daily.yml`,
  script: '../static/refresh.js',
  endpoint: process.env.REFRESH_ENDPOINT || '',   // the refresh relay (worker/refresh-worker.js)
  latest: 'index.html',                           // where the newest edition lives
};
const label = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

files.forEach((f, i) => {
  const brief = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  const date = f.slice(0, 10);
  const older = files[i + 1]?.slice(0, 10);
  const newer = files[i - 1]?.slice(0, 10);
  const html = renderHTML(brief, {
    actions: true,
    readMinutes: brief.meta?.readMinutes,
    nav: {
      home: '../index.html',
      archive: '../index.html#daily-archive',
      prev: older && { href: `${older}.html`, label: label(older) },
      next: newer && { href: `${newer}.html`, label: label(newer) },
      refresh,
    },
  });
  fs.writeFileSync(path.join(outDir, `${date}.html`), html);
  if (i === 0) fs.writeFileSync(path.join(outDir, 'index.html'), html);
});
console.error(`render-site: ${files.length} daily briefs`);
