// Build a calendar file for the deadline with a reminder a day before.
window.makeIcs = function makeIcs({ title, iso, url }) {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(iso);
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  const esc = (s) => String(s).replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fine Print//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${stamp(end)}-${encodeURIComponent(url)}@fineprint`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Submission deadline: ${title}`)}`,
    `DESCRIPTION:${esc(`Submit before this ends. Rules: ${url}rules`)}`,
    `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${title} closes in 24 hours`)}`, 'TRIGGER:-PT24H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
};
