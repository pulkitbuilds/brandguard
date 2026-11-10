"""BrandGuard review engine: rule engine + lightweight ML (TF-IDF claim grounding,
fuzzy fact-label matching). Output shape matches lib/engine.js."""
import difflib
import re

from .retrieval import TfIdf
from .semantic import semantic_claims, semantic_facts

SUPER = re.compile(
    r"(?<!\w)(best|no\.?\s?1|number one|guaranteed|100%|world-?class|unbeatable|"
    r"leading|fastest|cheapest|top[- ]rated)(?!\w)",
    re.I,
)


def _sentence(text, i):
    left = max(text.rfind(c, 0, i) for c in ".!?\n") + 1
    rights = [p for p in (text.find(c, i) for c in ".!?\n") if p != -1]
    return text[left:(min(rights) + 1 if rights else len(text))]


def _u16(text, i):
    return len(text[:i].encode("utf-16-le")) // 2


def review(text, rules_text, facts_text="", semantic=True):
    out, exemplars = [], []
    lines = [l.strip() for l in facts_text.splitlines() if l.strip()]
    approved = [l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("approved claim:")]
    facts = [
        tuple(x.strip() for x in l.split(":", 1))
        for l in lines
        if ":" in l and not l.lower().startswith("approved claim:")
    ]
    index = TfIdf(approved) if approved else None

    def claim_ok(span, sentence):
        if any(span.lower() in a.lower() for a in approved):
            return True
        return bool(index) and index.query(sentence)[1] >= 0.35

    # 1) Rulebook rules (category | pattern | fix | source)
    for line in rules_text.splitlines():
        p = [x.strip() for x in line.split("|")]
        if len(p) < 4 or not p[1]:
            continue
        if p[0].lower() == "semantic":  # exemplar of a prohibited claim, matched by meaning
            exemplars.append((p[4] if len(p) > 4 and p[4] else "Claims", p[1], p[2], p[3]))
            continue
        try:
            rx = re.compile(p[1], re.I)
        except re.error:
            continue
        for m in rx.finditer(text):
            if not m.group(0):
                continue
            if p[0] == "Claims" and claim_ok(m.group(0), _sentence(text, m.start())):
                continue
            out.append(dict(cat=p[0], i=m.start(), len=len(m.group(0)), text=m.group(0),
                            rep=None if p[2].startswith("(") else p[2], src=p[3],
                            conf=0.72 if p[0] == "Claims" else 0.95))

    # 2) ML: auto-detect promotional claims the rulebook did not list
    covered = [(f["i"], f["i"] + f["len"]) for f in out]
    for m in SUPER.finditer(text):
        if any(a < m.end() and m.start() < b for a, b in covered):
            continue
        if claim_ok(m.group(0), _sentence(text, m.start())):
            continue
        out.append(dict(cat="Claims", i=m.start(), len=len(m.group(0)), text=m.group(0), rep=None,
                        src="Claims policy (auto-detected)", conf=0.7))

    # 2b) Meaning-based claim matching against the Semantic exemplars
    if semantic:
        covered = [(f["i"], f["i"] + f["len"]) for f in out]
        out += semantic_claims(text, exemplars, covered, claim_ok)

    # 3) Facts: fuzzy-match the fact label inside each sentence, compare the number before it
    for label, val in facts:
        want = int(re.sub(r"\D", "", val) or 0)
        ltoks = re.findall(r"[a-z0-9]+", label.lower())
        last = ltoks[-1] if ltoks else ""
        for tm in re.finditer(r"[A-Za-z0-9]+", text):
            if difflib.SequenceMatcher(None, tm.group(0).lower(), last).ratio() < 0.85:
                continue
            before = text[max(0, tm.start() - 60):tm.start()]
            nm = list(re.finditer(r"(\d[\d,]*)\+?((?:\s+[\w-]+){0,3}?)\s*$", before))
            if not nm:
                continue
            m = nm[0]
            if int(m.group(1).replace(",", "")) != want:
                start = max(0, tm.start() - 60) + m.start(1)
                out.append(dict(cat="Facts", i=start, len=len(m.group(1)), text=m.group(1),
                                rep=re.sub(r"\+$", "", val),
                                src=f"Approved facts: {label} = {val}", conf=0.9))

    if semantic:
        out += semantic_facts(text, facts, {f["i"] for f in out if f["cat"] == "Facts"}, claim_ok)

    # 4) Accessibility + readability
    for m in re.finditer(r"<img\b(?![^>]*\balt=)[^>]*>|!\[\]\([^)]*\)", text, re.I):
        out.append(dict(cat="Accessibility", i=m.start(), len=len(m.group(0)), text=m.group(0), rep=None,
                        src="WCAG 2.1, 1.1.1 Non-text content", conf=0.98,
                        fixmsg="Add a short alt text that describes the image."))
    for m in re.finditer(r"[^.!?\n]+[.!?]?", text):
        if len(m.group(0).split()) > 35:
            out.append(dict(cat="Readability", i=m.start(), len=len(m.group(0)),
                            text=m.group(0).strip()[:40] + "…", rep=None,
                            src="Readability guideline", conf=0.6,
                            fixmsg="Split this into shorter sentences."))

    out.sort(key=lambda f: f["i"])
    for f in out:  # the browser indexes strings in UTF-16 units
        end = _u16(text, f["i"] + f["len"])
        f["i"] = _u16(text, f["i"])
        f["len"] = end - f["i"]
    return out
