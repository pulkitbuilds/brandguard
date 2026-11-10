"""Turns brand-guideline text into PROPOSED rules. Nothing is applied automatically: an admin reviews each one.
Heuristics read common guideline phrasing (use X instead of Y, never say 'Z', avoid slang such as ...).
With ANTHROPIC_API_KEY the model also proposes extra rules, which pass the same specificity checks."""
import json
import re

from .llm import complete, configured
from .semantic import sentences

Q = r"[\"\u201c\u2018']([^\"\u201d\u2019']{2,40})[\"\u201d\u2019']"
NEUTRAL = ("Thank you for contacting our team. We offer courses for learners at every level and our staff are happy to help you choose a plan. "
           "Classes start next month and the schedule is posted on our website. Please read the terms before you enrol, and send us an email if you have any questions. "
           "Our centre is open on weekdays from nine to five. You can pay online or at the front desk. We look forward to welcoming you and sharing what we have learned. "
           "The best way to reach us is by phone, and we will reply as soon as we can. Click on the menu to see more pages about our work, our people and our history.")
GENERIC = set("the and our you your we use for with this that good great best new more all any not are was but can may will".split())


def _pat(term):
    e = re.escape(term.strip())
    return (r"\b" if term[0].isalnum() else "") + e + (r"\b" if term[-1].isalnum() else "")


def _ok(term):
    t = term.strip()
    if len(t) < 3 or t.lower() in GENERIC:
        return False
    return len(re.findall(_pat(t), NEUTRAL, re.I)) == 0  # too broad if it hits ordinary text


def _page(page_starts, off):
    p = None
    for s, n in page_starts or []:
        if s <= off:
            p = n
    return p


def _mk(cat, pattern, fix, page, quote, conf, kind="rule"):
    src = f"Brand guideline, p.{page}" if page else "Brand guideline"
    line = f"{cat} | {pattern} | {fix} | {src}" if kind == "rule" else pattern
    return dict(cat=cat, pattern=pattern, fix=fix, src=src, page=page, quote=quote.strip()[:180], conf=conf, kind=kind, line=line)


def propose(text, page_starts=None, existing_rules=""):
    have = {(l.split("|")[0].strip().lower(), l.split("|")[1].strip().lower()) for l in existing_rules.splitlines() if l.count("|") >= 3}
    out = []
    for a, b, s in sentences(text):
        pg, low = _page(page_starts, a), s.lower()
        for m in re.finditer(r"(?:use|write|say|prefer|spell)\s+" + Q + r"\s*(?:,\s*)?(?:instead of|not|rather than|over)\s+" + Q, s, re.I):
            if _ok(m.group(2)):
                out.append(_mk("Terminology", _pat(m.group(2)), m.group(1).strip(), pg, s, 0.9))
        for m in re.finditer(Q + r"\s*(?:\u2192|->|should be|becomes|is replaced by)\s*" + Q, s, re.I):
            if _ok(m.group(1)):
                out.append(_mk("Terminology", _pat(m.group(1)), m.group(2).strip(), pg, s, 0.85))
        for m in re.finditer(r"\buse\s+([\w.-]{3,20}),?\s+not\s+([\w.-]{3,20})", s, re.I):
            if _ok(m.group(2)):
                out.append(_mk("Terminology", _pat(m.group(2)), m.group(1), pg, s, 0.7))
        if re.search(r"\b(avoid|never (?:use|say|claim)|do not (?:use|say|claim)|don't (?:use|say|claim)|must not (?:use|say|claim)|banned|prohibited)\b", low):
            cat, fix = ("Claims", "(add proof or remove)") if re.search(r"claim|guarantee|superlative|proof|evidence|unsubstantiated|promise", low) else \
                       ("Tone", "(rephrase in brand voice)") if re.search(r"slang|informal|casual|tone|voice", low) else ("Terminology", "(use the approved term)")
            for q in re.findall(Q, s):
                if _ok(q):
                    out.append(_mk(cat, _pat(q), fix, pg, s, 0.8))
        if re.search(r"(avoid|no|limit|never use|do not use|don't use)\b.{0,30}exclamation (marks?|points?)", low):
            out.append(_mk("Tone", "!{2,}", "!", pg, s, 0.85))
        for m in re.finditer(r"(?<![\w.])(\d[\d,]*)\+?\s+(?:[A-Za-z-]+\s)?(clients|customers|students|learners|employees|countries|cities|partners|users|centres|centers|courses|offices)\b", s):
            out.append(_mk("Facts", f"{m.group(2)}: {m.group(1)}", "", pg, s, 0.6, "fact"))
        for m in re.finditer(r"(?:may say|can say|approved (?:claim|statement|tagline)s?)\s*[:\-]?\s*" + Q, s, re.I):
            out.append(_mk("Claims", "approved claim: " + m.group(1).strip(), "", pg, s, 0.8, "fact"))
    if configured():
        try:
            raw = complete("Extract brand rules from the guideline text. Reply with a JSON list of objects "
                           '{"cat":"Terminology|Tone|Claims","term":"exact words to flag","fix":"replacement or (add proof or remove)","quote":"supporting sentence"}. '
                           "Only include rules clearly stated in the text.", text[:12000], max_tokens=1500)
            for r in json.loads(re.search(r"\[.*\]", raw, re.S).group(0)):
                if r.get("cat") in ("Terminology", "Tone", "Claims") and _ok(str(r.get("term", ""))) and r.get("quote", "") in text:
                    out.append(_mk(r["cat"], _pat(r["term"]), r.get("fix") or "(use the approved term)", _page(page_starts, text.find(r["quote"])), r["quote"], 0.6))
        except Exception:
            pass
    seen, res = set(), []
    for p in out:
        k = (p["cat"].lower(), p["pattern"].lower())
        if k in seen or k in have:
            continue
        seen.add(k); p["id"] = f"p{len(res) + 1}"; res.append(p)
    return res
