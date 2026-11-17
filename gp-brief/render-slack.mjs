// Slack version (mrkdwn, for the incoming-webhook poster in lib/slack.ts).
// Fits one phone screen: headline, bottom line, Top 3 with impact, then one
// line per purpose section listing its other story titles, and a link.
import { PURPOSES } from './checks.mjs';

const pre = (s) => (s.company && !s.title.includes(s.company.split(' ')[0]) ? `${esc(s.company)}: ` : '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderSlack(brief, { briefUrl = 'https://m31-dashboard.vercel.app/brief', readMinutes = 5 } = {}) {
  const date = new Date(brief.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  const L = [];
  L.push(`*${esc(brief.headline)}*`);
  L.push(`_M31 Daily Brief · ${date} · full read ${Math.max(1, Math.round(readMinutes))} min_`);
  L.push(esc(brief.bottomLine));

  const tops = PURPOSES.flatMap((p) => (brief[p.key] || []).filter((s) => s.topRank)).sort((a, b) => a.topRank - b.topRank);
  if (tops.length) {
    L.push('', '*Top 3*');
    for (const t of tops) {
      const src = t.sources?.[0];
      L.push(`${t.topRank}. *${pre(t)}${esc(t.title)}*${src?.url ? ` <${src.url}|${esc(src.name)}>` : ''}`);
      L.push(`    _Impact:_ ${esc(t.impact)}`);
    }
  }
  // Actions are left out of Slack on purpose: the channel may be shared; they live behind "What next" in the full brief.
  L.push('');
  for (const p of PURPOSES) {
    const titles = (brief[p.key] || []).filter((s) => !s.topRank).map((s) => pre(s) + esc(s.title));
    if (p.key === 'tech') titles.push(...(brief.deals || []).slice(0, 3).map((d) => `${esc(d.firm)} → ${esc(d.text.replace(/^(co-)?led\s+/, '').split(/[,;—]/)[0])}`));
    if (titles.length) L.push(`• *${p.label}:* ${titles.join(' · ')}`);
  }
  L.push('', `<${briefUrl}|Read the full brief →>`);
  return L.join('\n');
}
