import { rulesBlocks, stripTags, toBlocks, slice, decodeEntities } from './text.js';
import { findDeadline } from './deadline.js';
import { detect, judging, DETECTOR_IDS } from './detectors.js';

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
  // Requirements are often only spelled out on the overview page (short
  // community rules especially), so every detector the rules didn't satisfy
  // gets a second look at the overview's requirements and eligibility boxes.
  const reqHtml = slice(overviewHtml, /id="challenge-requirements"/i, /<\/article>/i).replace(/^[^>]*>/, '');
  const eligHtml = blocks.length > 5 ? '' : slice(overviewHtml, /id="challenge-eligibility"|class="[^"]*eligibility[^"]*"/i, /<\/(section|article)>/i).replace(/^[^>]*>/, '');
  const links = [];
  for (const region of [reqHtml, eligHtml]) {
    if (!region) continue;
    const aRe = /<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let a;
    while ((a = aRe.exec(region))) links.push({ href: decodeEntities(a[1]), text: stripTags(a[2]) });
    const missing = DETECTOR_IDS.filter((id) => !items.some((i) => i.id === id || i.id.startsWith(`${id}-`)));
    for (const extra of detect(toBlocks(region), missing)) {
      extra.quotes.forEach((q) => (q.source = 'overview'));
      items.push(extra);
    }
  }
  // Point a receipt at the organiser's link when the quote names it (forms, external sites).
  for (const it of items) for (const q of it.quotes) {
    const hit = links.find((l) => l.text.length > 3 && q.text.includes(l.text));
    if (hit) q.link = hit.href;
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
    // "light" means the rules page was short or few rules matched: the UI must
    // never claim the entrant is ready to submit on a light read.
    coverage: blocks.length > 40 && items.length >= 5 ? 'full' : 'light',
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
