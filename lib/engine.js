// Browser fallback engine (same output shape as ml/engine.py).
export const WHY = {
  Terminology: "This term is not on the approved glossary.",
  Tone: "This wording drifts from the brand voice.",
  Claims: "Superlatives and absolute promises need proof before publishing.",
  Facts: "This figure does not match the approved facts.",
  Accessibility: "People using screen readers cannot access this image.",
  Readability: "Very long sentences are hard to read.",
};
export const DEFAULT_RULES = `Terminology | utilize | use | Terminology glossary
Terminology | e-?mail | email | Terminology glossary
Terminology | click here | select this link | Style guide, links
Tone | gonna | going to | Brand voice guide
Tone | awesome | excellent | Brand voice guide
Tone | !{2,} | ! | Brand voice guide
Claims | no\\.?\\s?1\\b | (add proof or remove) | Claims policy
Claims | 100% guaranteed | (add proof or remove) | Claims policy
Claims | world-?class | (add proof or remove) | Claims policy
Claims | unbeatable | (add proof or remove) | Claims policy`;
export const DEFAULT_FACTS = `clients: 500
students: 20,000
approved claim: Rated 4.7 out of 5 by 2,000 learners (survey, Q3 2026)`;
export const SAMPLE = `We’re gonna make your brand awesome!! Utilize our platform, India’s No.1 EdTech, and join 100 clients who got 100% guaranteed results. Click here to e-mail us.\n\n<img src="hero.png">`;

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function review(t, rulesText, factsText) {
  const out = [];
  const facts = factsText.split("\n").map((l) => l.trim()).filter(Boolean);
  const appr = facts.filter((l) => /^approved claim:/i.test(l)).map((l) => l.replace(/^approved claim:/i, "").trim().toLowerCase());
  rulesText.split("\n").forEach((l) => {
    const p = l.split("|").map((x) => x.trim());
    if (p.length < 4 || !p[1]) return;
    let re;
    try { re = new RegExp(p[1], "gi"); } catch { return; }
    let m;
    while ((m = re.exec(t))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (p[0] === "Claims" && appr.some((a) => a.includes(m[0].toLowerCase()))) continue;
      out.push({ cat: p[0], i: m.index, len: m[0].length, text: m[0], rep: p[2].startsWith("(") ? null : p[2], src: p[3], conf: p[0] === "Claims" ? 0.72 : 0.95 });
    }
  });
  facts.forEach((l) => {
    if (/^approved claim:/i.test(l)) return;
    const k = l.indexOf(":");
    if (k < 1) return;
    const label = l.slice(0, k).trim(), val = l.slice(k + 1).trim(), vn = parseInt(val.replace(/,/g, ""));
    const re = new RegExp("(\\d[\\d,]*)\\+?(?:\\s+[\\w-]+){0,2}?\\s+" + reEsc(label) + "\\b", "gi");
    let m;
    while ((m = re.exec(t))) {
      if (parseInt(m[1].replace(/,/g, "")) !== vn) out.push({ cat: "Facts", i: m.index, len: m[1].length, text: m[1], rep: val.replace(/\+$/, ""), src: "Approved facts: " + label + " = " + val, conf: 0.9 });
    }
  });
  let m, re = /<img\b(?![^>]*\balt=)[^>]*>|!\[\]\([^)]*\)/gi;
  while ((m = re.exec(t))) out.push({ cat: "Accessibility", i: m.index, len: m[0].length, text: m[0], rep: null, src: "WCAG 2.1, 1.1.1 Non-text content", conf: 0.98, fixmsg: "Add a short alt text that describes the image." });
  re = /[^.!?\n]+[.!?]?/g;
  while ((m = re.exec(t))) if (m[0].trim().split(/\s+/).length > 35) out.push({ cat: "Readability", i: m.index, len: m[0].length, text: m[0].trim().slice(0, 40) + "…", rep: null, src: "Readability guideline", conf: 0.6, fixmsg: "Split this into shorter sentences." });
  return out.sort((a, b) => a.i - b.i);
}
export const key = (f) => f.cat + ":" + f.text.toLowerCase();
