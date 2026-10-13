// Regression tests for the judge reviews (13 Oct 2026), built on real Devpost
// pages saved as fixtures. Every receipt must stay a verbatim quote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyse } from '../lib/scan.js';
import { findDeadline, parseDeadline } from '../lib/deadline.js';
import { toBlocks } from '../lib/text.js';

const read = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const cache = {};
const load = (slug) => (cache[slug] ||= analyse({ slug, root: `https://${slug}.devpost.com/` }, read(`${slug}-overview.html`), read(`${slug}-rules.html`)));
const item = (r, id) => r.items.find((i) => i.id === id);
const ids = (r) => r.items.map((i) => i.id);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const SLUGS = readdirSync(new URL('./fixtures/', import.meta.url)).filter((f) => f.endsWith('-overview.html')).map((f) => f.replace('-overview.html', ''));

test('every receipt on every saved page is a verbatim quote with an in-quote highlight', () => {
  for (const slug of SLUGS) {
    const r = load(slug);
    const pageText = {
      rules: toBlocks(read(`${slug}-rules.html`)).map((b) => b.text).join('\n'),
      overview: toBlocks(read(`${slug}-overview.html`)).map((b) => b.text).join('\n'),
    };
    for (const it of r.items) {
      assert.ok(it.quotes.length, `${slug}/${it.id} has no receipt`);
      for (const q of it.quotes) {
        assert.ok(pageText[q.source === 'overview' ? 'overview' : 'rules'].includes(q.text), `${slug}/${it.id} quote not verbatim: ${q.text.slice(0, 80)}`);
        if (q.highlight) assert.ok(q.text.includes(q.highlight), `${slug}/${it.id} highlight not in quote`);
      }
    }
  }
});

// ---------- deadline ----------
test('deadline: data-iso-date wins and serialises as exact ISO UTC', () => {
  const r = load('mlai-hackathon'); // "Oct 17, 2026 @ 12:00am +07", data-iso-date 2026-10-16T13:00:00-04:00
  assert.equal(r.deadline.iso, '2026-10-16T17:00:00Z');
  assert.match(r.deadline.original, /\+07$/);
  for (const slug of SLUGS) {
    const d = load(slug).deadline;
    assert.ok(d, `${slug} has no deadline`);
    assert.match(d.iso, ISO, `${slug} deadline not ISO UTC`);
  }
  assert.equal(load('amazonappdev2026').deadline.iso, '2026-10-23T19:00:00Z');
  assert.equal(load('aws-cds-partner').deadline.iso, '2026-10-28T20:00:00Z');
});

test('deadline: numeric offsets and extra zones parse; JSON-LD endDate is a fallback', () => {
  assert.equal(parseDeadline('Oct 21, 2026 @ 12:00am +08').iso, '2026-10-20T16:00:00Z');
  assert.equal(parseDeadline('Oct 25, 2026 @ 5:00pm MSK').iso, '2026-10-25T14:00:00Z');
  const ld = '<script type="application/ld+json">{"endDate": "2026-10-16T13:00:00.000-04:00"}</script>';
  assert.equal(findDeadline(ld).iso, '2026-10-16T17:00:00Z');
});

// ---------- impact 1: repo rule ----------
test('Amazon: public-or-private-shared repo rule, not the mini challenge sentence', () => {
  const r = load('amazonappdev2026');
  const repo = item(r, 'repo');
  assert.match(repo.title, /public \(with licence\) or private and shared with judges/);
  assert.equal(repo.repoCheck, 'access');
  assert.match(repo.quotes[0].text, /OR private and shared with/);
  for (const it of r.items) for (const q of it.quotes) assert.doesNotMatch(q.text, /Mini Challenge|Contributions can be/i, `${it.id} quotes the mini challenge`);
  const lic = item(r, 'license');
  assert.match(lic.title, /if the repo is public/);
  assert.doesNotMatch(lic.title, /recommended/);
  assert.equal(lic.ifPublic, true);
});

