// What may leave the private run: the brief as in the shareable copy — no
// "What next" action in readable form — plus run metadata.
//
// If BRIEF_PASSPHRASE is set, the actions are kept, but only as ciphertext
// (`locked`): AES-256-GCM with a key derived from the passphrase by
// PBKDF2-SHA256. The published page decrypts them in the browser for partners
// who enter the passphrase. Without BRIEF_PASSPHRASE the actions are dropped.
import crypto from 'node:crypto';
import { PURPOSES } from './checks.mjs';
import { actionRows } from './render-html.mjs';

export const PBKDF2_ITERATIONS = 600000;

export function lockActions(rows, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(rows), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { v: 1, n: rows.length, ids: rows.map((r) => r.id), iter: PBKDF2_ITERATIONS, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
}

export function publicBrief(hydrated, meta, passphrase = process.env.BRIEF_PASSPHRASE) {
  const b = structuredClone(hydrated);
  const rows = actionRows(b);
  for (const p of PURPOSES) for (const st of b[p.key] || []) delete st.action;
  for (const d of b.deals || []) delete d.action;
  if (passphrase && rows.length) b.locked = lockActions(rows, passphrase);
  return { ...b, meta: { generatedAt: new Date().toISOString(), ...meta } };
}
