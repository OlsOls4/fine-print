// Requirement detectors. Each one looks for a rule in the official rules text
// and, if found, returns a checklist item WITH the sentence it came from.
// Rule of the house: no quote, no item. Nothing is ever invented.

import { stripTags, toBlocks, toSentences, slice } from './text.js';

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (s) => (s ? (/^\d+$/.test(s) ? parseInt(s, 10) : NUM[s.toLowerCase()]) : undefined);

const find = (sentences, re, not) => sentences.find((s) => re.test(s.text) && !(not && not.test(s.text)));
const hl = (s, re) => {
  const m = s.text.match(re);
  return m ? m[0] : null;
};
const quote = (s, re) => ({ text: s.text, highlight: hl(s, re) });
const listJoin = (a, w = 'or') => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} ${w} ${a[a.length - 1]}`);

const DETECTORS = [
  {
    id: 'video',
    run(S) {
      const lenRe = /(less than|under|no (?:more|longer) than|not (?:to )?exceed|maximum of|up to|shorter than)\s+(?:(\w+)\s+)?\(?(\d+)\)?\s*minutes?/i;
      const hostRe = /(YouTube|Vimeo|Youku|Facebook Video|Loom)/g;
      const lenS = find(S, new RegExp(`video[\\s\\S]*${lenRe.source}|${lenRe.source}`, 'i'), /judges? (are|is) not required/i)
        || find(S, lenRe);
      const hostS = find(S, /(uploaded to|hosted on|posted to|available on)[^.]*(YouTube|Vimeo|Youku)/i) || find(S, /video[^.]*(YouTube|Vimeo|Youku)/i);
      const anyVideo = lenS || hostS || find(S, /(include|submit|provide)[^.]*(demo|demonstration) video/i, /translation/i);
      if (!anyVideo) return null;
      let mins;
      if (lenS) {
        const m = lenS.text.match(lenRe);
        mins = num(m[3]) ?? num(m[2]);
      }
      const hosts = hostS ? [...new Set(hostS.text.match(hostRe) || [])] : [];
      const isPublic = hostS && /public/i.test(hostS.text);
      let title = 'Demo video';
      if (mins) title += ` under ${mins} minutes`;
      if (hosts.length) title += `, ${isPublic ? 'public ' : ''}on ${listJoin(hosts)}`;
      const quotes = [];
      if (lenS) quotes.push(quote(lenS, lenRe));
      if (hostS && hostS !== lenS) quotes.push(quote(hostS, /(publicly visible|public)[^.]*?(YouTube|Vimeo|Youku)|(YouTube|Vimeo|Youku)/i));
      if (!quotes.length) quotes.push(quote(anyVideo, /(demo|demonstration) video/i));
      return { title, detail: 'Judges may only watch the video, so it has to show the project working.', quotes, kind: 'submission' };
    },
  },
  {
    id: 'repo',
    run(S) {
      const re = /(public|publicly accessible)[^.]*(code )?repositor(y|ies)|repositor(y|ies)[^.]*must be public/i;
      const s = find(S, re) || find(S, /(URL|link) to your (code )?repositor/i);
      if (!s) return null;
      const hosts = [...new Set(s.text.match(/GitHub|GitLab|Bitbucket/g) || [])];
      return {
        title: `Public code repository${hosts.length ? ` on ${listJoin(hosts)}` : ''}`,
        quotes: [quote(s, /repository must be public|public[^.]{0,40}repositor(y|ies)|repositor(y|ies)/i)],
        kind: 'repo', repoCheck: 'public',
      };
    },
  },
  {
    id: 'license',
    run(S) {
      const re = /open[- ]source licen[cs]e/i;
      const s = find(S, re, /complies|third[- ]party open source/i);
      if (!s) return null;
      const must = /must|required|shall/i.test(s.text) ? '' : ' (recommended)';
      return { title: `Open-source licence file in the repo${must}`, quotes: [quote(s, /[^.]{0,30}open[- ]source licen[cs]e[^.,]{0,40}/i)], kind: 'repo', repoCheck: 'license' };
    },
  },
  {
    id: 'files',
    run(S) {
      const fileRe = /\b[\w-]+\.(?:md|txt|json|ya?ml|pdf|ipynb)\b/gi;
      const s = S.find((x) => /must|required|shall/i.test(x.text) && /include|contain/i.test(x.text)
        && (x.text.match(fileRe) || []).some((f) => f.toLowerCase() !== 'skill.md'));
      if (!s) return null;
      const files = [...new Set(s.text.match(fileRe).filter((f) => f.toLowerCase() !== 'skill.md'))];
      return {
        title: `Repo must include ${listJoin(files, 'and')}`,
        quotes: [quote(s, /(repository|repo)\s+(must|shall)\s+(include|contain)[^.]*?(\([^)]*\)|$)/i)],
        kind: 'repo', repoCheck: 'files', files,
      };
    },
  },
  {
    id: 'tech',
    run(S) {
      const re = /(must|required to)\s+(?:[\w-]+\s+){0,8}?(use|using|be built (?:with|using)|integrate|incorporate|leverage|utili[sz]e)\b[^.;]*/i;
      const s = find(S, re, /may use|not required|optional|license agreement|subject to|authori[sz]ed/i);
      if (!s) return null;
      const m = s.text.match(re)[0];
      return { title: 'Built with the required tools', detail: m.charAt(0).toUpperCase() + m.slice(1), quotes: [quote(s, re)], kind: 'build' };
    },
  },
  {
    id: 'description',
    run(S) {
      const s = find(S, /include a (text|written) description/i) || find(S, /(text|written) description/i, /depicted|judge based/i);
      return s && { title: 'Text description of what it does', quotes: [quote(s, /(text|written) description[^.]*/i)], kind: 'submission' };
    },
  },
  {
    id: 'testing',
    run(S) {
      const s = find(S, /login credentials|testing instructions|free of charge[^.]*testing/i);
      return s && { title: 'Judges can test it free (add credentials if it needs a login)', quotes: [quote(s, /(must include )?login credentials[^.]*|free of charge[^.]*/i)], kind: 'submission' };
    },
  },
  {
    id: 'new',
    run(S) {
      const re = /newly created during|must be (newly )?(created|built|started) during|new projects? only|created after the (start|beginning)/i;
      const s = find(S, re);
      return s && { title: 'New work only: built during the submission period', detail: 'Disclose any pre-existing code.', quotes: [quote(s, re)], kind: 'build' };
    },
  },
  {
    id: 'age',
    run(S) {
      const re = /age of majority|at least (?:the age of )?(\d{2}|eighteen|eighteen \(18\)) years/i;
      const s = find(S, re);
      if (!s) return null;
      const m = s.text.match(/(\d{2}) years|eighteen/i);
      const age = m ? (m[1] || '18') : null;
      return { title: age ? `You must be ${age}+` : 'You must be of legal age where you live', quotes: [quote(s, re)], kind: 'eligibility' };
    },
  },
  {
    id: 'regions',
    run(S) {
      const places = ['Brazil', 'China', 'Quebec', 'Russia', 'Crimea', 'Cuba', 'Iran', 'North Korea', 'Syria', 'Belarus', 'Venezuela'];
      const s = S.find((x) => /(not open|excluded|ineligible|prohibit|void)/i.test(x.text) && places.filter((p) => x.text.includes(p)).length >= 2);
      if (!s) return null;
      const found = places.filter((p) => s.text.includes(p));
      return { title: `Not open to residents of ${listJoin(found)}`, quotes: [quote(s, new RegExp(`(${found[0]})[\\s\\S]*(${found[found.length - 1]})`))], kind: 'eligibility' };
    },
  },
  {
    id: 'team',
    run(S) {
      const re = /(?:maximum of|up to|no more than|not exceed)\s+(\w+)\s*(?:\(\d+\)\s*)?(?:team )?(?:members|individuals|people|participants)/i;
      const s = find(S, re);
      if (!s) return null;
      const n = num(s.text.match(re)[1]);
      return n ? { title: `Teams of up to ${n}`, quotes: [quote(s, re)], kind: 'eligibility' } : null;
    },
  },
  {
    id: 'english',
    run(S) {
      const s = find(S, /in English|English translation/i);
      return s && { title: 'Everything in English (or translated)', quotes: [quote(s, /[^.,]*English[^.,]*/i)], kind: 'submission' };
    },
  },
  {
    id: 'copyright',
    run(S) {
      const re = /copyrighted music|third[- ]party trademarks/i;
      const s = find(S, re);
      return s && { title: 'No copyrighted music or third-party trademarks in the video', quotes: [quote(s, /[^.,]*(copyrighted music|third[- ]party trademarks)[^.,]*/i)], kind: 'submission' };
    },
  },
];

export function detect(rulesBlocks, only) {
  const S = toSentences(rulesBlocks);
  const items = [];
  for (const d of DETECTORS) {
    if (only && !only.includes(d.id)) continue;
    try {
      const r = d.run(S);
      if (r) items.push({ id: d.id, ...r });
    } catch (e) {
      // A broken detector must never break the scan.
    }
  }
  return items;
}

// Judging criteria from the overview, plus any the official rules add.
export function judging(overviewHtml, rulesBlocks) {
  const region = slice(overviewHtml, /id="judging-criteria"/i, /<\/article>/i);
  const fromOverview = [];
  const liRe = /<li[^>]*>\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(region))) fromOverview.push({ name: stripTags(m[1]), description: stripTags(m[2]) });

  const fromRules = [];
  const start = rulesBlocks.findIndex((b) => /judging criteria|evaluated .*criteria|following .*criteria/i.test(b.text));
  if (start >= 0) {
    for (const b of rulesBlocks.slice(start + 1, start + 25)) {
      const mm = b.text.match(/^([A-Z][\w\/&' -]{2,40}?)\s*(?:\(([^)]*\d+\s*%[^)]*)\))?\s*[:–—-]\s+(.{10,})$/);
      if (/prize|tie[- ]break|substitution|intellectual property/i.test(b.text) && fromRules.length) break;
      if (b.tag.startsWith('h') && fromRules.length) break;
      if (mm && (b.tag === 'li' || b.tag === 'p')) fromRules.push({ name: mm[1].trim(), weight: mm[2] || null, description: mm[3].trim() });
    }
  }
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const base = fromOverview.length ? fromOverview : fromRules;
  const out = base.map((c) => ({ ...c, onlyInRules: false }));
  if (fromOverview.length) {
    for (const r of fromRules) {
      if (!fromOverview.some((o) => norm(o.name) === norm(r.name))) out.push({ ...r, onlyInRules: true });
    }
  }
  return out;
}

export { toBlocks };
