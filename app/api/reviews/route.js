import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
export const dynamic = "force-dynamic";

const summary = (r) => ({ id: r.id, title: r.title, stage: r.stage, author_id: r.author_id, author_email: r.author_email, updated_at: r.updated_at, issues: (r.findings || []).filter((f) => !(r.dismissed || []).some((d) => d.key === f.cat + ":" + f.text.toLowerCase())).length });

export const GET = guard(null, async (_req, u) => {
  const all = await store().reviews();
  return json({ reviews: all.filter((r) => u.role !== "creator" || r.author_id === u.id).map(summary) });
});

export const POST = guard(null, async (req, u) => {
  const b = await req.json();
  const r = await store().createReview({ title: (b.title || b.content || "Untitled").slice(0, 60), content: b.content || "", findings: b.findings || [], dismissed: b.dismissed || [], author_id: u.id, author_email: u.email });
  await store().addAudit({ review_id: r.id, user_email: u.email, role: u.role, action: "Created draft" });
  for (const n of b.notes || []) await store().addAudit({ review_id: r.id, user_email: u.email, role: u.role, action: n });
  return json({ id: r.id });
});
