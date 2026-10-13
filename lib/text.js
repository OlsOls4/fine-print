// HTML → clean text blocks and sentences. No dependencies on purpose:
// Devpost pages are server-rendered, so a careful regex pass is enough.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
};

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Cut out the region of a page between a start marker and an end marker.
export function slice(html, startRe, endRe) {
  const s = html.search(startRe);
  if (s < 0) return '';
  const rest = html.slice(s);
  const e = endRe ? rest.search(endRe) : -1;
  return e > 0 ? rest.slice(0, e) : rest;
}

// Turn HTML into readable blocks: paragraphs, list items and headings.
// Every block-level tag starts a new line, so nested lists keep both the
// parent sentence and each child bullet.
// Cloudflare hides e-mail addresses on Devpost pages as data-cfemail hex;
// browsers decode them for readers, so we do the same to quote what people see.
export function decodeCfEmails(html) {
  return html.replace(/<(a|span)\b[^>]*data-cfemail="([0-9a-f]+)"[^>]*>[\s\S]*?<\/\1>/gi, (m, _t, hex) => {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return /^[^\s@<>]+@[^\s@<>]+$/.test(out) ? out : m;
  });
}

export function toBlocks(html) {
  const marked = decodeCfEmails(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(h[1-6])\b[^>]*>/gi, '\n\u0001$1\u0002')
    .replace(/<(li)\b[^>]*>/gi, '\n\u0001li\u0002')
    .replace(/<(p|td|div|ul|ol|section|article|tr)\b[^>]*>/gi, '\n\u0001p\u0002')
    .replace(/<\/(h[1-6]|li|p|td|div|ul|ol|section|article|tr)>/gi, '\n');
  const blocks = [];
  for (const line of marked.split('\n')) {
    const m = line.match(/^\u0001(\w+)\u0002/);
    const tag = m ? m[1].toLowerCase() : 'p';
    const text = stripTags(line.replace(/^\u0001\w+\u0002/, '')).replace(/^[•·]\s*/, '');
    if (text && text.length > 1) blocks.push({ tag, text });
  }
  return blocks;
}

// Split blocks into sentences, remembering which block each came from.
export function toSentences(blocks) {
  const out = [];
  blocks.forEach((b, bi) => {
    const parts = b.text.split(/(?<=[.!?])\s+(?=[A-Z(“"])/);
    for (const p of parts) {
      const t = p.trim();
      if (t.length > 3) out.push({ text: t, block: bi, tag: b.tag });
    }
  });
  return out;
}

export function rulesBlocks(rulesHtml) {
  const region = slice(rulesHtml, /<section class="large-12 columns" role="main">/i, /<footer\b/i) || rulesHtml;
  return toBlocks(region);
}
