import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from ml.engine import review  # noqa: E402

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


class ReviewIn(BaseModel):
    text: str
    rules: str
    facts: str = ""


@app.get("/api/py/health")
def health():
    return {"ok": True}


@app.post("/api/py/review")
def run_review(body: ReviewIn):
    return {"engine": "Python ML backend", "findings": review(body.text, body.rules, body.facts)}
