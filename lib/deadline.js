// "Oct 26, 2026 @ 5:00pm EDT" → an exact instant.
const OFFSETS = {
  UTC: 0, GMT: 0, BST: 1, CET: 1, CEST: 2, IST: 5.5, JST: 9, SGT: 8, AEST: 10, AEDT: 11,
  EDT: -4, EST: -5, CDT: -5, CST: -6, MDT: -6, MST: -7, PDT: -7, PST: -8, AKDT: -8, HST: -10,
  MSK: 3, KST: 9, HKT: 8, WIB: 7, PHT: 8, NZDT: 13, NZST: 12, BRT: -3, EAT: 3, WAT: 1, EET: 2, EEST: 3, ACST: 9.5,
};
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseDeadline(str) {
  if (!str) return null;
  const m = str.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})\s*@\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*([A-Z]{2,5}|[+-]\d{1,2}(?::?\d{2})?)/i);
  if (!m) return null;
  const [, mon, day, year, hh, mm, ampm, tz] = m;
  const month = MONTHS[mon.toLowerCase()];
  const num = tz.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  const offset = num ? (num[1] === '-' ? -1 : 1) * (+num[2] + (+num[3] || 0) / 60) : OFFSETS[tz.toUpperCase()];
  if (month === undefined || offset === undefined) return null;
  let hour = parseInt(hh, 10) % 12;
  if (ampm.toLowerCase() === 'pm') hour += 12;
  const utcMs = Date.UTC(+year, month, +day, hour, +mm) - offset * 3600 * 1000;
  return { iso: isoString(utcMs), original: `${mon} ${day}, ${year} @ ${hh}:${mm}${ampm.toLowerCase()} ${tz.toUpperCase()}` };
}

// Devpost publishes the exact instant twice: on the deadline element
// (data-iso-date) and in the page's JSON-LD (endDate). Trust those first and
// keep the human-readable text only as the organiser's original wording.
export function findDeadline(html) {
  const text = html.match(/Deadline:\s*([^<\n]+?@[^<\n]+?(?:[A-Z]{2,5}|[+-]\d{1,2}(?::?\d{2})?))\s*</);
  const raw = text ? text[1].replace(/\s+/g, ' ').trim() : null;
  const parsed = raw ? parseDeadline(raw) : null;
  const iso = (html.match(/class="deadline[^"]*"[^>]*?data-iso-date="([^"]+)"/)
    || html.match(/data-iso-date="([^"]+)"[^>]*>\s*Deadline:/)
    || html.match(/"endDate":\s*"([^"]+)"/) || [])[1];
  const ms = iso ? new Date(iso).getTime() : NaN;
  if (Number.isFinite(ms)) return { iso: isoString(ms), original: parsed ? parsed.original : (raw || iso) };
  return parsed;
}

// Build the ISO string by hand (avoids any environment patching of Date#toISOString).
function isoString(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}
