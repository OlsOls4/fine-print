---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner asked the agent to drive: "Proceed to completion")

## Slices

- [x] **1. Paste a Devpost link and see the deadline in your time zone plus a receipts checklist**
  Becomes usable: The full kernel: URL in → deadline card (local time, countdown) and disqualifier items each with a verbatim highlighted quote.
  Why now: The kernel and the riskiest unknown (can we read Devpost and do detectors generalise) come first.
  PRD ref: `prd.md > The Core Journey` (1–4), `prd.md > Reading a hackathon`, `prd.md > Deadline card`, `prd.md > Disqualifier checklist`
  Spec ref: `spec.md > Scan reader`, `spec.md > Start and results page`, `spec.md > File Structure`
  Build: Scaffold package.json, dev-server.js, public/, api/scan.js, lib/text.js, lib/deadline.js, lib/detectors.js; fixtures for 3 hackathons; node:test detector tests.
  Verify (mechanical): `npm test` passes on 3 fixtures; `curl /api/scan?url=https://learn-ai-basics.devpost.com/rules` returns deadline 2026-10-26T21:00:00Z and the expected items.
  Learner check: Paste the Build With AI: Basics link and confirm the deadline reads 22:00 UK time and the 3-minute-video item quotes the rules.
  Commit: `Read Devpost rules into a receipts checklist with local deadline`

- [x] **2. Ticks persist, progress line, calendar file, judging criteria**
  Becomes usable: Tick items, refresh and they stay; "N of M cleared"; .ics download; judging criteria list; Ready-to-submit state.
  Why now: Turns a read-out into a tool you return to.
  PRD ref: `prd.md > Disqualifier checklist`, `prd.md > Deadline card`, `prd.md > Judging criteria`
  Spec ref: `spec.md > Checklist with receipts`, `spec.md > Deadline card`, `spec.md > Data Model`
  Build: localStorage per slug, progress, ics.js, judging extraction + render.
  Verify (mechanical): Headless browser run: tick 2 items, reload, 2 still ticked; .ics content has DTSTART/VALARM.
  Learner check: Tick two items, refresh, see them stay ticked.
  Commit: `Persist ticks, add calendar export and judging criteria`

- [x] **3. Paste your GitHub repo and repo rules verify themselves**
  Becomes usable: Repo check auto-verifies public, licence, README and required files, or names exactly what's missing.
  Why now: The demo's "oh, that's cool" beat, built on slices 1–2.
  PRD ref: `prd.md > Repo check`
  Spec ref: `spec.md > Repo reader`
  Build: api/repo.js + UI box + item linking (repoCheck keys).
  Verify (mechanical): `/api/repo?repo=OlsOls4/fine-print&files=scope.md,prd.md,spec.md` returns license MIT and all files found.
  Learner check: Paste OlsOls4/fine-print and watch the repo items turn green.
  Commit: `Auto-check a GitHub repo against the rules`

## Hands-on Checkpoints
- [x] Early usable behavior explored — after slice 1 (agent-run headless Chromium check with screenshots; learner delegated hands-on review)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review
- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map
- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:

## Revisions
- Fast mode: slices 2 and 3 were implemented in the same session as slice 1 and committed together after the detectors passed tests; each slice's mechanical check was still run (npm test, curl on /api/scan and /api/repo, headless Chromium screenshots).
- Nested Devpost lists lost their parent sentence with the first block parser; switched `lib/text.js` to line-splitting on block tags so both parent and child bullets survive.
- Several detectors matched the wrong sentence on other hackathons (e.g. "authorized to use" as a required tool, "complies with open source licenses" as a licence rule); added exclusions, verified by the GitLab/Qloo/PayPal fixtures.
- Some hackathons only state video/repo requirements on the overview page; added an overview fallback, receipts labelled "Hackathon overview".
- Discovered the rules page can list judging criteria the overview omits (Build With AI: Basics: "Potential Impact"); surfaced as "Only in the fine print". Fits the kernel, no scope change.
- Fonts self-hosted instead of Google Fonts so the page renders reliably offline and in screenshots.
