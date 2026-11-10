"""Tiny dependency-free TF-IDF retriever (cosine similarity).
Used to ground claims against the approved-claims list. Swap in embeddings
(e.g. sentence-transformers or an embeddings API + pgvector) for production."""
import math
import re
from collections import Counter


def tok(s):
    return re.findall(r"[a-z0-9]+", s.lower())


class TfIdf:
    def __init__(self, docs):
        self.docs = [tok(d) for d in docs]
        n = len(self.docs)
        df = Counter(w for d in self.docs for w in set(d))
        self.idf = {w: math.log((1 + n) / (1 + c)) + 1 for w, c in df.items()}
        self.vecs = [self._vec(d) for d in self.docs]

    def _vec(self, tokens):
        c = Counter(tokens)
        v = {w: (1 + math.log(f)) * self.idf.get(w, 1.0) for w, f in c.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {w: x / norm for w, x in v.items()}

    def query(self, text):
        """Return (best_doc_index, cosine_similarity)."""
        q = self._vec(tok(text))
        sims = [sum(x * v.get(w, 0.0) for w, x in q.items()) for v in self.vecs]
        if not sims:
            return -1, 0.0
        best = max(range(len(sims)), key=sims.__getitem__)
        return best, sims[best]
