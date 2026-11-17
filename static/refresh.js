// "Refresh" button for the published briefs.
//
// With a refresh relay configured (data-endpoint, see worker/refresh-worker.js),
// the reader refreshes right here: type the password, click Refresh now, and
// the page follows the run and opens the new edition when it is published.
// Without one, the panel links to the workflow on GitHub instead.
(function () {
  var NAME = { daily: 'brief', fringe: 'issue' };
  var INK = '#0a0a0a', FAINT = '#6b6b6b', BODY = '#404040', AMBER = '#b45309', RED = '#991b1b';
  var SANS = 'Inter,-apple-system,Roboto,Helvetica,Arial,sans-serif';
  var POLL_MS = 30000;

  function ago(iso) {
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    return h < 48 ? h + ' h ago' : Math.round(h / 24) + ' days ago';
  }

  function latestRun(el) {
    return fetch(el.dataset.runs + '&_=' + Date.now(), { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return (j.workflow_runs || [])[0] || null; });
  }

  function setup(el) {
    var report = el.dataset.report || 'daily';
    var noun = NAME[report] || 'brief';
    var endpoint = el.dataset.endpoint || '';
    el.style.cssText = 'position:relative;display:inline-block;font-family:' + SANS + ';';
    var inSite = endpoint
      ? '<p style="margin:0;">Gathers the latest news and rewrites this ' + noun + '. It takes about 15 minutes; this page opens the new edition when it is ready.</p>' +
        '<form class="go" style="margin:10px 0 0;">' +
        '<label style="display:block;font-weight:600;color:' + INK + ';margin-bottom:4px;" for="rf-pass-' + report + '">Password</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<input id="rf-pass-' + report + '" type="password" autocomplete="current-password" style="flex:1 1 120px;min-height:36px;padding:0 10px;border:1.5px solid #d4d4d4;border-radius:3px;font:inherit;">' +
        '<button type="submit" style="min-height:36px;padding:0 12px;border:0;border-radius:3px;background:' + INK + ';color:#fff;font:600 13px ' + SANS + ';cursor:pointer;">Refresh now</button></div></form>'
      : '<p style="margin:0;">A refresh gathers the latest news and rewrites this ' + noun + '. It takes about 15 minutes; then reload this page.</p>' +
        '<p style="margin:8px 0 0;color:' + FAINT + ';">Starting one needs write access to the GitHub repository: open it and click <strong style="color:' + INK + ';">Run workflow</strong>.</p>' +
        '<a href="' + el.dataset.runUrl + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;padding:8px 12px;border-radius:3px;background:' + INK + ';color:#fff;font-weight:600;text-decoration:none;">Start a refresh on GitHub →</a>';
    el.innerHTML =
      '<button type="button" class="open" aria-expanded="false" style="min-height:32px;padding:0 12px;border:1.5px solid ' + INK + ';border-radius:3px;background:#fff;color:' + INK + ';font:600 12px/1 ' + SANS + ';cursor:pointer;">' +
      '<span aria-hidden="true">↻</span> <span class="badge">Refresh</span></button>' +
      '<div class="panel" hidden style="position:absolute;right:0;top:40px;z-index:5;width:min(320px,86vw);padding:14px 16px;background:#fff;border:1px solid #e5e5e5;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:13px;line-height:1.5;color:' + BODY + ';text-align:left;">' +
      '<div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:' + INK + ';margin-bottom:6px;">Get a fresh edition</div>' +
      inSite +
      '<p class="line" role="status" aria-live="polite" style="margin:10px 0 0;color:' + FAINT + ';">Checking the latest run…</p></div>';

    var open = el.querySelector('.open'), panel = el.querySelector('.panel');
    var line = el.querySelector('.line'), badge = el.querySelector('.badge'), form = el.querySelector('.go');
    var polling = null;

    function say(html, color) { line.innerHTML = html; line.style.color = color || FAINT; }

    // Follow the run; when it has published, open the newest edition.
    function follow(startedAt) {
      badge.textContent = 'Refreshing…';
      if (form) form.hidden = true;
      if (polling) return;
      var tick = function () {
        latestRun(el).then(function (run) {
          if (!run) return;
          if (run.status !== 'completed') {
            say('<strong style="color:' + AMBER + ';">Refreshing</strong> — started ' + ago(run.run_started_at || run.created_at) + '. This page will open the new edition when it is published.');
            return;
          }
          if (Date.parse(run.created_at) < Date.parse(startedAt) - 120000) return; // the new run is not listed yet
          clearInterval(polling); polling = null;
          if (run.conclusion === 'success') {
            say('<strong style="color:' + INK + ';">New edition published.</strong> Opening it…', INK);
            setTimeout(function () { location.href = el.dataset.latest + '?v=' + Date.now(); }, 45000); // let the site's cache catch up
          } else {
            badge.textContent = 'Refresh';
            if (form) form.hidden = false;
            say('This refresh did not publish a new edition (' + run.conclusion + '). The current ' + noun + ' stays up. <a href="' + run.html_url + '" style="color:' + INK + ';">Details</a>', RED);
          }
        }).catch(function () {});
      };
      tick();
      polling = setInterval(tick, POLL_MS);
    }

    function status() {
      latestRun(el).then(function (run) {
        if (!run) { say('No refresh has run yet.'); return; }
        if (run.status !== 'completed') { follow(run.created_at); return; }
        if (run.conclusion === 'success') say('Last refresh finished ' + ago(run.updated_at) + '.');
        else say('Last refresh did not publish (' + run.conclusion + ', ' + ago(run.updated_at) + '). <a href="' + run.html_url + '" style="color:' + INK + ';">See why</a>');
      }).catch(function () { say('Could not load refresh status right now.'); });
    }

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      btn.disabled = true;
      say('Starting a refresh…');
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: report, password: form.querySelector('input').value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (j) {
          btn.disabled = false;
          if (j.status === 'started') follow(j.at || new Date().toISOString());
          else if (j.status === 'running') follow(j.startedAt || new Date().toISOString());
          else if (j.status === 'wrong-password') say('That password is not right.', RED);
          else if (j.status === 'cooldown') say('This ' + noun + ' was refreshed a few minutes ago. Try again in ' + j.minutes + ' min.', AMBER);
          else say('Could not start a refresh right now (' + (j.detail || 'error') + '). Try again shortly.', RED);
        })
        .catch(function () { btn.disabled = false; say('Could not reach the refresh service. Try again shortly.', RED); });
    });

    open.addEventListener('click', function () {
      var show = panel.hidden;
      panel.hidden = !show;
      open.setAttribute('aria-expanded', String(show));
      if (show) { if (!polling) status(); var i = panel.querySelector('input'); if (i && !form.hidden) i.focus(); }
    });
    document.addEventListener('click', function (e) { if (!el.contains(e.target)) { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); } });
    status(); // a refresh already running shows on the button
  }

  document.querySelectorAll('.refresh').forEach(setup);
})();
