// What the run publishes: the hydrated brief, as partners see it, with its
// "What next" actions, plus run metadata (including when the news was gathered).
// Drafts, GP reviews and the quality report are not published.
//
// Each action also records who it is about (actionWho), worked out now while
// the portfolio is loaded; the site build runs without the portfolio.
import { PURPOSES } from './checks.mjs';
import { actionRows } from './render-html.mjs';

export function publicBrief(hydrated, meta) {
  const b = structuredClone(hydrated);
  const who = new Map(actionRows(b).map((r) => [r.id, r.who]));
  for (const p of PURPOSES) (b[p.key] || []).forEach((st, i) => {
    const id = `s-${p.key}-${i + 1}`;
    if (st.action && !st.company && who.has(id)) st.actionWho = who.get(id);
  });
  return { ...b, meta: { generatedAt: new Date().toISOString(), ...meta } };
}
