import os
import sys
from typing import List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import Depends, FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from ml.embed import provider  # noqa: E402
from ml.engine import review  # noqa: E402
from ml.guideline import propose  # noqa: E402
from ml.llm import configured, explain  # noqa: E402

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


def internal(x_internal_key: Optional[str] = Header(default=None)):
    """Costly endpoints (LLM, guideline import) are only callable by the Next.js server, which knows INTERNAL_KEY."""
    k = os.environ.get("INTERNAL_KEY")
    if k and x_internal_key != k:
        raise HTTPException(403, "Forbidden")


class ReviewIn(BaseModel):
    text: str
    rules: str
    facts: str = ""
    semantic: bool = True


class Finding(BaseModel):
    i: int
    len: int = 0
    text: str = ""
    cat: str = ""


class ExplainIn(BaseModel):
    text: str
    finding: Finding
    rules: str
    facts: str = ""


class ProposeIn(BaseModel):
    text: str
    page_starts: List[List[int]] = []
    existing_rules: str = ""


@app.get("/api/py/health")
def health():
    return {"ok": True, "embeddings": provider(), "llm": configured()}


@app.post("/api/py/review")
def run_review(b: ReviewIn):
    return {"engine": "Python ML backend" + (" + embeddings" if provider() == "remote" else ""), "findings": review(b.text, b.rules, b.facts, b.semantic)}


@app.post("/api/py/explain", dependencies=[Depends(internal)])
def run_explain(b: ExplainIn):
    return explain(b.text, b.finding.dict(), b.rules, b.facts)


@app.post("/api/py/propose", dependencies=[Depends(internal)])
def run_propose(b: ProposeIn):
    return {"proposals": propose(b.text, [tuple(x) for x in b.page_starts], b.existing_rules), "llm": configured()}