test('YouCam and OpenCV: either/or repos; OpenCV needs no licence', () => {
  const y = item(load('youcam-api-skin-ai-ecommerce'), 'repo');
  assert.match(y.title, /or private and shared with judges/);
  assert.deepEqual(y.shareWith, ['contact_event@PerfectCorp.com']);
  const o = item(load('opencv26'), 'repo');
  assert.equal(o.title, 'Code repository: public or private and shared with judges');
  assert.equal(o.quotes[0].source, 'overview');
});

test('AWS CDS: "may be public or private" plus the separate share sentence', () => {
  const r = load('aws-cds-partner');
  const repo = item(r, 'repo');
  assert.match(repo.title, /on GitHub or GitLab: public \(with licence\) or private/);
  assert.equal(repo.quotes.length, 3);
  assert.match(item(r, 'license').title, /if the repo is public/);
});

test('GitLab-only hackathon: no GitHub repo check is offered', () => {
  const r = load('gitlab-transcend');
  assert.match(item(r, 'repo').title, /GitLab/);
  assert.ok(!r.items.some((i) => i.repoCheck));
});

// ---------- impact 3: no false confidence ----------
test('coverage is light on short rules pages and full on the sponsor template', () => {
  assert.equal(load('learn-ai-basics').coverage, 'full');
  for (const slug of ['warriorhacks-2-0', 'dsh-hacks-v2', 'hackapertus', 'multimodal-ai-hackathon-2026-7']) assert.equal(load(slug).coverage, 'light', slug);
});

test('DSH Hacks: rules missing, so overview requirements are used', () => {
  const r = load('dsh-hacks-v2');
  assert.equal(r.rulesFound, false);
  assert.equal(item(r, 'video').quotes[0].source, 'overview');
  assert.equal(item(r, 'description').quotes[0].source, 'overview');
  assert.ok(ids(r).includes('repo'));
});

// ---------- impact 4: short community rules ----------
test('age: 13+, 14 and above, 18+', () => {
  assert.equal(item(load('dsh-hacks-v2'), 'age').title, 'You must be 13+');
  assert.equal(item(load('multimodal-ai-hackathon-2026-7'), 'age').title, 'You must be 14+');
  assert.equal(item(load('hackapertus'), 'age').title, 'You must be 18+');
});

test('team size variants', () => {
  assert.equal(item(load('multimodal-ai-hackathon-2026-7'), 'team').title, 'Teams of up to 4');
  assert.equal(item(load('warriorhacks-2-0'), 'team').title, 'Teams of up to 4 (recommended)');
});

test('excluded countries written as "excluding standard exceptions"', () => {
  const reg = item(load('hackapertus'), 'regions');
  assert.match(reg.title, /Brazil/);
  assert.equal(reg.quotes[0].highlight, 'Brazil, Crimea, Cuba, Iran, North Korea, Quebec, Russia');
});

test('video length variants: number words, ranges and "unlisted"', () => {
  assert.equal(item(load('opencv26'), 'video').title, 'Demo video under 5 minutes, public or unlisted');
  assert.equal(item(load('warriorhacks-2-0'), 'video').title, 'Demo video under 3 minutes');
  assert.match(item(load('dsh-hacks-v2'), 'video').quotes[0].text, /^Demo Video:/);
});

