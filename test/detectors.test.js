import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyse, normaliseUrl } from '../lib/scan.js';
import { parseDeadline } from '../lib/deadline.js';
import { parseRepo } from '../lib/repo.js';

const load = (slug) => analyse(
  { slug, root: `https://${slug}.devpost.com/` },
  readFileSync(new URL(`./fixtures/${slug}-overview.html`, import.meta.url), 'utf8'),
  readFileSync(new URL(`./fixtures/${slug}-rules.html`, import.meta.url), 'utf8'),
);
const ids = (r) => r.items.map((i) => i.id);

test('deadline converts organiser time to an exact instant', () => {
  assert.equal(parseDeadline('Oct 26, 2026 @ 5:00pm EDT').iso, '2026-10-26T21:00:00Z');
  assert.equal(parseDeadline('Nov 12, 2026 @ 12:00pm PST').iso, '2026-11-12T20:00:00Z');
  assert.equal(parseDeadline('Oct 27, 2026 @ 1:00pm UTC').iso, '2026-10-27T13:00:00Z');
});

test('only Devpost hackathon links are accepted', () => {
  assert.equal(normaliseUrl('https://learn-ai-basics.devpost.com/rules').root, 'https://learn-ai-basics.devpost.com/');
  assert.equal(normaliseUrl('learn-ai-basics.devpost.com').slug, 'learn-ai-basics');
  assert.equal(normaliseUrl('https://example.com'), null);
  assert.equal(normaliseUrl('https://devpost.com/hackathons'), null);
});

test('Build With AI: Basics — every disqualifier the rules state, with receipts', () => {
  const r = load('learn-ai-basics');
  assert.equal(r.title, 'Build With AI: Basics');
  assert.equal(r.deadline.iso, '2026-10-26T21:00:00Z');
  for (const id of ['video', 'repo', 'license', 'files', 'tech', 'description', 'new', 'age', 'english', 'copyright']) {
    assert.ok(ids(r).includes(id), `missing ${id}`);
  }
  const video = r.items.find((i) => i.id === 'video');
  assert.match(video.title, /under 3 minutes/);
  assert.match(video.title, /YouTube or Vimeo/);
  assert.deepEqual(r.items.find((i) => i.id === 'files').files, ['scope.md', 'prd.md', 'spec.md']);
  assert.equal(r.items.find((i) => i.id === 'age').title, 'You must be 18+');
  // Receipts: every highlight is a verbatim substring of its quote.
  for (const it of r.items) for (const q of it.quotes) {
    assert.ok(q.text.length > 3);
    if (q.highlight) assert.ok(q.text.includes(q.highlight), `${it.id} highlight not in quote`);
  }
  // The rules add a judging criterion the overview page leaves out.
  const hidden = r.judging.filter((j) => j.onlyInRules).map((j) => j.name);
  assert.deepEqual(hidden, ['Potential Impact']);
});

test('GitLab Transcend — GitLab repo, no invented licence rule', () => {
  const r = load('gitlab-transcend');
  assert.match(r.items.find((i) => i.id === 'repo').title, /GitLab/);
  assert.ok(!ids(r).includes('license'));
  assert.equal(r.judging.length, 5);
});

test('Qloo and PayPal — licence and repo rules found', () => {
  for (const slug of ['qloo', 'paypalaihackathon']) {
    const r = load(slug);
    assert.ok(ids(r).includes('repo') && ids(r).includes('license'), slug);
  }
});

test('repo input accepts owner/name and github links', () => {
  assert.deepEqual(parseRepo('OlsOls4/fine-print'), { owner: 'OlsOls4', repo: 'fine-print' });
  assert.deepEqual(parseRepo('https://github.com/OlsOls4/fine-print.git'), { owner: 'OlsOls4', repo: 'fine-print' });
  assert.equal(parseRepo('not a repo'), null);
});
