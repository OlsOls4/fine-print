// Ask GitHub's public API about a repo: is it public, what licence, which files.
export function parseRepo(input) {
  const s = (input || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) || s.match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export async function checkRepo(input, wanted = [], token) {
  const target = parseRepo(input);
  if (!target) return { error: 'bad_repo', message: 'Paste a GitHub repo like owner/name or its github.com link.' };
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'FinePrint/1.0' };
  if (token) headers.authorization = `Bearer ${token}`;
  const api = `https://api.github.com/repos/${target.owner}/${target.repo}`;
  const r = await fetch(api, { headers, signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return { error: 'not_found', message: "GitHub can't see it. If the rules allow private repos, share it with the judges' address; otherwise make it public." };
  if (r.status === 403 || r.status === 429) return { error: 'rate_limited', message: 'GitHub is rate-limiting us. Try again in a few minutes; you can still tick items by hand.' };
  if (!r.ok) return { error: 'github', message: `GitHub answered ${r.status}.` };
  const info = await r.json();
  let paths = [];
  try {
    const t = await fetch(`${api}/git/trees/${encodeURIComponent(info.default_branch)}?recursive=1`, { headers, signal: AbortSignal.timeout(8000) });
    if (t.ok) paths = ((await t.json()).tree || []).filter((x) => x.type === 'blob').map((x) => x.path);
  } catch { /* empty repo or timeout: files show as missing */ }
  const base = (p) => p.split('/').pop().toLowerCase();
  const files = {};
  for (const f of wanted) {
    const hit = paths.find((p) => base(p) === f.toLowerCase());
    files[f] = hit || null;
  }
  const lic = info.license && info.license.spdx_id && info.license.spdx_id !== 'NOASSERTION' ? info.license : null;
  return {
    repo: info.full_name,
    url: info.html_url,
    public: !info.private,
    license: lic ? { spdx: lic.spdx_id, name: lic.name } : null,
    readme: paths.some((p) => /^readme(\.\w+)?$/i.test(p)),
    files,
    empty: paths.length === 0,
  };
}
