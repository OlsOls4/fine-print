// Fine Print front end: read a hackathon, render the deadline and the
// receipts checklist, remember ticks, and check a GitHub repo.
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('scan-form');
  const input = $('url');
  const btn = $('scan-btn');
  const status = $('status');
  let data = null;
  let state = { ticked: [], repo: '', verified: {} };
  let timer = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = () => `fineprint:${data.slug}`;
  const load = () => {
    try { return JSON.parse(localStorage.getItem(key())) || {}; } catch { return {}; }
  };
  const save = () => localStorage.setItem(key(), JSON.stringify({ ticked: state.ticked, repo: state.repo }));

  function setStatus(msg, isError) {
    status.textContent = msg || '';
    status.classList.toggle('error', !!isError);
    status.classList.toggle('loading', !!msg && !isError);
  }

  // ---------- reading ----------
  async function read(url) {
    btn.disabled = true;
    const steps = ['Reading the overview…', 'Reading the official rules…', 'Finding the parts that disqualify people…'];
    let i = 0;
    setStatus(steps[0]);
    const tick = setInterval(() => setStatus(steps[Math.min(++i, steps.length - 1)]), 900);
    try {
      const r = await fetch(`/api/scan?url=${encodeURIComponent(url)}`);
      const json = await r.json();
      clearInterval(tick);
      if (json.error) { setStatus(json.message, true); return; }
      data = json;
      const saved = load();
      state = { ticked: saved.ticked || [], repo: saved.repo || '', verified: {} };
      setStatus('');
      render();
      history.replaceState(null, '', `?h=${encodeURIComponent(data.slug)}`);
      if (state.repo) { $('repo').value = state.repo; checkRepo(state.repo); }
    } catch {
      clearInterval(tick);
      setStatus("Couldn't reach Fine Print's reader. Check your connection and try again.", true);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- rendering ----------
  function render() {
    document.body.classList.add('has-results');
    $('results').hidden = false;
    $('h-title').textContent = data.title;
    $('h-rules').href = data.rulesUrl;
    renderDeadline();
    renderItems();
    renderJudging();
    $('repo-card').hidden = !data.items.some((i) => i.repoCheck);
    document.title = `${data.title} · Fine Print`;
  }

  function renderDeadline() {
    const el = $('deadline');
    clearInterval(timer);
    if (!data.deadline) {
      el.innerHTML = `<span class="label">Deadline</span><div><div class="local">Not listed</div><div class="orig">Check the hackathon's schedule page.</div></div>`;
      return;
    }
    const d = new Date(data.deadline.iso);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const local = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    el.innerHTML = `
      <span class="label">Submission deadline · your time (${esc(zone.replace(/_/g, ' '))})</span>
      <div><div class="local">${esc(local)}</div><div class="orig">Organiser's time: ${esc(data.deadline.original)}</div></div>
      <div class="count" id="count"></div>
      <button type="button" class="cal" id="cal">＋ Add to calendar</button>`;
    const paint = () => {
      const ms = d - Date.now();
      const c = $('count');
      if (!c) return;
      if (ms <= 0) { c.className = 'count closed'; c.innerHTML = '<b>Closed</b>'; return; }
      const days = Math.floor(ms / 864e5); const hrs = Math.floor((ms % 864e5) / 36e5); const mins = Math.floor((ms % 36e5) / 6e4);
      c.className = 'count';
      c.innerHTML = `<b>${days}d ${hrs}h ${mins}m</b>left`;
    };
    paint();
    timer = setInterval(paint, 30000);
    $('cal').onclick = () => {
      const blob = new Blob([window.makeIcs({ title: data.title, iso: data.deadline.iso, url: data.url })], { type: 'text/calendar' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${data.slug}-deadline.ics`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
  }

  function highlight(text, phrase) {
    const safe = esc(text);
    if (!phrase) return safe;
    const p = esc(phrase.trim());
    const at = safe.indexOf(p);
    return at < 0 ? safe : `${safe.slice(0, at)}<mark>${p}</mark>${safe.slice(at + p.length)}`;
  }

  function isCleared(item) {
    return state.ticked.includes(item.id) || state.verified[item.id] === true;
  }

  function renderItems() {
    const ol = $('items');
    if (!data.items.length) {
      ol.innerHTML = `<li class="item"><div class="item-detail">${data.rulesFound
        ? "No hard requirements matched. That's unusual, so read the rules yourself."
        : "We couldn't find official rules on this page. Read them on Devpost before you build."}</div></li>`;
    } else {
      ol.innerHTML = data.items.map((it) => {
        const done = isCleared(it);
        const v = state.verified[it.id];
        const stamp = v === true ? '<span class="stamp verified">Verified</span>'
          : v && v.missing ? '<span class="stamp missing">Missing</span>'
          : done ? '<span class="stamp ok">Cleared</span>' : '<span class="stamp">DQ risk</span>';
        const quotes = it.quotes.map((q) => `<blockquote class="quote">“${highlight(q.text, q.highlight)}”<cite>${q.source === 'overview' ? 'Hackathon overview' : 'Official rules'}</cite></blockquote>`).join('');
        const fix = v && v.missing ? `<p class="fix">${esc(v.missing)}</p>` : v === true && state.verifiedNote?.[it.id] ? `<p class="fix good">${esc(state.verifiedNote[it.id])}</p>` : '';
        return `<li class="item${done ? ' done' : ''}" data-id="${esc(it.id)}">
          <div class="row">
            <input type="checkbox" id="c-${esc(it.id)}" ${done ? 'checked' : ''} ${v === true ? 'disabled' : ''} aria-label="Mark as done">
            <div><label class="item-title" for="c-${esc(it.id)}">${esc(it.title)}</label>${it.detail ? `<div class="item-detail">${esc(it.detail)}</div>` : ''}</div>
            ${stamp}
          </div>
          ${fix}
          <details class="receipt"><summary>Receipt</summary>${quotes}</details>
        </li>`;
      }).join('');
      ol.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const id = cb.closest('.item').dataset.id;
          state.ticked = cb.checked ? [...new Set([...state.ticked, id])] : state.ticked.filter((x) => x !== id);
          save();
          renderItems();
        });
      });
    }
    const total = data.items.length;
    const cleared = data.items.filter(isCleared).length;
    $('progress').textContent = total ? `${cleared} of ${total} cleared` : '';
    $('meter-fill').style.width = total ? `${(cleared / total) * 100}%` : '0';
    const ready = $('ready');
    ready.hidden = !(total && cleared === total);
    ready.innerHTML = `Every rule cleared. Ready to submit — <a href="${esc(data.url)}" target="_blank" rel="noopener">go to ${esc(data.title)} ↗</a>`;
  }

  function renderJudging() {
    const card = $('judging-card');
    card.hidden = !data.judging.length;
    $('judging').innerHTML = data.judging.map((j) => `<li><b>${esc(j.name)}</b>${j.weight ? `<span class="w">${esc(j.weight)}</span>` : ''}${j.onlyInRules ? '<span class="hidden-rule" title="Listed in the official rules but not on the overview page">Only in the fine print</span>' : ''}<p>${esc(j.description)}</p></li>`).join('');
  }

  // ---------- repo check ----------
  async function checkRepo(repo) {
    const out = $('repo-out');
    const filesItem = data.items.find((i) => i.repoCheck === 'files');
    const files = filesItem ? filesItem.files : [];
    out.innerHTML = '<li class="loading">Asking GitHub…</li>';
    try {
      const r = await fetch(`/api/repo?repo=${encodeURIComponent(repo)}&files=${encodeURIComponent(files.join(','))}`);
      const j = await r.json();
      if (j.error) { out.innerHTML = `<li class="err">${esc(j.message)}</li>`; return; }
      state.repo = repo; save();
      state.verified = {}; state.verifiedNote = {};
      const lines = [];
      lines.push(`<li class="${j.public ? 'y' : 'n'}">${esc(j.repo)} is ${j.public ? 'public' : 'private'}</li>`);
      lines.push(`<li class="${j.license ? 'y' : 'n'}">${j.license ? `Licence detected: ${esc(j.license.name)}` : 'No licence detected'}</li>`);
      lines.push(`<li class="${j.readme ? 'y' : 'n'}">${j.readme ? 'README found' : 'No README'}</li>`);
      for (const f of files) lines.push(`<li class="${j.files[f] ? 'y' : 'n'}">${esc(f)} ${j.files[f] ? `found at ${esc(j.files[f])}` : 'not found'}</li>`);
      out.innerHTML = lines.join('');
      for (const it of data.items) {
        if (it.repoCheck === 'public') {
          state.verified[it.id] = j.public ? true : { missing: 'The repo is private. Make it public on GitHub.' };
          if (j.public) state.verifiedNote[it.id] = `Checked on GitHub: ${j.repo} is public.`;
        }
        if (it.repoCheck === 'license') {
          state.verified[it.id] = j.license ? true : { missing: 'No licence detected. Add a LICENSE file (MIT is the usual pick) so GitHub shows it in About.' };
          if (j.license) state.verifiedNote[it.id] = `Checked on GitHub: ${j.license.name}.`;
        }
        if (it.repoCheck === 'files') {
          const missing = files.filter((f) => !j.files[f]);
          state.verified[it.id] = missing.length ? { missing: `Missing from the repo: ${missing.join(', ')}` } : true;
          if (!missing.length) state.verifiedNote[it.id] = `Checked on GitHub: all ${files.length} files are there.`;
        }
      }
      renderItems();
    } catch {
      out.innerHTML = '<li class="err">Couldn\'t reach GitHub just now. You can still tick items by hand.</li>';
    }
  }

  // ---------- wiring ----------
  form.addEventListener('submit', (e) => { e.preventDefault(); read(input.value); });
  document.querySelectorAll('#examples button').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.url; read(b.dataset.url); }));
  $('repo-form').addEventListener('submit', (e) => { e.preventDefault(); checkRepo($('repo').value.trim()); });

  const h = new URLSearchParams(location.search).get('h');
  if (h && /^[\w-]+$/.test(h)) { input.value = `https://${h}.devpost.com/`; read(input.value); }
})();
