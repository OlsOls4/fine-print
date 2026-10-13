import { rulesBlocks, stripTags, toBlocks, slice } from './text.js';
import { findDeadline } from './deadline.js';
import { detect, judging } from './detectors.js';

export function normaliseUrl(input) {
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!host.endsWith('.devpost.com') || host === 'www.devpost.com' || host === 'secure.devpost.com' || host === 'devpost.com') return null;
  const slug = host.replace(/\.devpost\.com$/, '');
  return { slug, root: `https://${host}/`, rules: `https://${host}/rules` };
}

export function analyse({ slug, root }, overviewHtml, rulesHtml) {
  const title = (overviewHtml.match(/"@type":\s*"Event",\s*"name":\s*"([^"]+)"/) || [])[1]
    || stripTags((overviewHtml.match(/<title>([^<:]+)/) || [, slug])[1]);
  const blocks = rulesHtml ? rulesBlocks(rulesHtml) : [];
  const items = blocks.length ? detect(blocks) : [];
  // Submission requirements are sometimes only spelled out on the overview page.
  const reqHtml = slice(overviewHtml, /id="challenge-requirements"/i, /<\/article>/i);
  if (reqHtml) {
    const missing = ['video', 'repo', 'files', 'description'].filter((id) => !items.some((i) => i.id === id));
    for (const extra of detect(toBlocks(reqHtml), missing)) {
      extra.quotes.forEach((q) => (q.source = 'overview'));
      items.push(extra);
    }
  }
  // The overview's "Who can participate" box often states the age plainly.
  const ages = overviewHtml.match(/Ages\s+(\d+)\+\s*only/i);
  const age = items.find((i) => i.id === 'age');
  if (ages && age && !/\d/.test(age.title)) {
    age.title = `You must be ${ages[1]}+`;
    age.quotes.push({ text: ages[0], highlight: ages[0], source: 'overview' });
  }
  return {
    slug,
    title: stripTags(title),
    url: root,
    rulesUrl: `${root}rules`,
    submitUrl: `${root}challenges/start_a_submission`,
    deadline: findDeadline(overviewHtml) || findDeadline(rulesHtml || ''),
    rulesFound: blocks.length > 5,
    items,
    judging: judging(overviewHtml, blocks),
  };
}

async function get(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'FinePrint/1.0 (+https://github.com/OlsOls4/fine-print)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.text();
}

export async function scan(input) {
  const target = normaliseUrl(input || '');
  if (!target) return { error: 'not_devpost', message: 'Fine Print reads Devpost hackathons for now (links like https://name.devpost.com).' };
  let overview;
  try {
    overview = await get(target.root);
  } catch (e) {
    return { error: 'unreadable', message: e.status === 404 ? "That hackathon doesn't seem to exist on Devpost." : "Couldn't read that page just now." };
  }
  let rules = '';
  try { rules = await get(target.rules); } catch { /* handled as rulesFound:false */ }
  return analyse(target, overview, rules);
}
