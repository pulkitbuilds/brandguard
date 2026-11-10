"""Meaning-based checks: sentences that paraphrase a prohibited-claim exemplar, and numbers attached to a
synonym of an approved-fact label (for example 'customers' vs the fact 'clients')."""
import re

from .embed import NEG, cosine, embed, threshold


def sentences(text):
    return [(m.start(), m.end(), m.group(0)) for m in re.finditer(r"(?:[^.!?\n]|[.!?](?=\S))+[.!?]?", text) if m.group(0).strip()]


def semantic_claims(text, exemplars, covered, approved_ok):
    """exemplars: list of (category, phrase, fix, source)."""
    sents = sentences(text)
    if not sents or not exemplars:
        return []
    sv = embed([s[2] for s in sents])
    ev = embed([e[1] for e in exemplars])
    thr, out = threshold("claim"), []
    for (a, b, s), v in zip(sents, sv):
        if NEG.search(s) or any(x < b and a < y for x, y in covered) or approved_ok(s, s):
            continue
        sim, k = max((cosine(v, e), k) for k, e in enumerate(ev))
        if sim >= thr:
            cat, phrase, fix, src = exemplars[k]
            lead = len(s) - len(s.lstrip())
            out.append(dict(cat=cat, i=a + lead, len=len(s.strip()), text=s.strip(), rep=None if fix.startswith("(") else fix,
                            src=f"{src} (matches: \u201c{phrase}\u201d)", conf=round(min(0.95, sim), 2), semantic=True))
    return out


def semantic_facts(text, facts, existing_starts, approved_ok=lambda s, t: False):
    """facts: list of (label, value). Looks at the 1-2 words after each number."""
    if not facts:
        return []
    cands = []
    for m in re.finditer(r"(?<![\w.])(\d[\d,]*)\+?\s+([A-Za-z-]+(?:\s+[A-Za-z-]+)?)", text):
        if m.start() in existing_starts:
            continue
        sent = next((t for a, b, t in sentences(text) if a <= m.start() < b + 1), "")
        if approved_ok(sent, sent):  # an approved claim may legitimately quote its own figures
            continue
        first = m.group(2).split()[0]
        cands.append((m, first))
    if not cands:
        return []
    cv = embed([c[1] for c in cands])
    lv = embed([f[0] for f in facts])
    thr, out = threshold("fact"), []
    for (m, first), v in zip(cands, cv):
        sim, k = max((cosine(v, l), k) for k, l in enumerate(lv))
        label, val = facts[k]
        want = int(re.sub(r"\D", "", val) or 0)
        if sim >= thr and int(m.group(1).replace(",", "")) != want:
            out.append(dict(cat="Facts", i=m.start(1), len=len(m.group(1)), text=m.group(1), rep=re.sub(r"\+$", "", val),
                            src=f"Approved facts: {label} = {val} (matches wording: \u201c{first}\u201d)", conf=round(min(0.9, sim), 2), semantic=True))
    return out
