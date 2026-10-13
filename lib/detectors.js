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

const WORDNUM = '\\d+|one|two|three|four|five|six|seven|eight|nine|ten';
// Sentences about optional side quests (mini challenges, bonus tracks) must
// never be read as the main submission rule.
const OPTIONAL = /mini[- ]challenge|contribute to an existing|alongside a (?:primary|main) (?:track )?submission|contributions can be/i;
const HOSTS = /GitHub|GitLab|Bitbucket/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

const DETECTORS = [
  {
    id: 'video',
    run(S) {
      const lenRe = new RegExp(`(less than|under|no (?:more|longer) than|not (?:to )?exceed|maximum of|up to|shorter than)\\s+(?:(\\w+)\\s+)?\\(?(${WORDNUM})\\)?[\\s-]*minutes?`, 'i');
      const rangeRe = /(\d+)\s*[-–]\s*(\d+)[\s-]*minutes?\s+(?:long\s+)?(?:demo|demonstration|presentation|pitch|video)/i;
      const parenRe = /video\s*\((?:max(?:imum)?\.?\s*)?(\d+)(?:\s*[-–]\s*(\d+))?\s*min/i;
      const hostRe = /(YouTube|Vimeo|Youku|Facebook Video|Loom)/g;
      const lenS = find(S, new RegExp(`video[\\s\\S]*${lenRe.source}|${lenRe.source}`, 'i'), /judges? (are|is) not required/i)
        || find(S, lenRe) || find(S, rangeRe) || find(S, parenRe);
      const hostS = find(S, /(uploaded to|hosted on|posted to|available on)[^.]*(YouTube|Vimeo|Youku)/i) || find(S, /video[^.]*(YouTube|Vimeo|Youku)/i);
      const anyVideo = lenS || hostS
        || find(S, /(include|submit|provide)[^.]*(demo|demonstration) video/i, /translation/i)
        || find(S, /^(demo|demonstration|pitch) video\b/i);
      if (!anyVideo) return null;
      let mins;
      let lenHl = lenRe;
      if (lenS) {
        const m = lenS.text.match(lenRe);
        if (m) mins = num(m[3]) ?? num(m[2]);
        else if (rangeRe.test(lenS.text)) { mins = num(lenS.text.match(rangeRe)[2]); lenHl = rangeRe; }
        else { const r = lenS.text.match(parenRe); mins = num(r[2] || r[1]); lenHl = parenRe; }
      }
      const hosts = hostS ? [...new Set(hostS.text.match(hostRe) || [])] : [];
      const isPublic = hostS && /public/i.test(hostS.text);
      let title = 'Demo video';
      if (mins) title += ` under ${mins} minutes`;
      if (hosts.length) title += `, ${isPublic ? 'public ' : ''}on ${listJoin(hosts)}`;
      else if (lenS && /public or unlisted|unlisted/i.test(lenS.text)) title += ', public or unlisted';
      const quotes = [];
      if (lenS) quotes.push(quote(lenS, lenHl));
      if (hostS && hostS !== lenS) quotes.push(quote(hostS, /(publicly visible|public)[^.]*?(YouTube|Vimeo|Youku)|(YouTube|Vimeo|Youku)/i));
      if (!quotes.length) quotes.push(quote(anyVideo, /(demo|demonstration|pitch) video/i));
      return { title, detail: 'Judges may only watch the video, so it has to show the project working.', quotes, kind: 'submission' };
    },
  },
  {
    id: 'repo',
    run(S) {
      const eitherRe = /(public|open[- ]source)[^.]{0,120}\bor\b[^.]{0,80}(private|judge-accessible|shared with)/i;
      const either = find(S, eitherRe, OPTIONAL);
      const pub = find(S, /(public|publicly accessible)[^.]*(code )?repositor(y|ies)|repositor(y|ies)[^.]*must be public/i, OPTIONAL);
      const url = find(S, /(URL|link) to your (public )?(code )?repositor|submit (a|your) (GitHub|GitLab|Bitbucket|code) repositor|^(GitHub|GitLab|Bitbucket|code) repositor/i, OPTIONAL);
      const s = either || pub || url;
      if (!s) return null;
      const hosts = [...new Set([s, url].filter(Boolean).filter((x) => !/or equivalent/i.test(x.text)).flatMap((x) => x.text.match(HOSTS) || []))];
      const on = hosts.length ? ` on ${listJoin(hosts)}` : '';
      // The GitHub checker only makes sense when GitHub is an allowed host.
      const githubOk = !hosts.length || hosts.includes('GitHub');
      const quotes = [];
      if (either) {
        const share = /shar(e|ed)( it)? with/i.test(either.text) ? either
          : find(S, /private[^.]*shar(e|ed)( it)? with|shar(e|ed)( it)? with[^.]*private/i, OPTIONAL);
        const withLicence = /licen[cs]|open[- ]source/i.test(either.text.split(/\bor\b/i)[0] + either.text.split(/\bor\b/i)[1])
          && !/not (have to|need to) be open[- ]source/i.test(either.text)
          || S.some((x) => /if the repositor(y|ies) (is|are) public/i.test(x.text) && /licen[cs]e/i.test(x.text));
        const addrs = share ? [...new Set(share.text.match(EMAIL) || [])] : [];
        quotes.push(quote(either, /(public|open[- ]source)[^.]{0,120}\bor\b[^.]{0,80}?(private|judge-accessible)( and shared with)?/i));
        if (share && share !== either) quotes.push(quote(share, /(if the repositor(y|ies) (is|are) private, )?shar(e|ed)( it)? with/i));
        if (url && url !== either && hosts.length) quotes.push(quote(url, /(GitHub|GitLab|Bitbucket)[^.]*/));
        return {
          title: `Code repository${on}: public${withLicence ? ' (with licence)' : ''} or private and shared with judges`,
          detail: addrs.length ? `If it's private, share it with ${listJoin(addrs, 'and')}.` : "If it's private, make sure the judges can open it.",
          quotes, kind: 'repo', repoCheck: githubOk ? 'access' : undefined, shareWith: addrs,
        };
      }
      if (pub) {
        quotes.push(quote(pub, /repository must be public|public[^.]{0,40}repositor(y|ies)|repositor(y|ies)/i));
        if (url && url !== pub && hosts.length && !(pub.text.match(HOSTS))) quotes.push(quote(url, /(GitHub|GitLab|Bitbucket)[^.]*/));
        return { title: `Public code repository${on}`, quotes, kind: 'repo', repoCheck: githubOk ? 'public' : undefined };
      }
      if (/\bpublic\b/i.test(url.text)) {
        return { title: `Public code repository${on}`, quotes: [quote(url, /public[^.]{0,40}/i)], kind: 'repo', repoCheck: githubOk ? 'public' : undefined };
      }
      return {
        title: `Code repository${on} the judges can open`,
        quotes: [quote(url, /(URL|link) to your (public )?(code )?repositor(y|ies)|submit (a|your) (GitHub|GitLab|Bitbucket|code) repositor(y|ies)|^(GitHub|GitLab|Bitbucket|code) repositor(y|ies)[^:]*/i)],
        kind: 'repo', repoCheck: githubOk ? 'access' : undefined, shareWith: [],
      };
    },
  },
  {
    id: 'license',
    run(S) {
      const re = /open[- ]source licen[cs]e/i;
      const not = new RegExp(`complies|third[- ]party open source|${OPTIONAL.source}`, 'i');
      // Prefer the sentence that makes it a requirement.
      const s = find(S, /open[- ]source licen[cs]e[^.]*\b(must|required|shall)\b|\b(must|required|shall)\b[^.]*open[- ]source licen[cs]e/i, not) || find(S, re, not);
      if (!s) return null;
      const must = /must|required|shall/i.test(s.text);
      const ifPublic = /\bor\b[^.]*private|if the repositor(y|ies) (is|are) public/i.test(s.text);
      const suffix = ifPublic ? ' (if the repo is public)' : must ? '' : ' (recommended)';
      return {
        title: `Open-source licence file in the repo${suffix}`,
        quotes: [quote(s, /(by including |include |with )?(an )?open[- ]source licen[cs]e( file)?/i)],
        kind: 'repo', repoCheck: 'license', ifPublic,
      };
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
      const re = /(text|written) description[^.]*|^(one[- ]page )?project description[^:]*|description in PDF format/i;
      const s = find(S, /include a (text|written) description/i) || find(S, /(text|written) description/i, /depicted|judge based/i)
        || find(S, /^(one[- ]page )?project description\b|description in PDF format/i);
      return s && { title: 'Text description of what it does', quotes: [quote(s, re)], kind: 'submission' };
    },
  },
  {
    id: 'testing',
    run(S) {
      const s = find(S, /free of charge[^.]*testing|testing[^.]*free of charge/i)
        || find(S, /login credentials|testing instructions/i, /English|translation/i);
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
    id: 'deployed',
    run(S) {
      const re = /URL to (?:your|the) deployed|working (?:web )?endpoint|link to (?:a |your |the )?(?:working|live|deployed) (?:demo|website|app|application|project|site|version)|deployed (?:project|app|application|demo|site) (?:URL|link)|(?:live|working|hosted) demo (?:URL|link)/i;
      const s = find(S, re, /\b(may|optional|recommend|encourag)/i);
      if (!s) return null;
      const alt = /\bor\b[^.]*(screen[- ]share|live demo)/i.test(s.text);
      return { title: 'A working, deployed link judges can open', detail: alt ? 'Or arrange a live demo instead, as the rule allows.' : 'Keep it running until judging ends.', quotes: [quote(s, re)], kind: 'submission' };
    },
  },
  {
    id: 'external',
    run(S) {
      const offRe = /not (?:via|through|on) Devpost|submissions? (?:are |is |will be )?(?:handled|made|done|collected) (?:via|through|on) (?:our|the)/i;
      const formRe = /(?:fill (?:out|in)|complete|submit)\s+(?:the\s+|our\s+|this\s+|a\s+)?((?:[\w.&'-]+\s+){0,6}?form)\b/i;
      const notForm = /submission form|bonus|in order to (request|receive|claim)|credits|if you (would like|want|wish)|optional|affidavit|tax|W-?9|W-?8|release|liability|publicity|winner|in the form of|form of|contact form|any form|this form|prize|verification/i;
      const off = find(S, offRe);
      const form = find(S, formRe, notForm);
      const out = [];
      if (off) out.push({ title: "Submit on the organiser's own site, not only on Devpost", quotes: [quote(off, /[^.:]*(not (?:via|through|on) Devpost|handled (?:via|through)[^.]*)/i)], kind: 'submission' });
      if (form) {
        const name = form.text.match(formRe)[1].replace(/^(the|our|this|a)\s+/i, '');
        out.push({ title: /^form$/i.test(name) ? "Also fill out the organiser's form" : `Also fill out the ${name}`, detail: 'This is a separate step from the Devpost submission.', quotes: [quote(form, formRe)], kind: 'submission' });
      }
      return out.length ? out : null;
    },
  },
  {
    id: 'disclose',
    run(S) {
      const re = /must disclose[^.]*|undisclosed[^.]*/i;
      const s = find(S, /(must disclose|undisclosed)[^.]*(AI|artificial intelligence|tool)|\b(AI|artificial intelligence)\b[^.]*(must disclose|undisclosed)/i, /judges? must|conflict/i)
        || find(S, re, /judges? must|conflict|personally identifiable/i);
      if (!s) return null;
      const clause = s.text.slice(Math.max(0, s.text.search(/disclose|undisclosed/i)));
      const ai = /\bAI\b|artificial intelligence|AI-assisted|tools? you used/i.test(clause)
        || (/\bAI\b|generative|coding assistants?/i.test(s.text) && /\btools?\b/i.test(clause));
      return { title: ai ? 'Disclose the AI tools you used' : 'Disclose any pre-existing code you reused', quotes: [quote(s, re)], kind: 'build' };
    },
  },
  {
    id: 'age',
    run(S) {
      const legal = /age of majority|at least (?:the age of )?(\d{2}|eighteen|eighteen \(18\)) years/i;
      const short = /\b(1[0-9]|2[01])\s*\+|aged? (1[0-9]|2[01]) (?:and|or) (?:above|over|older)/i;
      const s = find(S, legal) || S.find((x) => short.test(x.text) && /\b(ages?|aged|old|participants?|must be|open to|eligib\w*|entrants?)\b/i.test(x.text));
      if (!s) return null;
      const m = s.text.match(/(\d{2}) years|\b(1[0-9]|2[01])\s*\+|aged? (1[0-9]|2[01])|eighteen/i);
      const age = m ? (m[1] || m[2] || m[3] || '18') : null;
      return { title: age ? `You must be ${age}+` : 'You must be of legal age where you live', quotes: [quote(s, legal.test(s.text) ? legal : short)], kind: 'eligibility' };
    },
  },
  {
    id: 'eligibility-extra',
    run(S) {
      const out = [];
      const add = (s, re, title) => { if (s && !out.some((o) => o.quotes[0].text === s.text)) out.push({ title, quotes: [quote(s, re)], kind: 'eligibility' }); };
      let re = /open only to members of (?:the )?([^.(“"]+?)(?=\s*\(|\s*[“"]|\s+that\b|\.|$)/i;
      let s = find(S, re);
      if (s) add(s, re, `Only open to members of the ${titleCase(s.text.match(re)[1])}`);
      re = /registered with the ([A-Z][\w&' ]+?(?: \([A-Z]+\))?)(?= and|,|\.|$)/;
      s = find(S, re);
      if (s) add(s, re, `Only for people at organisations registered with the ${s.text.match(re)[1]}`);
      re = /(?:an? )?(?:active and valid )?[\w ]{0,20}account with Developer Access(?: enabled)?/i;
      s = find(S, re);
      if (s) {
        const what = s.text.match(re)[0].replace(/^(an?|the) /i, '');
        add(s, re, `Must have ${/^[aeiou]/i.test(what) ? 'an' : 'a'} ${what}`);
      }
      re = /member of an? (educational institution|university|college|school)/i;
      s = find(S, re);
      if (s) add(s, re, `Must be a member of an ${s.text.match(re)[1]}`);
      re = /open to ((?:[\w-]+ ){0,3}?(?:high school|undergraduate|university|college|graduate)[^.,;]*?students?(?: and [\w ]+?)?)(?= worldwide|[.,;]|$)/i;
      s = find(S, re, /primarily|intended for|encouraged|welcome to apply/i);
      if (s) add(s, re, `Only open to ${s.text.match(re)[1]}`);
      return out.length ? out : null;
    },
  },
  {
    id: 'regions',
    run(S) {
      const places = ['Brazil', 'China', 'Quebec', 'Russia', 'Crimea', 'Cuba', 'Iran', 'North Korea', 'Syria', 'Belarus', 'Venezuela'];
      const s = S.find((x) => /(not open|excluded|excluding|exclusions?|exceptions?|ineligible|prohibit|void)/i.test(x.text) && places.filter((p) => x.text.includes(p)).length >= 2);
      if (!s) return null;
      const found = places.filter((p) => s.text.includes(p));
      // Highlight from the first listed place to the last, whatever order the page uses.
      const at = found.map((p) => s.text.indexOf(p));
      const from = Math.min(...at);
      const to = Math.max(...found.map((p, i) => at[i] + p.length));
      return { title: `Not open to residents of ${listJoin(found)}`, quotes: [{ text: s.text, highlight: s.text.slice(from, to) }], kind: 'eligibility' };
    },
  },
  {
    id: 'team',
    run(S) {
      const res = [
        /(?:maximum of|up to|no more than|not exceed)\s+(\w+)\s*(?:\(\d+\)\s*)?(?:team )?(?:members|individuals|people|participants)/i,
        /team size:?\s*(?:\w+)\s+to\s+(\w+)/i,
        /teams? of up to (\w+)/i,
      ];
      for (const re of res) {
        const s = find(S, re);
        if (!s) continue;
        const n = num(s.text.match(re)[1]);
        if (n) return { title: `Teams of up to ${n}${/recommend/i.test(s.text) ? ' (recommended)' : ''}`, quotes: [quote(s, re)], kind: 'eligibility' };
      }
      return null;
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

const titleCase = (s) => s.trim().toLowerCase().replace(/\b([a-z])(\w*)/g, (m, a, b) => (/^(of|the|and|for|in|on)$/.test(m) ? m : a.toUpperCase() + b))
  .replace(/\bVr\b/g, 'VR').replace(/\bAi\b/g, 'AI');

export const DETECTOR_IDS = DETECTORS.map((d) => d.id);

export function detect(rulesBlocks, only) {
  const S = toSentences(rulesBlocks);
  const items = [];
  for (const d of DETECTORS) {
    if (only && !only.includes(d.id)) continue;
    try {
      const r = d.run(S);
      const list = Array.isArray(r) ? r : r ? [r] : [];
      list.forEach((x, i) => items.push({ id: i ? `${d.id}-${i + 1}` : d.id, ...x }));
    } catch (e) {
      // A broken detector must never break the scan.
    }
  }
  // "Disclose pre-existing code" is the other half of the new-work rule: keep it as one item.
  const nw = items.find((i) => i.id === 'new');
  const dis = items.findIndex((i) => i.id === 'disclose' && /pre-existing/.test(i.title));
  if (nw && dis >= 0) {
    nw.quotes.push(...items[dis].quotes);
    items.splice(dis, 1);
  }
  return items;
}

// Judging criteria from the overview, plus any the official rules add.
const cleanName = (n) => n.replace(/\s*[:–—-]\s*$/, '').trim();
const normName = (s) => s.toLowerCase().replace(/\b(the|of|a|an|and|for)\b/g, '').replace(/[^a-z]/g, '');
const sameName = (a, b) => {
  const x = normName(a);
  const y = normName(b);
  return x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)));
};
// Pull "— weighted 30%" / "- 20%" out of a name or description into the weight.
function splitWeight(c) {
  const out = { ...c, name: cleanName(c.name) };
  let m = out.name.match(/^(.*?)\s*[-–—]\s*(?:weighted\s*)?(\d+\s*%)$/i);
  if (m) { out.name = m[1].trim(); out.weight = out.weight || m[2]; }
  m = (out.description || '').match(/^(?:[-–—]\s*)?weighted\s*(\d+\s*%)\s*[:.,]?\s*/i);
  if (m) { out.weight = out.weight || m[1]; out.description = out.description.slice(m[0].length); }
  return out;
}
const notCriterion = (n) => /^(tracks?|stages?|bonus|prizes?)\b/i.test(n) || /criteria/i.test(n);

export function judging(overviewHtml, rulesBlocks) {
  const region = slice(overviewHtml, /id="judging-criteria"/i, /<\/article>/i);
  let fromOverview = [];
  const liRe = /<li[^>]*>\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(region))) fromOverview.push(splitWeight({ name: stripTags(m[1]), description: stripTags(m[2]) }));
  fromOverview = fromOverview.filter((c) => c.name && !notCriterion(c.name));

  let fromRules = [];
  const start = rulesBlocks.findIndex((b) => /judging criteria|evaluated .*criteria|following .*criteria/i.test(b.text));
  if (start >= 0) {
    for (const b of rulesBlocks.slice(start + 1, start + 25)) {
      const mm = b.text.match(/^([A-Z][\w\/&',. -]{2,60}?)\s*(?:\(([^)]*\d+\s*%[^)]*)\))?\s*[:–—-]\s+(.{10,})$/);
      if (/prize|tie[- ]break|substitution|intellectual property/i.test(b.text) && fromRules.length) break;
      if (b.tag.startsWith('h') && fromRules.length) break;
      if (mm && (b.tag === 'li' || b.tag === 'p')) fromRules.push(splitWeight({ name: mm[1].trim(), weight: mm[2] || null, description: mm[3].trim() }));
    }
  }
  // Track and prize names show up in the rules as "Fire TV: …" long before the
  // judging section; they are categories, not criteria.
  const before = rulesBlocks.slice(0, Math.max(start, 0)).map((b) => b.text.toLowerCase());
  const prizes = stripTags(slice(overviewHtml, /id="prizes"/i, /<\/article>/i)).toLowerCase();
  const isCategory = (n) => {
    const l = n.toLowerCase();
    return before.some((t) => t.startsWith(l) && /^\s*(:|\(|track\b|-)/.test(t.slice(l.length)))
      || (prizes && new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(prizes));
  };
  const seen = [];
  fromRules = fromRules.filter((r) => {
    if (notCriterion(r.name) || seen.some((n) => sameName(n, r.name))) return false;
    seen.push(r.name);
    return true;
  });
  const base = fromOverview.length ? fromOverview : fromRules;
  const out = base.map((c) => {
    const r = fromRules.find((x) => sameName(x.name, c.name));
    return { name: c.name, weight: c.weight || (r && r.weight) || null, description: c.description, onlyInRules: false };
  });
  if (fromOverview.length) {
    for (const r of fromRules) {
      if (fromOverview.some((o) => sameName(o.name, r.name)) || isCategory(r.name)) continue;
      out.push({ ...r, weight: r.weight || null, onlyInRules: true });
    }
  }
  return out;
}

export { toBlocks };
