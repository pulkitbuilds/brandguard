"""python -m ml.eval.run_eval  -> compares the Round-2 engine (semantic=False) with the Round-3 engine."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.engine import review  # noqa: E402
from ml.eval.dataset import EVAL_FACTS, EVAL_RULES, build  # noqa: E402

SCORED = {"Claims", "Facts", "Terminology", "Tone"}


def score(data, semantic):
    tp = fp = fn = 0
    by = {}
    bad_drafts = []
    for d in data:
        fs = [f for f in review(d["text"], EVAL_RULES, EVAL_FACTS, semantic) if f["cat"] in SCORED]
        hit = set()
        for f in fs:
            m = next((k for k, l in enumerate(d["labels"]) if l["cat"] == f["cat"] and f["i"] < l["end"] and l["start"] < f["i"] + f["len"]), None)
            if m is None:
                fp += 1; bad_drafts.append((d["id"], d["kind"], f["cat"], d["text"][f["i"]:f["i"] + f["len"]]))
            else:
                hit.add(m)
        tp += len(hit)
        for k, l in enumerate(d["labels"]):
            b = by.setdefault(l["kind"], [0, 0]); b[1] += 1
            if k in hit: b[0] += 1
            else: fn += 1
    p, r = tp / max(1, tp + fp), tp / max(1, tp + fn)
    return dict(precision=round(p, 3), recall=round(r, 3), f1=round(2 * p * r / max(1e-9, p + r), 3), tp=tp, fp=fp, fn=fn,
                recall_by_kind={k: round(v[0] / v[1], 3) for k, v in by.items()}), bad_drafts


if __name__ == "__main__":
    data = build()
    old, _ = score(data, False)
    new, fps = score(data, True)
    res = dict(drafts=len(data), labelled_violations=sum(len(d["labels"]) for d in data), embedder="local", round2_engine=old, round3_engine=new,
               false_positives_round3=[f"draft {a} ({b}): {c} -> '{d}'" for a, b, c, d in fps])
    open(os.path.join(os.path.dirname(__file__), "results.json"), "w").write(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))
