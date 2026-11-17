// What may leave the private run: the brief as partners see it in the
// shareable copy — no "What next" actions anywhere — plus run metadata.
import { PURPOSES } from './checks.mjs';

export function publicBrief(hydrated, meta) {
  const b = structuredClone(hydrated);
  for (const p of PURPOSES) for (const st of b[p.key] || []) delete st.action;
  for (const d of b.deals || []) delete d.action;
  return { ...b, meta };
}
