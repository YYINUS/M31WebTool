// "Refresh" button for the published briefs — everything happens on the page.
//
// The reader types the password and clicks Refresh now. The request goes to
// the refresh relay (data-endpoint, worker/refresh-worker.js), which starts the
// run; the page then follows it step by step (from GitHub's public run data),
// keeps the current edition on screen, and opens the new one when published.
// Without a relay configured, the button is not shown.
(function () {
  var NAME = { daily: 'brief', weekly: 'weekly brief', fringe: 'issue' };
  var TYPICAL = { daily: 6, weekly: 8, fringe: 10 }; // minutes, for the progress line
  // Workflow step names (reports.yml) → what the reader sees.
  var STAGES = {
    daily: [['Collect news', 'Gathering news'], ['Write and review the brief', 'Writing and reviewing'], ['Publish', 'Publishing']],
    fringe: [['Generate Fringe Weekly', 'Researching and writing'], ['Publish', 'Publishing']],
    weekly: [['Collect news', 'Gathering the week\u2019s news'], ['Write and review the brief', 'Writing and reviewing'], ['Publish', 'Publishing']],
  };
  var INK = '#0a0a0a', FAINT = '#6b6b6b', BODY = '#404040', AMBER = '#b45309', RED = '#991b1b';
  var SANS = 'Inter,-apple-system,Roboto,Helvetica,Arial,sans-serif';
  var POLL_MS = 20000;

  function mins(iso) { return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); }
  function ago(iso) {
    var m = mins(iso);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    return h < 48 ? h + ' h ago' : Math.round(h / 24) + ' days ago';
  }
  function api(url) {
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now(), { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  function setup(el) {
    var endpoint = el.dataset.endpoint || '';
    if (!endpoint) { el.remove(); return; }
    var report = el.dataset.report || 'daily';
    var noun = NAME[report] || 'brief';
    var stages = STAGES[report] || STAGES.daily;
    el.style.cssText = 'position:relative;display:inline-block;font-family:' + SANS + ';';
    el.innerHTML =
      '<button type="button" class="open" aria-expanded="false" style="min-height:32px;padding:0 12px;border:1.5px solid ' + INK + ';border-radius:3px;background:#fff;color:' + INK + ';font:600 12px/1 ' + SANS + ';cursor:pointer;">' +
      '<span aria-hidden="true">↻</span> <span class="badge">Refresh</span></button>' +
      '<div class="panel" hidden style="position:absolute;right:0;top:40px;z-index:5;width:min(320px,86vw);padding:14px 16px;background:#fff;border:1px solid #e5e5e5;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:13px;line-height:1.5;color:' + BODY + ';text-align:left;">' +
      '<div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:' + INK + ';margin-bottom:6px;">Get a fresh edition</div>' +
      '<p class="intro" style="margin:0;">Gathers the latest news and writes a new edition of this ' + noun + ' (about ' + TYPICAL[report] + ' minutes). Keep reading: this page opens the new edition when it is ready.</p>' +
      '<form class="go" style="margin:10px 0 0;">' +
      '<label style="display:block;font-weight:600;color:' + INK + ';margin-bottom:4px;" for="rf-pass-' + report + '">Password</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<input id="rf-pass-' + report + '" type="password" autocomplete="current-password" style="flex:1 1 120px;min-height:36px;padding:0 10px;border:1.5px solid #d4d4d4;border-radius:3px;font:inherit;">' +
      '<button type="submit" style="min-height:36px;padding:0 12px;border:0;border-radius:3px;background:' + INK + ';color:#fff;font:600 13px ' + SANS + ';cursor:pointer;">Refresh now</button></div></form>' +
      '<div class="steps" hidden style="margin:10px 0 0;"></div>' +
      '<p class="line" role="status" aria-live="polite" style="margin:10px 0 0;color:' + FAINT + ';"></p></div>';

    var open = el.querySelector('.open'), panel = el.querySelector('.panel'), form = el.querySelector('.go');
    var line = el.querySelector('.line'), badge = el.querySelector('.badge'), stepsEl = el.querySelector('.steps');
    var polling = null;

    function say(html, color) { line.innerHTML = html; line.style.color = color || FAINT; }

    function drawSteps(current, startedAt) {
      stepsEl.hidden = false;
      stepsEl.innerHTML = stages.map(function (st, i) {
        var done = i < current, now = i === current;
        return '<div style="display:flex;gap:8px;align-items:baseline;padding:2px 0;color:' + (done ? INK : now ? AMBER : FAINT) + ';' + (now ? 'font-weight:600;' : '') + '">' +
          '<span style="width:14px;text-align:center;">' + (done ? '✓' : now ? '●' : '○') + '</span>' +
          'Step ' + (i + 1) + ' of ' + stages.length + ' · ' + st[1] + '</div>';
      }).join('');
      say(mins(startedAt) + ' of about ' + TYPICAL[report] + ' min. The current edition stays on screen until the new one is ready.');
    }

    // Which stage a running run is in, from its jobs' steps.
    function stageOf(run) {
      return api(run.jobs_url).then(function (j) {
        var cur = 0;
        (j.jobs || []).forEach(function (job) {
          if (/deploy/i.test(job.name) && job.status !== 'queued') cur = stages.length - 1;
          (job.steps || []).forEach(function (s) {
            stages.forEach(function (st, i) { if (s.name === st[0] && s.status !== 'queued' && s.status !== 'pending' && s.conclusion !== 'skipped') cur = Math.max(cur, i); });
          });
        });
        return cur;
      }).catch(function () { return 0; });
    }

    function follow(startedAt) {
      badge.textContent = 'Refreshing…';
      form.hidden = true;
      el.querySelector('.intro').hidden = true;
      if (polling) return;
      var tick = function () {
        api(el.dataset.runs).then(function (j) {
          var run = (j.workflow_runs || [])[0];
          if (!run) return;
          if (run.status !== 'completed') {
            return stageOf(run).then(function (cur) { drawSteps(cur, run.run_started_at || run.created_at); });
          }
          if (Date.parse(run.created_at) < Date.parse(startedAt) - 120000) return; // new run not listed yet
          clearInterval(polling); polling = null;
          if (run.conclusion === 'success') {
            drawSteps(stages.length, run.run_started_at || run.created_at);
            say('<strong style="color:' + INK + ';">New edition published.</strong> Opening it…', INK);
            setTimeout(function () { location.href = el.dataset.latest + '?v=' + Date.now(); }, 40000); // let the site's cache catch up
          } else {
            badge.textContent = 'Refresh';
            stepsEl.hidden = true;
            form.hidden = false;
            say('This refresh did not publish a new edition: it did not pass the quality review, or a step failed. The current ' + noun + ' stays up.', RED);
          }
        }).catch(function () {});
      };
      tick();
      polling = setInterval(tick, POLL_MS);
    }

    function status() {
      api(el.dataset.runs).then(function (j) {
        var run = (j.workflow_runs || [])[0];
        if (!run) { say(''); return; }
        if (run.status !== 'completed') { follow(run.created_at); return; }
        if (run.conclusion === 'success') say('Last refreshed ' + ago(run.updated_at) + '.');
        else say('The last refresh (' + ago(run.updated_at) + ') did not publish a new edition.');
      }).catch(function () { say(''); });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      btn.disabled = true;
      say('Starting…');
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: report, password: form.querySelector('input').value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (j) {
          btn.disabled = false;
          if (j.status === 'started') { drawSteps(0, j.at || new Date().toISOString()); follow(j.at || new Date().toISOString()); }
          else if (j.status === 'running') follow(j.startedAt || new Date().toISOString());
          else if (j.status === 'wrong-password') say('That password is not right.', RED);
          else if (j.status === 'cooldown') say('A new edition was started a few minutes ago. Try again in ' + j.minutes + ' min.', AMBER);
          else say('Could not start a refresh right now. Try again shortly.', RED);
        })
        .catch(function () { btn.disabled = false; say('Could not reach the refresh service. Try again shortly.', RED); });
    });

    open.addEventListener('click', function () {
      var show = panel.hidden;
      panel.hidden = !show;
      open.setAttribute('aria-expanded', String(show));
      if (show) { if (!polling) status(); if (!form.hidden) form.querySelector('input').focus(); }
    });
    document.addEventListener('click', function (e) { if (!el.contains(e.target)) { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); } });
    status(); // a run already in progress shows on the button
  }

  document.querySelectorAll('.refresh').forEach(setup);
})();
