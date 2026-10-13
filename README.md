# Fine Print

**Read the hackathon rules before they read you.**

Paste a Devpost hackathon link. Fine Print reads the official rules and gives you every requirement that can get you disqualified as a checklist, each item with a **receipt**: the exact sentence from the rules, highlighted. It shows the deadline in your own time zone with a countdown and a calendar file, flags judging criteria that only appear in the official rules, and checks your GitHub repo (public? licence? required files?) so the repo rules tick themselves.

Built for the Devpost [Build With AI: Basics](https://learn-ai-basics.devpost.com/) hackathon using the Devpost Learn Skill Pack. Planning documents: [`devpost/scope.md`](devpost/scope.md), [`devpost/prd.md`](devpost/prd.md), [`devpost/spec.md`](devpost/spec.md), build log in [`devpost/checklist.md`](devpost/checklist.md).

## Try it

Live: **https://fine-print-mu.vercel.app**

Locally (Node 20+, no dependencies):

```bash
npm run dev     # http://localhost:3000
npm test        # detector tests against saved Devpost rules pages
```

## How it works

- `public/` is a plain HTML/CSS/JS page (no build step). Ticks are saved in your browser's localStorage.
- `api/scan.js` fetches the hackathon's overview and `/rules` pages; `lib/detectors.js` runs small pattern detectors over the rules text. Every item must carry the verbatim sentence it came from, so nothing is invented.
- The deadline comes from the exact instant Devpost publishes on the page (`data-iso-date` / JSON-LD `endDate`), with the organiser's wording kept alongside.
- Short community rules pages are read too (age, team size, excluded countries, video length), plus the overview's requirements box. When a rules page is short, Fine Print says so and never shows "Ready to submit".
- Tested on all 40 open Devpost hackathons (13 Oct 2026): deadlines found on 40/40, at least one quoted rule on 29/40.
- `api/repo.js` asks GitHub's public API whether the repo is public, which licence it has, and whether the required files exist. Set an optional `GITHUB_TOKEN` env var to raise GitHub's rate limit.
- Deploys as-is to Vercel (`public/` static + `api/` functions).

Fine Print isn't legal advice. Always read the official rules yourself.

## Credits

Fonts: Fraunces, Inter and JetBrains Mono (SIL Open Font Licence), self-hosted via Fontsource. Built with an AI coding agent following the Devpost Learn Skill Pack (`.agents/skills/`).

MIT licence.
