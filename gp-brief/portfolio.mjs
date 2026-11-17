// M31 portfolio — CONFIDENTIAL, so it is NOT stored in this (public) repository.
//
// The list is read at run time from, in order:
//   1. the PORTFOLIO_JSON environment variable (a GitHub Actions secret), or
//   2. gp-brief/portfolio.local.json (git-ignored, for local runs).
// Either holds a JSON array: [{ "name", "aliases": [...], "sectorId", "context" }].
//
// `aliases` drive the daily news search. `context` is INTERNAL: it helps the
// writer judge why a story matters, and is sent only to the Anthropic API —
// never to the page, the repository or the logs. Marks, multiples and
// valuations must never be included.
//
// With no portfolio configured, the brief still runs: the Portfolio section is
// simply empty and says so.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function load() {
  const raw = process.env.PORTFOLIO_JSON
    || (() => {
      const f = path.join(path.dirname(fileURLToPath(import.meta.url)), 'portfolio.local.json');
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    })();
  if (!raw.trim()) return [];
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error('PORTFOLIO_JSON must be a JSON array');
  return list.map((c) => ({ name: c.name, aliases: c.aliases?.length ? c.aliases : [c.name], sectorId: c.sectorId, context: c.context || '' }));
}

export const PORTFOLIO = load();
