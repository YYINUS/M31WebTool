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
//   FRINGE_CRON       (text)    optional, default "17 13 * * 5": the cron below that runs the Fringe Weekly
//   WEEKLY_CRON       (text)    optional, default "45 19 * * 5": the cron below that runs the Weekly Brief
//
// Triggers → Cron Triggers on the Worker: the schedule for ready-made editions
// (Cloudflare's clock is reliable; GitHub's own schedule often fires late or not
// at all). Times are UTC. Suggested:
//   10:15 Mon–Fri  "15 10 * * 1-5"   morning edition, ready before 6 am ET
//   19:15 Mon–Fri  "15 19 * * 1-5"   afternoon edition, ~2:15 pm ET (EST; one hour later in EDT)
//   13:17 Fri      "17 13 * * 5"     Fringe Weekly
//   19:45 Fri      "45 19 * * 5"     Weekly Brief, ~2:45 pm ET (EST)

const WORKFLOWS = { daily: 'daily.yml', weekly: 'weekly.yml', fringe: 'fringe.yml' };

function github(env) {
  return (path, init = {}) => fetch(`https://api.github.com/repos/${env.REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'm31-briefs-refresh',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

// Start a workflow unless one is running or one started less than `gapMs` ago.
async function start(env, workflow, gapMs) {
  const gh = github(env);
  const runsRes = await gh(`actions/workflows/${workflow}/runs?per_page=1`);
  if (!runsRes.ok) return { status: 'error', detail: `GitHub ${runsRes.status}`, code: 502 };
  const last = (await runsRes.json()).workflow_runs?.[0];
  if (last && last.status !== 'completed') return { status: 'running', startedAt: last.run_started_at || last.created_at, code: 200 };
  const since = last ? Date.now() - Date.parse(last.created_at) : Infinity;
  if (since < gapMs) return { status: 'cooldown', minutes: Math.ceil((gapMs - since) / 60000), code: 429 };
  const res = await gh(`actions/workflows/${workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: env.BRANCH || 'main' }) });
  if (res.status !== 204) return { status: 'error', detail: `GitHub ${res.status}`, code: 502 };
  return { status: 'started', at: new Date().toISOString(), code: 202 };
}

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

    const r = await start(env, workflow, Number(env.COOLDOWN_MINUTES || 15) * 60000);
    const { code, ...out } = r;
    return json(out, code);
  },

  // Ready-made editions on Cloudflare's clock (see Cron Triggers above).
  async scheduled(event, env, ctx) {
    const workflow = event.cron === (env.FRINGE_CRON || '17 13 * * 5') ? WORKFLOWS.fringe
      : event.cron === (env.WEEKLY_CRON || '45 19 * * 5') ? WORKFLOWS.weekly : WORKFLOWS.daily;
    ctx.waitUntil(start(env, workflow, 60 * 60000));
  },
};