// ---------- impact 5: new detectors ----------
test('external submission and extra forms', () => {
  const ha = item(load('hackapertus'), 'external');
  assert.match(ha.title, /not only on Devpost/);
  assert.match(ha.quotes[0].text, /not via Devpost/);
  const wh = item(load('warriorhacks-2-0'), 'external');
  assert.equal(wh.title, 'Also fill out the WarriorHacks 2.0 Track Selection Form');
  assert.match(wh.quotes[0].link, /^https:\/\/docs\.google\.com\/forms\//);
  // Optional forms (bonus, credits) and the Devpost submission form itself are not disqualifiers.
  for (const slug of ['amazonappdev2026', 'youcam-api-skin-ai-ecommerce', 'start-developer-competition-26']) assert.ok(!ids(load(slug)).includes('external'), slug);
});

test('AI-use disclosure', () => {
  const d = item(load('multimodal-ai-hackathon-2026-7'), 'disclose');
  assert.equal(d.title, 'Disclose the AI tools you used');
  // "disclose pre-existing code" folds into the new-work item instead of duplicating it.
  const aws = load('aws-cds-partner');
  assert.ok(!ids(aws).includes('disclose'));
  assert.ok(item(aws, 'new').quotes.some((q) => /must disclose any other pre-existing code/.test(q.text)));
});

test('deployed URL required', () => {
  assert.match(item(load('aws-cds-partner'), 'deployed').quotes[0].text, /URL to your deployed project/);
  const o = item(load('opencv26'), 'deployed');
  assert.match(o.detail, /live demo/);
});

test('special eligibility is split from legal age', () => {
  const aws = load('aws-cds-partner');
  assert.equal(item(aws, 'age').title, 'You must be of legal age where you live');
  assert.match(item(aws, 'eligibility-extra').title, /AWS Partner Network \(APN\)/);
  const meta = load('start-developer-competition-26');
  assert.ok(meta.items.some((i) => /Developer Access/.test(i.title)));
  assert.ok(meta.items.some((i) => /Meta VR Start Program/.test(i.title)));
  assert.equal(item(load('dsh-hacks-v2'), 'eligibility-extra').title, 'Must be a member of an educational institution');
  assert.equal(item(load('warriorhacks-2-0'), 'eligibility-extra').title, 'Only open to high school students and undergraduates');
  assert.ok(!ids(load('multimodal-ai-hackathon-2026-7')).includes('eligibility-extra'), '"primarily intended for" is not a restriction');
});

// ---------- impact 6: judging ----------
test('judging: no tracks, stages or bonus categories flagged as hidden criteria', () => {
  assert.ok(!load('amazonappdev2026').judging.some((j) => j.onlyInRules));
  assert.ok(!load('start-developer-competition-26').judging.some((j) => /^Stage/.test(j.name)));
  assert.equal(load('hackapertus').judging.length, 0);
  assert.ok(!load('multimodal-ai-hackathon-2026-7').judging.some((j) => /criteria/i.test(j.name)));
  assert.deepEqual(load('learn-ai-basics').judging.filter((j) => j.onlyInRules).map((j) => j.name), ['Potential Impact']);
});

test('judging: near-identical names merge, trailing colons go', () => {
  const y = load('youcam-api-skin-ai-ecommerce').judging;
  assert.ok(!y.some((j) => j.onlyInRules));
  assert.ok(y.some((j) => j.name === 'Technological Implementation'));
});

test('judging: weights are kept from the rules and from names', () => {
  const o = load('opencv26').judging;
  assert.deepEqual(o.find((j) => j.name === 'Technical execution').weight, '30%');
  const a = load('aws-cds-partner').judging;
  assert.deepEqual(a.map((j) => [j.name, j.weight]).slice(0, 2), [['Potential Value/Impact', '20%'], ['Creativity', '10%']]);
});

// ---------- impact 7: wrong quotes ----------
test('Meta Start testing receipt is the free-of-charge sentence', () => {
  const t = item(load('start-developer-competition-26'), 'testing');
  assert.match(t.quotes[0].text, /free of charge/);
  assert.ok(t.quotes[0].highlight);
});

test('YouCam regions highlight spans the list even when order differs', () => {
  const q = item(load('youcam-api-skin-ai-ecommerce'), 'regions').quotes[0];
  assert.ok(q.highlight && q.text.includes(q.highlight));
  for (const p of ['China', 'Venezuela', 'Brazil', 'Belarus']) assert.ok(q.highlight.includes(p), p);
});
