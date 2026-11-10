"""Grounded explanations. Retrieves the rulebook lines closest in meaning to a finding, asks an LLM (Anthropic or
Gemini) to explain it and propose a rewrite citing ONLY those lines, then re-checks the rewrite with the rule
engine and drops it if it would raise any finding. With no LLM key it returns the retrieved sources only.

Provider: set LLM_PROVIDER=anthropic|gemini, or just set one key (ANTHROPIC_API_KEY or GEMINI_API_KEY)."""
import json
import os
import re
import urllib.request

from .embed import cosine, embed
from .engine import review
from .semantic import sentences

API = "https://api.anthropic.com/v1/messages"
GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"  # Google's OpenAI-compatible endpoint
KEYS = {"anthropic": "ANTHROPIC_API_KEY", "gemini": "GEMINI_API_KEY"}


def provider():
    """Which LLM to use, or None when no key is set."""
    p = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if p in KEYS:
        return p if os.environ.get(KEYS[p]) else None
    return next((n for n, k in KEYS.items() if os.environ.get(k)), None)


def configured():
    return provider() is not None


def _post(body):
    req = urllib.request.Request(API, json.dumps(body).encode(), {
        "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": os.environ["ANTHROPIC_API_KEY"]})
    return json.load(urllib.request.urlopen(req, timeout=40))


def _gemini(system, user, max_tokens):
    body = {"model": os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
            "max_tokens": max(max_tokens, 1500),  # headroom: some Gemini models spend output tokens on reasoning
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(GEMINI_API, json.dumps(body).encode(), {
        "Content-Type": "application/json", "Authorization": "Bearer " + os.environ["GEMINI_API_KEY"]})
    return json.load(urllib.request.urlopen(req, timeout=40))["choices"][0]["message"]["content"] or ""


def complete(system, user, post=None, max_tokens=700):
    if post is None and provider() == "gemini":
        return _gemini(system, user, max_tokens)
    r = (post or _post)({"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5"), "max_tokens": max_tokens,
                         "system": system, "messages": [{"role": "user", "content": user}]})
    return "".join(b.get("text", "") for b in r.get("content", []))


def rule_sources(rules_text, facts_text):
    src = []
    for l in rules_text.splitlines():
        p = [x.strip() for x in l.split("|")]
        if len(p) >= 4 and p[1]:
            src.append(f"{p[3]}: {p[0]} rule. Pattern or example: {p[1]}. Fix: {p[2]}")
    src += [l.strip() for l in facts_text.splitlines() if l.strip()]
    return src


def retrieve(query, sources, k=3):
    if not sources:
        return []
    qv, sv = embed([query])[0], embed(sources)
    ranked = sorted(((cosine(qv, v), s) for v, s in zip(sv, sources)), reverse=True)[:k]
    return [{"id": f"R{n + 1}", "text": s, "score": round(c, 2)} for n, (c, s) in enumerate(ranked) if c > 0]


def _sentence_span(text, i):
    for a, b, s in sentences(text):
        if a <= i < b + 1:
            return a, b, s
    return i, i, ""


def explain(text, finding, rules, facts, post=None):
    a, b, sent = _sentence_span(text, finding["i"])
    sources = retrieve(f"{finding.get('cat', '')} {finding.get('text', '')} {sent}", rule_sources(rules, facts))
    out = {"llm": False, "sources": sources, "explanation": None, "cites": [], "rewrite": None, "rewrite_rejected": None}
    if not (configured() or post):
        out["note"] = "LLM not configured. Showing the rulebook lines this finding was matched to."
        return out
    system = ("You are a brand-compliance assistant. Use ONLY the numbered sources. Reply with JSON only: "
              '{"explanation": "1-2 sentences saying why the text breaks the brand rules", "cites": ["R1"], '
              '"rewrite": "the sentence rewritten to comply, same meaning, no new claims"}. '
              "If the sources do not support a violation, set explanation to null.")
    user = "Sources:\n" + "\n".join(f"[{s['id']}] {s['text']}" for s in sources) + f"\n\nSentence: {sent.strip()}\nFlagged text: {finding.get('text')}"
    try:
        m = re.search(r"\{.*\}", complete(system, user, post), re.S)
        d = json.loads(m.group(0))
    except Exception as e:  # network or malformed output
        out["note"] = f"The model call failed ({type(e).__name__}{' ' + str(e.code) if hasattr(e, 'code') else ''})."
        return out
    ids = {s["id"] for s in sources}
    cites = [c for c in d.get("cites", []) if c in ids]
    out["llm"] = True
    if d.get("explanation") and cites:
        out["explanation"], out["cites"] = d["explanation"], cites
    else:
        out["note"] = "The model gave no explanation that cites the rulebook, so it was not shown."
    rw = (d.get("rewrite") or "").strip()
    if rw and out["explanation"]:
        bad = review(rw, rules, facts)
        if bad:
            out["rewrite_rejected"] = f"Rewrite would still raise {len(bad)} finding(s): " + ", ".join(sorted({f['cat'] for f in bad}))
        else:
            lead = len(sent) - len(sent.lstrip())
            out["rewrite"] = {"text": rw, "i": a + lead, "len": len(sent.strip())}
    return out