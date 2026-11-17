// Refresh relay for the M31 briefs site (a Cloudflare Worker, free plan).
//
// The site is static (GitHub Pages), so it cannot start a GitHub Actions run
// itself without exposing a token. The Refresh button posts here instead; this
// Worker holds the token, checks the password and a cooldown, and starts the
// Daily Brief or Fringe Weekly workflow.
//
// Settings → Variables and Secrets on the Worker:
//   GITHUB_TOKEN      (secret)  fine-grained token: this repo only, "Actions: Read and write"
//   REFRESH_PASSWORD  (secret)  password readers type (e.g. M31); leave unset for no password
//   REPO              (text)    YYINUS/M31WebTool
//   ALLOWED_ORIGIN    (text)    https://yyinus.github.io
//   COOLDOWN_MINUTES  (text)    optional, default 15: minimum gap between refreshes

const WORKFLOWS = { daily: 'daily.yml', fringe: 'fringe.yml' };

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || 'https://yyinus.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const workflow = WORKFLOWS[body.report];
    if (!workflow) return json({ error: 'Unknown report' }, 400);
    if (env.REFRESH_PASSWORD && body.password !== env.REFRESH_PASSWORD) return json({ status: 'wrong-password' }, 401);

    const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${env.REPO}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'm31-briefs-refresh',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });

    // One run at a time, and not more often than the cooldown (each run calls the Claude API).
    const runsRes = await gh(`actions/workflows/${workflow}/runs?per_page=1`);
    if (!runsRes.ok) return json({ status: 'error', detail: `GitHub ${runsRes.status}` }, 502);
    const last = (await runsRes.json()).workflow_runs?.[0];
    if (last && last.status !== 'completed') return json({ status: 'running', startedAt: last.run_started_at || last.created_at });
    const cooldownMs = Number(env.COOLDOWN_MINUTES || 15) * 60000;
    const since = last ? Date.now() - Date.parse(last.created_at) : Infinity;
    if (since < cooldownMs) return json({ status: 'cooldown', minutes: Math.ceil((cooldownMs - since) / 60000) }, 429);

    const res = await gh(`actions/workflows/${workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: env.BRANCH || 'main' }) });
    if (res.status !== 204) return json({ status: 'error', detail: `GitHub ${res.status}` }, 502);
    return json({ status: 'started', at: new Date().toISOString() }, 202);
  },
};
