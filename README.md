# BrandGuard AI

Pre-publication brand-governance checker with role-based logins. Creators submit drafts (typed text, PDF, DOCX or images). The engine flags terminology, tone, unsupported claims, wrong facts and accessibility issues, each with a reason, source rule, suggested fix, confidence and (for files) its location. Drafts then go Creator, Manager, Reviewer with an audit trail.

## Round 3 additions

1. **Document and image review.** Upload PDF, DOCX, PNG or JPG. Text is extracted (OCR for images and scanned PDF pages) and every finding is pinned to its page, paragraph or image region, with boxes drawn on the original pages. Service: `extractor/`.
2. **Meaning-based review, grounded explanations, measured accuracy.** `Semantic` rules hold an example of a prohibited claim and match sentences with the same meaning. Approved-fact labels match synonyms ("customers" vs "clients"). The Explain button retrieves the closest rulebook lines and, if `ANTHROPIC_API_KEY` is set, writes a cited explanation and a rewrite that is re-checked by the rule engine and discarded if it would raise any finding. The server also counts these findings when you submit. Evaluation: `ml/eval/`.
3. **Guideline to rulebook, with versions.** Admins upload a brand guideline; rules are proposed with the page they came from. Admins accept, edit or reject each. Every rulebook save is a new version, rollback creates a new version from an old one, each review records which version checked it, and Insights shows the share of proposed rules accepted.

### Measured results (`python -m ml.eval.run_eval`)

110 synthetic labelled drafts, 85 labelled violations, offline embedder:

| | Round 2 engine | Round 3 engine |
|---|---|---|
| Precision | 0.94 | 0.96 |
| Recall | 0.57 | 0.86 |
| F1 | 0.71 | 0.91 |
| Recall on rephrased violations | 12% | 71% |
| Recall on exact-pattern violations | 100% | 100% |

Read this carefully: the set was written by the team, so it overstates real-world accuracy. The offline embedder only knows a small built-in set of paraphrase groups (guarantee/promise/assured, best/unrivalled, job/placement, customers/clients, learners/students). "Nobody beats us in this field" is still missed. The three remaining false positives are "The best time to enrol..." (the older superlative detector). With real embeddings (`EMBEDDINGS_URL`) coverage should be wider, but that path has not been measured.

## Roles

| Role | Tabs | Can do |
|---|---|---|
| creator | Dashboard, Review, Rulebook (read), Accessibility | Write or upload drafts, accept or dismiss findings, submit |
| manager | + Approvals, Insights | First approval (blocked while issues are open) or return |
| reviewer | + Approvals, Insights | Final approval (may override open issues, logged) or return |
| admin | all + Team | Everything, plus rulebook, guideline import, rollback, roles |

Permissions and approval rules are enforced on the server, which re-runs the checks (Python engine, browser engine if it is down) on submit and approve.

## Structure

| Path | What it is |
|---|---|
| `app/`, `components/`, `lib/` | Next.js 14 app: tabs, API routes, auth, data layer (Supabase or in-memory) |
| `api/index.py`, `ml/` | FastAPI review service (`/api/py/*`): rule engine, semantic matching, grounded explanations, guideline proposer, evaluation |
| `extractor/` | Upload service: PDF (PyMuPDF), DOCX (python-docx), images (Tesseract OCR). Has a Dockerfile |
| `supabase/schema.sql` | profiles, rulebook_versions, guideline_imports, reviews, audit_log |
| `tests/` | `test_locate.mjs`, `e2e_api.py` (roles and workflow), `e2e_round3.py` (uploads, semantic, versions, import) |

## Run locally (demo mode, no Supabase)

```bash
npm install
pip install -r requirements.txt -r extractor/requirements.txt
# OCR needs the Tesseract program: macOS `brew install tesseract`, Ubuntu `sudo apt install tesseract-ocr`
npm run dev          # Next.js :3000, review service :8000, extractor :8001
```

Open http://localhost:3000 and use a demo account (password `demo1234`). Data lives in memory and resets on restart. PDF and DOCX work without Tesseract; images need it.

## Supabase mode

1. Create a project, run `supabase/schema.sql` in the SQL Editor.
2. Copy `.env.example` to `.env.local` and fill the four Supabase values.
3. Optional: `node --env-file=.env.local scripts/seed-demo-users.mjs`. The first account that signs up becomes admin.
4. Turn off "Confirm email" in Supabase Auth for quick testing.

## Deploy

1. **Extractor** (Tesseract cannot run in Vercel functions): deploy `extractor/` as a Docker service on Render, Fly or Hugging Face Spaces. Set `EXTRACTOR_KEY` there.
2. **App** on Vercel: import the repo and set the Supabase variables, `EXTRACTOR_URL` (the service URL), `EXTRACTOR_KEY` and `INTERNAL_KEY` (any long random string; it protects the explain and import endpoints). Optionally `ANTHROPIC_API_KEY` and `EMBEDDINGS_URL`/`EMBEDDINGS_KEY`.
3. Vercel Deployment Protection can block the app's calls to its own `/api/py/*` on preview deployments. Use the production URL or turn protection off for testing.

## Tests

```bash
node tests/test_locate.mjs
python -m ml.eval.run_eval
# with all three services running (INTERNAL_KEY=k3 on Next.js and the review service), on fresh state:
python tests/e2e_api.py && python tests/e2e_round3.py
```
Sample files are in `tests/fixtures/`. Run the scripts from the project root.

## Known limits

- Not tested here: the UI in a browser, a live Supabase project, a live Vercel deployment, a deployed extractor, any real LLM call (explanations and rewrites were tested with stubbed model replies, including the cited-only and re-check rules), and remote embeddings.
- No pgvector. Meaning-based retrieval runs in the review service on each request. Fine for a few hundred rules; a vector table would be the next step.
- Uploads are limited to 4 MB (Vercel request limit) and 10 pages. Extracted text is read-only; fix the original file and upload again. Accept-fix is off in document mode.
- Guideline proposals are pattern-based unless an AI key is set. They only catch rules written in common phrasing ("use X instead of Y", "never say 'Z'") and each needs admin review. Facts already in the rulebook can be proposed again.
- OCR can misread text; the app says when OCR was used.
- The `/api/py/review` endpoint is not behind login (it only analyses text sent to it).
