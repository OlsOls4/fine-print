// "Oct 26, 2026 @ 5:00pm EDT" → an exact instant.
const OFFSETS = {
  UTC: 0, GMT: 0, BST: 1, CET: 1, CEST: 2, IST: 5.5, JST: 9, SGT: 8, AEST: 10, AEDT: 11,
  EDT: -4, EST: -5, CDT: -5, CST: -6, MDT: -6, MST: -7, PDT: -7, PST: -8, AKDT: -8, HST: -10,
};
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseDeadline(str) {
  if (!str) return null;
  const m = str.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})\s*@\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*([A-Z]{2,5})/i);
  if (!m) return null;
  const [, mon, day, year, hh, mm, ampm, tz] = m;
  const month = MONTHS[mon.toLowerCase()];
  const offset = OFFSETS[tz.toUpperCase()];
  if (month === undefined || offset === undefined) return null;
  let hour = parseInt(hh, 10) % 12;
  if (ampm.toLowerCase() === 'pm') hour += 12;
  const utcMs = Date.UTC(+year, month, +day, hour, +mm) - offset * 3600 * 1000;
  return { iso: isoString(utcMs), original: `${mon} ${day}, ${year} @ ${hh}:${mm}${ampm.toLowerCase()} ${tz.toUpperCase()}` };
}

export function findDeadline(html) {
  const m = html.match(/Deadline:\s*([^<\n]+?@[^<\n]+?(?:[A-Z]{2,5}))\s*</);
  return m ? parseDeadline(m[1].replace(/\s+/g, ' ')) : null;
}

// Build the ISO string by hand (avoids any environment patching of Date#toISOString).
function isoString(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00Z`;
}
