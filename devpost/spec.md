---
doc: spec
status: approved
---

# Fine Print — Technical Spec

## How This Works, In Plain Language
Fine Print has two halves. The **page** is plain HTML, CSS and JavaScript that runs in your browser: it shows the URL box, the deadline card and the checklist, and remembers your ticks in the browser's own storage. The **readers** are two tiny server functions on Vercel. The browser can't read Devpost or call GitHub's file list directly for every check, so it asks the readers: `/api/scan` fetches the hackathon's overview and rules pages, turns them into plain text, and runs a set of detectors (small pattern rules like "video … under N minutes") that each return a checklist item plus the exact sentence that triggered it. `/api/repo` asks GitHub's public API whether a repo is public, which licence it has, and which files it contains. No database, no accounts, no AI key: everything is computed fresh from the official pages each time.
Why this shape: deterministic detectors quote rules verbatim and never hallucinate a requirement, which is the whole point of receipts. An LLM pass is a later enhancement.

## The Core Journey Through the System
1. Visitor opens `/` → `public/index.html` loads `app.js` and `styles.css` (no build step).
2. Pastes a Devpost URL → `app.js` normalises it and calls `GET /api/scan?url=…`.
3. `api/scan.js` fetches `https://<slug>.devpost.com/` and `/rules` → `lib/text.js` strips HTML to sentences → `lib/deadline.js` parses "Deadline: Oct 26, 2026 @ 5:00pm EDT" to an ISO instant → `lib/detectors.js` runs each detector over the rules sentences → returns JSON `{title, url, submitUrl, deadline:{iso, original}, items:[{id, title, detail, quote, highlight, kind, repoCheck?}], judging:[{name, description}]}`.
4. `app.js` renders the deadline in the browser's time zone via `Intl.DateTimeFormat`, starts the countdown, renders items with receipts, restores ticks from `localStorage["fineprint:<slug>"]`.
5. Visitor pastes a GitHub repo → `GET /api/repo?repo=owner/name&files=scope.md,prd.md,spec.md` → `api/repo.js` calls GitHub's repo and git-tree endpoints → returns `{exists, public, license, readme, files:{name:found}}` → `app.js` marks repo-related items Verified or shows the fix.
6. All items ticked/verified → "Ready to submit" with link to `submitUrl`.
PRD ref: `prd.md > The Core Journey`.

