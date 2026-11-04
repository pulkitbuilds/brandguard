# BrandGuard AI

Pre-publication brand-governance checker with role-based logins. Creators write drafts, the review engine flags terminology, tone, unsupported claims, wrong facts and accessibility issues (with reason, source rule, suggested fix and confidence), and the draft moves Creator → Manager → Reviewer with an audit trail. Insights show which rules creators keep dismissing.

## Logins and roles

| Role | Tabs | Can do |
|---|---|---|
| creator | Dashboard, Review, Rulebook (read), Accessibility | Write and edit own drafts, accept or dismiss findings, submit for approval |
| manager | + Approvals, Insights | See all reviews, approve stage 1 (blocked while issues are open) or return to creator |
| reviewer | + Approvals, Insights | Final approval (can override open issues; the override is logged) or return |
| admin | all + Team | Everything above, edit the rulebook, change user roles |

Rules are enforced on the server (`lib/workflow.js`, `lib/route.js`), not just hidden in the UI. The server re-runs the checks on submit and approve, so the browser cannot skip them. Drafts are locked while in approval.

## Structure

| Path | What it is |
|---|---|
| `app/login`, `app/(app)/*` | Next.js 14 tabs: dashboard, review, approvals, rulebook, insights, accessibility, team |
| `app/api/*` | Authenticated API routes (reviews, transitions, rulebook, insights, team) |
| `api/index.py`, `ml/` | Python FastAPI backend at `/api/py/*`: rule engine plus lightweight ML (TF-IDF claim grounding, fuzzy fact matching) |
| `lib/store.js` | Data layer: Supabase, or an in-memory store in demo mode |
| `supabase/schema.sql` | Tables: profiles, rulebooks, reviews, audit_log |
| `scripts/seed-demo-users.mjs` | Creates one demo account per role in Supabase |

The Review tab calls `/api/py/review` (Python ML engine) and falls back to the browser engine if it is unreachable.

## Try it now (demo mode, no Supabase)

```bash
npm install
pip install -r requirements.txt
npm run dev          # Next.js :3000 + FastAPI :8000
```

Open http://localhost:3000 and use the demo account buttons (admin, creator, manager, reviewer; password `demo1234`). Data lives in memory and resets when the server restarts.

## Supabase mode (real logins and saved data)

1. Create a Supabase project. SQL Editor → run `supabase/schema.sql`.
2. Copy `.env.example` to `.env.local` and fill all four values (Project Settings → API).
3. Optional: `node --env-file=.env.local scripts/seed-demo-users.mjs` creates the four demo accounts.
4. `npm run dev`. The first account that signs up becomes admin and assigns roles in the Team tab.

Supabase sends a confirmation email on sign-up by default. For quick testing, turn off "Confirm email" under Authentication → Providers → Email.

## Deploy to Vercel

1. Push to GitHub, import the repo in Vercel.
2. Add the four environment variables from `.env.example`.
3. Deploy. `vercel.json` bundles `ml/` into the Python function.

## Known limits

- `/api/py/review` itself is not behind login. It only returns findings for text you send it.
- Not yet covered: PDF/DOCX upload, OCR, video, LLM-written explanations, email notifications.
- `ml/retrieval.py` is a TF-IDF stand-in for embeddings; see the file for the upgrade path.
