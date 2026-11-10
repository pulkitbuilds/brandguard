// Maps a finding (character range in the extracted text) back to where it sits in the original file.
const union = (ws) => [Math.min(...ws.map((w) => w.b[0])), Math.min(...ws.map((w) => w.b[1])), Math.max(...ws.map((w) => w.b[2])), Math.max(...ws.map((w) => w.b[3]))];

export function locate(f, source) {
  if (!source) return null;
  const a = f.i, b = f.i + f.len;
  if (source.words?.length) {
    const ws = source.words.filter((w) => w.e > a && w.s < b);
    if (!ws.length) return null;
    const pages = [...new Set(ws.map((w) => w.p))];
    const boxes = [];
    for (const p of pages) {
      const lines = {};
      ws.filter((w) => w.p === p).forEach((w) => (lines[w.l] = lines[w.l] || []).push(w));
      Object.values(lines).forEach((l) => boxes.push({ p, b: union(l) })); // one box per line keeps the overlay tight
    }
    const unit = source.kind === "image" ? "Image region" : pages.length > 1 ? `Pages ${pages[0]}-${pages[pages.length - 1]}` : `Page ${pages[0]}`;
    return { label: unit, boxes };
  }
  if (source.paras?.length) {
    const ps = source.paras.filter((p) => p.e > a && p.s < b);
    if (ps.length) return { label: ps.length > 1 ? `Paragraphs ${ps[0].n}-${ps[ps.length - 1].n}` : `Paragraph ${ps[0].n}`, boxes: [] };
  }
  return null;
}