## Stack
- Vanilla HTML/CSS/JS front end — no framework or build step; fastest to a polished single page. (MDN: https://developer.mozilla.org/)
- Node.js 20+ serverless functions on Vercel (`/api/*.js`, default export `(req, res)`), using built-in `fetch`; zero npm dependencies. (https://vercel.com/docs/functions)
- Local dev: `node dev-server.js` serves `public/` and routes `/api/*` to the same handlers.
- Fonts: Google Fonts Fraunces (display), Inter (UI), JetBrains Mono (receipts).
Recommendation accepted by Olly ("pick sensible options"). Unverified until slice 1: Devpost serves rules HTML to server fetches without blocking (checked once from the sandbox: HTTP 200).

## Where It Runs and How Someone Tries It
- Live: deployed to Vercel (public URL recorded in README).
- Local: `node dev-server.js` → open http://localhost:3000.
- Demo recording: the live URL in a browser, scanning https://learn-ai-basics.devpost.com/ and checking the project's own GitHub repo.
- Submission needs the demo video (YouTube, public, <3 min) and public GitHub repo with MIT licence; deployment is a bonus.

## Look and Feel
Paper `#F6F1E7` background, ink `#1B1A17`, highlighter `#FFE45C` (as a skewed background swipe behind highlighted words), stamp red `#C8372D` (rotated −6°, double border, uppercase, letter-spaced), cleared green `#2F7D4F`. Fraunces for headline and card titles, Inter for UI, JetBrains Mono for receipts. Single column, max-width 760px, generous whitespace, subtle paper grain via CSS gradient. Copy is plain and a little wry. No gradients-on-purple, no glass, no emoji. PRD ref: `prd.md > Look and Feel`.

## Components

### Start and results page (`public/index.html`, `public/app.js`, `public/styles.css`)
URL form, example chips, reading state, results rendering, errors. PRD ref: `prd.md > Screens and Layout`, `prd.md > States and Boundaries`.

### Deadline card (`public/app.js` renderDeadline, `public/ics.js`)
Local-time formatting, original string, minute countdown, .ics download (VEVENT + VALARM −PT24H). PRD ref: `prd.md > Deadline card`.

### Checklist with receipts (`public/app.js` renderItems)
Items with DQ-risk stamp, tick boxes, expandable receipt with highlighted phrase, progress line, localStorage persistence. PRD ref: `prd.md > Disqualifier checklist`.

### Scan reader (`api/scan.js`, `lib/text.js`, `lib/deadline.js`, `lib/detectors.js`)
Fetch + normalise URL, HTML→sentences, deadline parse (US time zone abbreviations EDT/EST/PDT/PST/CDT/CST/MDT/MST/UTC/GMT), detector registry, judging-criteria extraction (bullets after "Judging Criteria"/"Criteria" heading of form "Name: description"). PRD ref: `prd.md > Reading a hackathon`, `prd.md > Disqualifier checklist`, `prd.md > Judging criteria`.

### Repo reader (`api/repo.js`)
GitHub REST: `GET /repos/{owner}/{repo}` (private flag, license.spdx_id/name), `GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1` (file list; README and required files matched case-insensitively by basename). PRD ref: `prd.md > Repo check`.

## Data Model
- Scan result JSON (above) — computed per request, not stored.
- `localStorage["fineprint:<slug>"] = {ticked: [itemId…], repo: "owner/name"}` — survives refresh, this browser only.

## File Structure
```
app/
├── public/
│   ├── index.html      # page shell, fonts, start + results containers
│   ├── styles.css      # paper / ink / highlighter / stamp look
│   ├── app.js          # form, rendering, countdown, ticks, repo check
│   └── ics.js          # builds the .ics calendar file
├── api/
│   ├── scan.js         # GET /api/scan?url=… → checklist JSON
│   └── repo.js         # GET /api/repo?repo=…&files=… → repo facts
├── lib/
│   ├── text.js         # HTML → clean sentences
│   ├── deadline.js     # "Oct 26, 2026 @ 5:00pm EDT" → ISO
│   └── detectors.js    # requirement detectors + judging extraction
├── test/detectors.test.js  # node:test against saved rules pages
├── test/fixtures/      # saved Devpost rules HTML for 3 hackathons
├── dev-server.js       # local server for public/ + api/
├── package.json        # "type":"module", scripts: dev, test
├── vercel.json
├── LICENSE             # MIT
├── README.md
└── devpost/            # scope, prd, spec, checklist, app-map
```

## External Services and Dependencies
- **Devpost pages** — `GET https://<slug>.devpost.com/` and `/rules`, HTML, no key. Be polite: one fetch each per scan, 8 s timeout. Also `https://devpost.com/api/hackathons?search=` exists but isn't needed.
- **GitHub REST API** — https://docs.github.com/en/rest/repos/repos , https://docs.github.com/en/rest/git/trees ; unauthenticated 60 requests/hour per IP (optional `GITHUB_TOKEN` env var raises it; never committed).
- **Vercel** — hosting, free tier.

## Important Failure Modes
- **Devpost changes its markup or blocks the fetch** → "Couldn't read this page" with a link to the rules; fixtures in tests catch regressions.
- **A detector misses an unusual rule** → footer "Always read the official rules"; only found items are shown, never invented ones.
- **GitHub rate limit** → "GitHub is rate-limiting us, try again in a few minutes"; manual ticks still work.

## What Was Simplified and Why
- **Pattern detectors** instead of an LLM — verbatim receipts, no API key or cost, deterministic for the demo. The fuller version would add an LLM pass for rules the patterns miss, still requiring a quote.
- **Devpost only** — one consistent source.
- **Browser storage** instead of accounts.

## Decisions and Open Issues
- Stack and no-LLM approach: agent recommendation, accepted by Olly.
- Learner uncertainty: none raised explicitly. Investigation to run in slice 1: do the detectors generalise beyond this hackathon? Evidence: tests against three different Devpost rules pages.
- Open: none blocking.
