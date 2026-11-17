// Minimal Anthropic Messages API client (no SDK, so this runs with plain node).
//
// Streams the response (server-sent events) so a long answer with thinking
// never hits an HTTP timeout, and returns the JSON object in the text.
// No `temperature`: current Claude models reject non-default sampling values.
const MODEL = process.env.GP_BRIEF_MODEL || 'claude-sonnet-5-5';
const JUDGE_MODEL = process.env.GP_BRIEF_JUDGE_MODEL || MODEL;

export const hasLLM = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function askJSON({ system, user, maxTokens = 48000, judge = false }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: judge ? JUDGE_MODEL : MODEL,
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(900000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);

  let text = '';
  let stopReason = null;
  let buf = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const event = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = event.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (!data) continue;
      const ev = JSON.parse(data);
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
      else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
      else if (ev.type === 'error') throw new Error(`Anthropic stream error: ${ev.error?.message || 'unknown'}`);
    }
  }
  if (stopReason === 'refusal') throw new Error('Model declined the request (stop_reason: refusal)');
  if (stopReason === 'max_tokens') throw new Error('Model output truncated (max_tokens)');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON object in model output');
  return JSON.parse(m[0]);
}

// The item pool, compact, for the writer and the judge.
export const itemsForPrompt = (items) =>
  items.map((it) => `[${it.id}] (${it.sectorId})${it.outlets > 1 ? ` [${it.outlets} outlets]` : ''} ${it.title} — ${it.source}, ${it.publishedAt?.slice(0, 16).replace('T', ' ')}${it.summary ? `\n    ${it.summary.slice(0, 240)}` : ''}`).join('\n');
