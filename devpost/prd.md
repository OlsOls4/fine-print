---
doc: prd
status: approved
---

# Fine Print — Product Requirements

A one-page web app for hackathon entrants: paste a Devpost hackathon link, get the deadline in your time zone and every disqualifying rule as a checklist with the exact source sentence, then auto-check your GitHub repo against it.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
1. The visitor lands on Fine Print: a headline ("Read the fine print before it reads you"), one URL box, and three example hackathon chips.
2. They paste a Devpost hackathon URL (or tap a chip) and press **Read the rules**.
3. A short reading state shows what's being read ("Reading the overview… the official rules…").
4. The results page shows, top to bottom:
   - the hackathon title and a **Deadline card**: the deadline in the visitor's local time zone, the original organiser time, and a live countdown; plus an **Add to calendar** button.
   - the **Disqualifier checklist**: each hard requirement as a plain-English line, a red "DQ risk" stamp until ticked, and a collapsible **receipt** quoting the rule sentence with the key words highlighted.
   - a **Repo check** box: paste a GitHub repo URL → repo-related items tick themselves (green, "verified") or show exactly what's missing.
   - **Judging criteria**, listed as the rules state them.
5. The visitor ticks the remaining items by hand as they finish them. A progress line reads "5 of 9 cleared".
6. Success: every item is cleared; the stamp turns into "Ready to submit" with a link to the hackathon's submission page.
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

## Screens and Layout
One page, two states: **Start** (hero + URL box + examples) and **Results** (same URL box shrinks to the top; deadline card, checklist, repo check, judging criteria below in a single readable column, max ~760px wide). Works on desktop and phone.

## Look and Feel
- The fine print itself: warm off-white paper background, near-black ink text.
- Serif display headline with character (e.g. Fraunces / Instrument Serif); clean sans for UI; monospace for rule quotes.
- Receipts look like quoted legal text with a yellow highlighter swipe on the key phrase.
- A red rubber-stamp "DQ RISK" badge on uncleared items; green ink "Cleared" / "Verified" when done.
- Calm, generous spacing; wry, plain-English copy. Avoid purple gradients, glassmorphism, emoji clutter.
Source: `scope.md > Inspiration & Identity`.

## Features and Behavior

### Reading a hackathon
- Accepts any `https://<slug>.devpost.com` URL (with or without a path); normalises to the hackathon root and also reads `/rules`.
  - [ ] Pasting `https://learn-ai-basics.devpost.com/rules` gives the same result as the root URL.
  - [ ] A non-Devpost URL shows "Fine Print reads Devpost hackathons for now" and nothing breaks.

### Deadline card
- Shows the submission deadline converted to the visitor's browser time zone, the organiser's original string, and a countdown (days, hours, minutes) updating every minute. Past deadlines say "Closed".
- **Add to calendar** downloads an .ics event ending at the deadline with a reminder 24 hours before.
  - [ ] For Build With AI: Basics a UK visitor sees "Mon 26 Oct 2026, 22:00" and the original "Oct 26, 2026 @ 5:00pm EDT".

### Disqualifier checklist
- Detects hard requirements from the rules text, each with a plain-English title and its source sentence (the receipt). Detectors cover: video (max length, required host such as YouTube/Vimeo, public), public code repository, open-source licence, specific required files, required tools/APIs/SDKs, text description, testing access/credentials, new-project-only, eligibility (age, excluded regions), team size, language (English), no copyrighted music/trademarks.
- Only items found in the rules appear; nothing is invented. Each receipt quotes the rules verbatim.
- Ticks persist in the browser per hackathon.
  - [ ] Build With AI: Basics shows at least: video under 3 minutes on YouTube/Vimeo; public repo; open-source licence; scope.md/prd.md/spec.md required; Skill Pack required; age of majority; English.
  - [ ] Every item expands to show a verbatim sentence from the rules page.
  - [ ] Refreshing the page keeps the ticks.

### Repo check
- Paste a public GitHub repo URL; Fine Print checks: repo exists and is public, licence detected (and its name), README present, and each required file named by the rules exists anywhere in the repo.
- Repo-related checklist items turn green "Verified" or show a specific fix ("No licence detected — add a LICENSE file").
  - [ ] A repo missing scope.md shows that exact file as missing.

### Judging criteria
- Lists the judging criteria names and their one-line descriptions as written in the rules.

## States and Boundaries
- **First use** — Start state with examples; nothing stored.
- **Reading** — progress text; button disabled.
- **Unreadable page / not Devpost** — friendly message, URL box stays filled for correction.
- **No rules found** — shows the deadline (if any) and says "We couldn't find official rules on this page — read them on Devpost", with a link.
- **Repo not found / private / GitHub rate limit** — specific message; manual ticking still works.
- **Persistence** — ticks saved in this browser only, keyed by hackathon.

## Product Decisions
- Devpost only for the PoC — Olly accepted the recommendation; one source done well beats five done badly, and Devpost has a consistent rules layout.
- Receipts on every item — the trust kernel; no item without a source sentence.
- No accounts — the browser remembers ticks.
- Name "Fine Print" and paper/highlighter look — agent recommendation, accepted by Olly ("pick sensible options").

## What We're Building
Start page, reading a Devpost hackathon, deadline card with local time + countdown + .ics, disqualifier checklist with receipts and saved ticks, GitHub repo check with auto-verify, judging criteria list, error states above.

## Deferred From the POC
- Multi-hackathon dashboard — needs saved lists; one hackathon at a time proves the idea.
- Email/push reminders — needs accounts and a backend scheduler; .ics covers it.
- Non-Devpost platforms — each needs its own reader.

## Possible Later Enhancements
An LLM pass to catch unusual rules the detectors miss; a browser extension that overlays the checklist on Devpost; GitLab/Bitbucket repo checks; checking a YouTube link's length and visibility.

## Non-Goals
- Not legal advice or a guarantee — the footer says "Always read the official rules".
- Not judging project quality.
- Not submitting for anyone.

## Open Questions
None blocking `4-spec`.
