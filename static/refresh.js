// "Refresh" button for the published briefs.
//
// A static page cannot start a GitHub Actions run by itself (that would need a
// token in a public page), so the button opens a small panel that links to the
// workflow's "Run workflow" button on GitHub (needs write access to the repo)
// and shows the latest run's status from GitHub's public API.
(function () {
  var COPY = {
    daily: { what: 'A refresh gathers the latest news and writes a new edition of today’s brief. It takes about 15 minutes; then reload this page.', run: 'Start a refresh on GitHub' },
    fringe: { what: 'A refresh rescans this week’s sources and rewrites the issue. It takes about 15 minutes; then reload this page.', run: 'Start a refresh on GitHub' },
  };
  var INK = '#0a0a0a', FAINT = '#6b6b6b', BODY = '#404040', AMBER = '#b45309';
  var SANS = 'Inter,-apple-system,Roboto,Helvetica,Arial,sans-serif';

  function ago(iso) {
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    return h < 48 ? h + ' h ago' : Math.round(h / 24) + ' days ago';
  }

  function status(el, line, badge) {
    fetch(el.dataset.runs, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var run = (j.workflow_runs || [])[0];
        if (!run) { line.textContent = 'No refresh has run yet.'; return; }
        if (run.status !== 'completed') {
          line.innerHTML = '<strong style="color:' + AMBER + ';">A refresh is running</strong> (started ' + ago(run.run_started_at || run.created_at) + '). Reload this page when it finishes.';
          badge.textContent = 'Refreshing…';
        } else if (run.conclusion === 'success') {
          line.textContent = 'Last refresh finished ' + ago(run.updated_at) + '.';
        } else {
          line.innerHTML = 'Last refresh did not publish (' + run.conclusion + ', ' + ago(run.updated_at) + '). <a href="' + run.html_url + '" style="color:' + INK + ';">See why</a>';
        }
      })
      .catch(function () { line.textContent = 'Could not load refresh status right now.'; });
  }

  document.querySelectorAll('.refresh').forEach(function (el) {
    var copy = COPY[el.dataset.report] || COPY.daily;
    el.style.cssText = 'position:relative;display:inline-block;font-family:' + SANS + ';';
    el.innerHTML =
      '<button type="button" aria-expanded="false" style="min-height:32px;padding:0 12px;border:1.5px solid ' + INK + ';border-radius:3px;background:#fff;color:' + INK + ';font:600 12px/1 ' + SANS + ';cursor:pointer;">' +
      '<span aria-hidden="true">↻</span> <span class="badge">Refresh</span></button>' +
      '<div class="panel" hidden style="position:absolute;right:0;top:40px;z-index:5;width:min(320px,86vw);padding:14px 16px;background:#fff;border:1px solid #e5e5e5;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:13px;line-height:1.5;color:' + BODY + ';text-align:left;">' +
      '<div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:' + INK + ';margin-bottom:6px;">Get a fresh edition</div>' +
      '<p style="margin:0;">' + copy.what + '</p>' +
      '<p style="margin:8px 0 0;color:' + FAINT + ';">Starting one needs write access to the GitHub repository: open it and click <strong style="color:' + INK + ';">Run workflow</strong>.</p>' +
      '<a href="' + el.dataset.runUrl + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;padding:8px 12px;border-radius:3px;background:' + INK + ';color:#fff;font-weight:600;text-decoration:none;">' + copy.run + ' →</a>' +
      '<p class="line" role="status" style="margin:10px 0 0;color:' + FAINT + ';">Checking the latest run…</p></div>';
    var btn = el.querySelector('button'), panel = el.querySelector('.panel');
    var line = el.querySelector('.line'), badge = el.querySelector('.badge');
    btn.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) status(el, line, badge);
    });
    document.addEventListener('click', function (e) { if (!el.contains(e.target)) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    status(el, line, badge);
  });
})();
