"""Embeddings. Remote provider (any OpenAI-compatible /embeddings endpoint) when EMBEDDINGS_URL is set,
otherwise a local deterministic embedder (concept lexicon + hashed n-grams). The local one is an offline
fallback: it understands a small built-in set of paraphrase groups, not language in general."""
import hashlib
import json
import math
import os
import re
import urllib.request
from functools import lru_cache

DIM = 256
NEG = re.compile(r"\b(not|never|cannot|can't|cant|won't|without|disclaim\w*|unable|n't)\b|n't\b", re.I)
STOP = set("the a an to we our you your will is are of and in for with that this it be can get gets got on at as by or if from "
           "have has had do does so than then them they their its us me my i also just more most very much".split())
GROUPS = {
    "GUAR": "guarantee guaranteed guarantees assure assured assures promise promised promises ensure ensured ensures certain certainly definitely risk-free riskfree surely",
    "BEST": "best greatest finest top leading foremost premier unmatched unrivalled unrivaled supreme number-one no1 ultimate unbeatable unparalleled",
    "FAST": "fastest quickest speediest",
    "CHEAP": "cheapest lowest-priced",
    "JOB": "job jobs placement placements placed employment hired hire career careers",
    "ALL": "every all everyone each everybody",
    "RESULT": "result results success outcome outcomes",
    "CLIENT": "client clients customer customers",
    "STUDENT": "student students learner learners pupils",
}


def _stem(w):
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


CONCEPT = {_stem(w): "C:" + g for g, ws in GROUPS.items() for w in ws.split()}


def concept_tokens(text):
    out = []
    for t in re.findall(r"[a-z0-9#%$-]+", text.lower()):
        if t in STOP:
            continue
        s = _stem(t)
        out.append(CONCEPT.get(s, s))
    return out


def _h(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


@lru_cache(maxsize=4096)
def _local(text):
    toks = concept_tokens(text)
    v = [0.0] * DIM
    def add(f, w):
        h = _h(f); v[h % DIM] += w if (h >> 20) & 1 else -w
    for i, t in enumerate(toks):
        add("u:" + t, 1.0)
        if i + 1 < len(toks):
            add("b:" + t + "|" + toks[i + 1], 0.6)
        if not t.startswith("C:"):
            for j in range(len(t) - 2):
                add("c:" + t[j:j + 3], 0.15)
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return tuple(x / n for x in v)


def provider():
    return "remote" if os.environ.get("EMBEDDINGS_URL") else "local"


def _remote(texts):
    body = {"model": os.environ.get("EMBEDDINGS_MODEL", "text-embedding-3-small"), "input": texts, "dimensions": DIM}
    req = urllib.request.Request(os.environ["EMBEDDINGS_URL"], json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "Authorization": "Bearer " + os.environ.get("EMBEDDINGS_KEY", "")})
    d = json.load(urllib.request.urlopen(req, timeout=20))
    out = []
    for x in sorted(d["data"], key=lambda x: x["index"]):
        n = math.sqrt(sum(a * a for a in x["embedding"])) or 1.0
        out.append(tuple(a / n for a in x["embedding"]))
    return out


def embed(texts):
    texts = list(texts)
    if not texts:
        return []
    return _remote(texts) if provider() == "remote" else [_local(t) for t in texts]


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))


def threshold(kind="claim"):
    r = provider() == "remote"
    if kind == "fact":
        return float(os.environ.get("FACT_THRESHOLD", 0.7 if r else 0.85))
    return float(os.environ.get("SEMANTIC_THRESHOLD", 0.78 if r else 0.5))
